import type { DataProject, DataPoint, CreateProjectRequest, CreateDataPointRequest } from "~/types";
import { redis, KEYS, generateShareToken } from "./upstash";
import { getClerk } from "~/stores";

// 获取当前用户 ID
function getUserId(): string | null {
  const clerk = getClerk();
  return clerk?.user?.id || null;
}

// 获取用户所有项目
export async function listProjects(): Promise<DataProject[]> {
  const userId = getUserId();
  if (!userId) throw new Error("未登录");

  const projectIds = (await redis.get(KEYS.userProjects(userId))) as string[] || [];
  const projects: DataProject[] = [];

  for (const id of projectIds) {
    const project = await redis.get<DataProject>(KEYS.project(id));
    if (project) projects.push(project);
  }

  // 按创建时间倒序
  return projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// 获取单个项目
export async function getProject(id: string): Promise<DataProject> {
  const userId = getUserId();
  const project = await redis.get<DataProject>(KEYS.project(id));
  if (!project) throw new Error("项目不存在");

  // 检查权限（用户未登录或不是所有者）
  if (userId && project.ownerId !== userId && !project.isPublic) {
    throw new Error("无权访问此项目");
  }

  return project;
}

// 通过分享令牌获取项目（公开访问）
export async function getProjectByToken(token: string): Promise<DataProject | null> {
  // 遍历查找匹配的项目（生产环境可以用索引优化）
  const userId = getUserId();
  if (userId) {
    const projectIds = (await redis.get(KEYS.userProjects(userId))) as string[] || [];
    for (const id of projectIds) {
      const project = await redis.get<DataProject>(KEYS.project(id));
      if (project?.shareToken === token) return project;
    }
  }
  return null;
}

// 创建项目
export async function createProject(data: CreateProjectRequest): Promise<DataProject> {
  const userId = getUserId();
  if (!userId) throw new Error("未登录");

  const project: DataProject = {
    id: crypto.randomUUID(),
    name: data.name,
    description: data.description || "",
    ownerId: userId,
    isPublic: data.isPublic || false,
    shareToken: generateShareToken(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 保存项目
  await redis.set(KEYS.project(project.id), project);

  // 添加到用户项目列表
  const projectIds = (await redis.get(KEYS.userProjects(userId))) as string[] || [];
  projectIds.push(project.id);
  await redis.set(KEYS.userProjects(userId), projectIds);

  return project;
}

// 更新项目
export async function updateProject(id: string, data: Partial<CreateProjectRequest>): Promise<DataProject> {
  const userId = getUserId();
  if (!userId) throw new Error("未登录");

  const project = await redis.get<DataProject>(KEYS.project(id));
  if (!project) throw new Error("项目不存在");
  if (project.ownerId !== userId) throw new Error("无权修改此项目");

  const updated: DataProject = {
    ...project,
    name: data.name ?? project.name,
    description: data.description ?? project.description,
    isPublic: data.isPublic ?? project.isPublic,
    updatedAt: new Date().toISOString(),
  };

  await redis.set(KEYS.project(id), updated);
  return updated;
}

// 删除项目
export async function deleteProject(id: string): Promise<void> {
  const userId = getUserId();
  if (!userId) throw new Error("未登录");

  const project = await redis.get<DataProject>(KEYS.project(id));
  if (!project) throw new Error("项目不存在");
  if (project.ownerId !== userId) throw new Error("无权删除此项目");

  // 删除项目数据点
  const dataPointIds = (await redis.get(KEYS.projectData(id))) as string[] || [];
  for (const dataId of dataPointIds) {
    await redis.del(KEYS.dataPoint(dataId));
  }
  await redis.del(KEYS.projectData(id));

  // 从用户项目列表移除
  const projectIds = (await redis.get(KEYS.userProjects(userId))) as string[] || [];
  await redis.set(KEYS.userProjects(userId), projectIds.filter((pid) => pid !== id));

  // 删除项目
  await redis.del(KEYS.project(id));
}

// 重新生成分享令牌
export async function regenerateToken(id: string): Promise<DataProject> {
  const userId = getUserId();
  if (!userId) throw new Error("未登录");

  const project = await redis.get<DataProject>(KEYS.project(id));
  if (!project) throw new Error("项目不存在");
  if (project.ownerId !== userId) throw new Error("无权操作此项目");

  const updated: DataProject = {
    ...project,
    shareToken: generateShareToken(),
    updatedAt: new Date().toISOString(),
  };

  await redis.set(KEYS.project(id), updated);
  return updated;
}

// 获取项目数据点列表
export async function listDataPoints(projectId: string): Promise<DataPoint[]> {
  const userId = getUserId();
  const project = await redis.get<DataProject>(KEYS.project(projectId));

  if (!project) throw new Error("项目不存在");
  if (userId && project.ownerId !== userId && !project.isPublic) {
    throw new Error("无权访问此项目");
  }

  const dataPointIds = (await redis.get(KEYS.projectData(projectId))) as string[] || [];
  const dataPoints: DataPoint[] = [];

  for (const id of dataPointIds) {
    const dataPoint = await redis.get<DataPoint>(KEYS.dataPoint(id));
    if (dataPoint) dataPoints.push(dataPoint);
  }

  return dataPoints.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// 添加数据点
export async function createDataPoint(projectId: string, data: CreateDataPointRequest): Promise<DataPoint> {
  const userId = getUserId();
  if (!userId) throw new Error("未登录");

  const project = await redis.get<DataProject>(KEYS.project(projectId));
  if (!project) throw new Error("项目不存在");
  if (project.ownerId !== userId) throw new Error("无权添加数据");

  const dataPoint: DataPoint = {
    id: crypto.randomUUID(),
    projectId,
    name: data.name,
    value: data.value,
    unit: data.unit,
    metadata: data.metadata,
    timestamp: new Date().toISOString(),
  };

  // 保存数据点
  await redis.set(KEYS.dataPoint(dataPoint.id), dataPoint);

  // 添加到项目数据点列表
  const dataPointIds = (await redis.get(KEYS.projectData(projectId))) as string[] || [];
  dataPointIds.push(dataPoint.id);
  await redis.set(KEYS.projectData(projectId), dataPointIds);

  return dataPoint;
}

// 删除数据点
export async function deleteDataPoint(projectId: string, dataPointId: string): Promise<void> {
  const userId = getUserId();
  if (!userId) throw new Error("未登录");

  const project = await redis.get<DataProject>(KEYS.project(projectId));
  if (!project) throw new Error("项目不存在");
  if (project.ownerId !== userId) throw new Error("无权删除数据");

  const dataPoint = await redis.get<DataPoint>(KEYS.dataPoint(dataPointId));
  if (!dataPoint) throw new Error("数据点不存在");

  // 删除数据点
  await redis.del(KEYS.dataPoint(dataPointId));

  // 从项目数据点列表移除
  const dataPointIds = (await redis.get(KEYS.projectData(projectId))) as string[] || [];
  await redis.set(KEYS.projectData(projectId), dataPointIds.filter((id) => id !== dataPointId));
}
