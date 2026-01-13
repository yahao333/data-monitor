import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";

// 项目类型定义
interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  shareToken: string;
}

// 生成分享令牌
function generateShareToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// 获取单个项目
export async function GET(request: VercelRequest) {
  try {
    const { id } = request.query as { id: string };
    const userId = request.headers["x-user-id"] as string;

    const project = await kv.get<Project>(`project:${id}`);

    if (!project) {
      return responseError(response, 404, "项目不存在");
    }

    // 检查权限：只有所有者可以访问
    if (userId && project.ownerId !== userId) {
      return responseError(response, 403, "无权访问此项目");
    }

    return responseJson(response, project);
  } catch (error) {
    console.error("获取项目失败:", error);
    return responseError(response, 500, "服务器错误");
  }
}

// 更新项目
export async function PATCH(request: VercelRequest) {
  try {
    const { id } = request.query as { id: string };
    const userId = request.headers["x-user-id"] as string;

    if (!userId) {
      return responseError(response, 401, "需要登录才能访问");
    }

    const project = await kv.get<Project>(`project:${id}`);

    if (!project) {
      return responseError(response, 404, "项目不存在");
    }

    if (project.ownerId !== userId) {
      return responseError(response, 403, "无权修改此项目");
    }

    const body = await request.json();
    const { name, description } = body;

    const updatedProject: Project = {
      ...project,
      name: name?.trim() || project.name,
      description: description?.trim() ?? project.description,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`project:${id}`, updatedProject);

    return responseJson(response, updatedProject);
  } catch (error) {
    console.error("更新项目失败:", error);
    return responseError(response, 500, "服务器错误");
  }
}

// 删除项目
export async function DELETE(request: VercelRequest) {
  try {
    const { id } = request.query as { id: string };
    const userId = request.headers["x-user-id"] as string;

    if (!userId) {
      return responseError(response, 401, "需要登录才能访问");
    }

    const project = await kv.get<Project>(`project:${id}`);

    if (!project) {
      return responseError(response, 404, "项目不存在");
    }

    if (project.ownerId !== userId) {
      return responseError(response, 403, "无权删除此项目");
    }

    // 删除项目
    await kv.del(`project:${id}`);

    // 从用户项目列表中移除
    const userProjects = await kv.get<string[]>(`user:${userId}:projects`) || [];
    const filtered = userProjects.filter((pid) => pid !== id);
    await kv.set(`user:${userId}:projects`, filtered);

    // 删除项目的所有数据点
    const dataPointIds = await kv.get<string[]>(`project:${id}:data`) || [];
    for (const dataId of dataPointIds) {
      await kv.del(`data:${dataId}`);
    }
    await kv.del(`project:${id}:data`);

    return responseJson(response, { success: true });
  } catch (error) {
    console.error("删除项目失败:", error);
    return responseError(response, 500, "服务器错误");
  }
}

function response(res: VercelResponse) {
  return res;
}

function responseJson(res: VercelResponse, data: unknown, status = 200) {
  return res.status(status).json(data);
}

function responseError(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message });
}
