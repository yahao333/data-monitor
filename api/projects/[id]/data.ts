import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import { randomUUID } from "crypto";

// 数据点类型定义
interface DataPoint {
  id: string;
  projectId: string;
  name: string;
  value: number;
  unit?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// 获取项目的所有数据点
export async function GET(request: VercelRequest) {
  try {
    const { id } = request.query as { id: string };
    const userId = request.headers["x-user-id"] as string;

    // 验证项目存在
    const project = await kv.get(`project:${id}`);
    if (!project) {
      return responseError(response, 404, "项目不存在");
    }

    // 检查权限
    if (userId && (project as any).ownerId !== userId) {
      return responseError(response, 403, "无权访问此项目");
    }

    // 获取数据点列表
    const dataPointIds = await kv.get<string[]>(`project:${id}:data`) || [];
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
    console.error("获取数据点列表失败:", error);
    return responseError(response, 500, "服务器错误");
  }
}

// 添加数据点
export async function POST(request: VercelRequest) {
  try {
    const { id } = request.query as { id: string };
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
      return responseError(response, 403, "无权添加数据");
    }

    const body = await request.json();
    const { name, value, unit, metadata } = body;

    if (!name || name.trim().length === 0) {
      return responseError(response, 400, "数据名称不能为空");
    }

    if (typeof value !== "number" || isNaN(value)) {
      return responseError(response, 400, "数据值必须是数字");
    }

    const dataPointId = randomUUID();
    const dataPoint: DataPoint = {
      id: dataPointId,
      projectId: id,
      name: name.trim(),
      value,
      unit: unit?.trim(),
      timestamp: new Date().toISOString(),
      metadata,
    };

    // 保存数据点
    await kv.set(`data:${dataPointId}`, dataPoint);

    // 添加到项目数据点列表
    const dataPointIds = await kv.get<string[]>(`project:${id}:data`) || [];
    dataPointIds.push(dataPointId);
    await kv.set(`project:${id}:data`, dataPointIds);

    return responseJson(response, dataPoint, 201);
  } catch (error) {
    console.error("添加数据点失败:", error);
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
