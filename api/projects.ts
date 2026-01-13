import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import { randomUUID } from "crypto";

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

// 辅助函数：生成分享令牌
function generateShareToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// 获取所有项目
export async function GET(request: VercelRequest) {
  try {
    const userId = request.headers["x-user-id"] as string;

    if (!userId) {
      return responseError(response, 401, "需要登录才能访问");
    }

    // 从 KV 获取用户的所有项目
    const projectIds = await kv.get<string[]>(`user:${userId}:projects`) || [];
    const projects: Project[] = [];

    for (const id of projectIds) {
      const project = await kv.get<Project>(`project:${id}`);
      if (project) {
        projects.push(project);
      }
    }

    // 按创建时间排序
    projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return responseJson(response, projects);
  } catch (error) {
    console.error("获取项目列表失败:", error);
    return responseError(response, 500, "服务器错误");
  }
}

// 创建项目
export async function POST(request: VercelRequest) {
  try {
    const userId = request.headers["x-user-id"] as string;

    if (!userId) {
      return responseError(response, 401, "需要登录才能访问");
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || !name.trim()) {
      return responseError(response, 400, "项目名称不能为空");
    }

    const projectId = randomUUID();
    const now = new Date().toISOString();
    const shareToken = generateShareToken();

    const project: Project = {
      id: projectId,
      name: name.trim(),
      description: description?.trim() || "",
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
      shareToken,
    };

    // 保存项目
    await kv.set(`project:${projectId}`, project);

    // 添加到用户项目列表
    const userProjects = await kv.get<string[]>(`user:${userId}:projects`) || [];
    userProjects.push(projectId);
    await kv.set(`user:${userId}:projects`, userProjects);

    return responseJson(response, project, 201);
  } catch (error) {
    console.error("创建项目失败:", error);
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
