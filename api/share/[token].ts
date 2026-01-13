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

interface DataPoint {
  id: string;
  projectId: string;
  name: string;
  value: number;
  unit?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// 通过令牌获取项目数据（公开访问）
export async function GET(request: VercelRequest) {
  try {
    const { token } = request.query as { token: string };

    // 查找具有此令牌的项目
    // 注意：这是简单实现，生产环境可以使用索引
    const projectIds = await kv.keys("project:*");

    let foundProject: Project | null = null;

    for (const key of projectIds) {
      const project = await kv.get<Project>(key);
      if (project && project.shareToken === token) {
        foundProject = project;
        break;
      }
    }

    if (!foundProject) {
      return responseError(response, 404, "项目不存在或令牌无效");
    }

    // 获取数据点列表
    const dataPointIds = await kv.get<string[]>(`project:${foundProject.id}:data`) || [];
    const dataPoints: DataPoint[] = [];

    for (const dataId of dataPointIds) {
      const dataPoint = await kv.get<DataPoint>(`data:${dataId}`);
      if (dataPoint) {
        dataPoints.push(dataPoint);
      }
    }

    // 按时间戳排序
    dataPoints.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return responseJson(response, dataPoints);
  } catch (error) {
    console.error("获取分享数据失败:", error);
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
