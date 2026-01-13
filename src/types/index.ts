// 数据项目类型定义

// 项目（直接包含 JSON 数据）
export interface DataProject {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  shareToken?: string;
  // 项目直接包含的 JSON 数据
  content: Record<string, unknown> | unknown[];
}

// 创建项目请求
export interface CreateProjectRequest {
  name: string;
  description: string;
  isPublic?: boolean;
}

// 更新项目数据请求
export interface UpdateProjectDataRequest {
  content: Record<string, unknown> | unknown[];
}

// Webhook 模型
export interface Webhook {
  id: string;
  projectId: string;
  token: string;
  webhookUrl: string;
  createdAt: string;
  lastUsedAt?: string;
  callCount: number;
}

// 创建 Webhook 请求
export interface CreateWebhookRequest {
  projectId: string;
}

// Webhook 响应
export interface WebhookResponse {
  success: boolean;
  webhookUrl?: string;
  token?: string;
  webhooks?: Webhook[];
  error?: string;
}
