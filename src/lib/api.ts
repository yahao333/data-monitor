import type {
  DataProject,
  CreateProjectRequest,
  UpdateProjectDataRequest,
  Webhook,
  WebhookResponse,
} from "~/types";
import { redis, KEYS, generateShareToken } from "./upstash";
import { getClerk } from "~/stores";

// Webhook Worker 配置
const WEBHOOK_WORKER_URL = import.meta.env.VITE_WEBHOOK_WORKER_URL || "";
const WEBHOOK_API_KEY = import.meta.env.VITE_WEBHOOK_API_KEY || "";

// 获取当前用户 ID
function getUserId(): string | null {
  const clerk = getClerk();
  return clerk?.user?.id || null;
}

// 调用 Webhook Worker API
async function webhookWorkerRequest(endpoint: string, method = "GET", body?: unknown): Promise<WebhookResponse> {
  if (!WEBHOOK_WORKER_URL || !WEBHOOK_API_KEY) {
    console.warn("[Webhook] Worker URL 或 API Key 未配置");
    return { success: false, error: "Webhook 服务未配置" };
  }

  try {
    const response = await fetch(`${WEBHOOK_WORKER_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": WEBHOOK_API_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    return data;
  } catch (err) {
    console.error("[Webhook] API 请求失败:", err);
    return { success: false, error: err instanceof Error ? err.message : "请求失败" };
  }
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

// 创建项目（初始 content 为空对象）
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
    content: {}, // 初始为空对象
  };

  // 保存项目
  await redis.set(KEYS.project(project.id), project);

  // 添加到用户项目列表
  const projectIds = (await redis.get(KEYS.userProjects(userId))) as string[] || [];
  projectIds.push(project.id);
  await redis.set(KEYS.userProjects(userId), projectIds);

  return project;
}

// 更新项目基本信息
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

// 更新项目 JSON 数据
export async function updateProjectData(id: string, data: UpdateProjectDataRequest): Promise<DataProject> {
  const userId = getUserId();
  if (!userId) throw new Error("未登录");

  const project = await redis.get<DataProject>(KEYS.project(id));
  if (!project) throw new Error("项目不存在");
  if (project.ownerId !== userId) throw new Error("无权修改此项目");

  const updated: DataProject = {
    ...project,
    content: data.content,
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

// ==================== Webhook 管理接口 ====================

// 创建 Webhook
export async function createWebhook(projectId: string): Promise<WebhookResponse> {
  console.log("[Webhook] 创建 webhook:", { projectId, workerUrl: WEBHOOK_WORKER_URL ? "已配置" : "未配置" });
  return webhookWorkerRequest("/api/webhook/create", "POST", { projectId });
}

// 获取项目的所有 Webhook
export async function listWebhooks(projectId: string): Promise<WebhookResponse> {
  console.log("[Webhook] 列出 webhooks:", { projectId });
  return webhookWorkerRequest(`/api/webhook/list/${projectId}`, "GET");
}

// 删除 Webhook
export async function deleteWebhook(projectId: string, token: string): Promise<WebhookResponse> {
  console.log("[Webhook] 删除 webhook:", { projectId, token: token.substring(0, 8) + "..." });
  return webhookWorkerRequest(`/api/webhook/delete/${projectId}/${token}`, "DELETE");
}

// 获取 Webhook URL（用于推送数据）
export function getWebhookUrl(token: string): string {
  // Pages Function 的 webhook 端点
  return `${WEBHOOK_WORKER_URL}/api/webhook/${token}`;
}
