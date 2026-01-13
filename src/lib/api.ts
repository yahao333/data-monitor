import type { DataProject, DataPoint, CreateProjectRequest, CreateDataPointRequest } from "~/types";

const API_BASE = "/api";

// API 调用封装
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "请求失败" }));
    throw new Error(error.message || "请求失败");
  }

  return response.json();
}

// 项目相关 API
export const projectApi = {
  // 获取所有项目（需要登录）
  list: () => fetchApi<DataProject[]>("/projects"),

  // 获取单个项目
  get: (id: string) => fetchApi<DataProject>(`/projects/${id}`),

  // 通过令牌获取公开项目
  getByToken: (token: string) =>
    fetchApi<DataProject>(`/projects/share/${token}`),

  // 创建项目
  create: (data: CreateProjectRequest) =>
    fetchApi<DataProject>("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // 更新项目
  update: (id: string, data: Partial<CreateProjectRequest>) =>
    fetchApi<DataProject>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // 删除项目
  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/projects/${id}`, {
      method: "DELETE",
    }),

  // 重新生成分享令牌
  regenerateToken: (id: string) =>
    fetchApi<DataProject>(`/projects/${id}/regenerate-token`, {
      method: "POST",
    }),
};

// 数据点相关 API
export const dataApi = {
  // 获取项目的所有数据点
  list: (projectId: string) =>
    fetchApi<DataPoint[]>(`/projects/${projectId}/data`),

  // 获取项目的所有数据点（通过令牌）
  listByToken: (token: string) =>
    fetchApi<DataPoint[]>(`/share/${token}/data`),

  // 添加数据点
  create: (projectId: string, data: CreateDataPointRequest) =>
    fetchApi<DataPoint>(`/projects/${projectId}/data`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // 删除数据点
  delete: (projectId: string, dataPointId: string) =>
    fetchApi<{ success: boolean }>(`/projects/${projectId}/data/${dataPointId}`, {
      method: "DELETE",
    }),
};
