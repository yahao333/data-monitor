import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";

interface DataPoint {
  id: string;
  projectId: string;
  name: string;
  value: number;
  unit?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// 删除数据点
export async function DELETE(request: VercelRequest) {
  try {
    const { id, dataId } = request.query as { id: string; dataId: string };
    const userId = request.headers["x-user-id"] as string;

    if (!userId) {
      return responseError(response, 401, "需要登录才能访问");
    }

    // 验证项目存在
    const project = await kv.get(`project:${id}`);
    if (!project) {
      return responseError(response, 404, "项目不存在");
    }

    // 检查权限
    if ((project as any).ownerId !== userId) {
      return responseError(response, 403, "无权删除数据");
    }

    // 验证数据点存在
    const dataPoint = await kv.get<DataPoint>(`data:${dataId}`);
    if (!dataPoint) {
      return responseError(response, 404, "数据点不存在");
    }

    // 删除数据点
    await kv.del(`data:${dataId}`);

    // 从项目数据点列表中移除
    const dataPointIds = await kv.get<string[]>(`project:${id}:data`) || [];
    const filtered = dataPointIds.filter((did) => did !== dataId);
    await kv.set(`project:${id}:data`, filtered);

    return responseJson(response, { success: true });
  } catch (error) {
    console.error("删除数据点失败:", error);
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
