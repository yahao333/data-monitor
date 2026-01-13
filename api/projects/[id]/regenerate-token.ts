import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";

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

// 重新生成分享令牌
export async function POST(request: VercelRequest) {
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
      return responseError(response, 403, "无权操作此项目");
    }

    const updatedProject: Project = {
      ...project,
      shareToken: generateShareToken(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`project:${id}`, updatedProject);

    return responseJson(response, updatedProject);
  } catch (error) {
    console.error("重新生成令牌失败:", error);
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
