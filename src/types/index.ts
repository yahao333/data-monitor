// 数据项目类型定义

export interface DataProject {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  shareToken?: string;
}

export interface DataPoint {
  id: string;
  projectId: string;
  name: string;
  value: number;
  unit?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
  isPublic?: boolean;
}

export interface CreateDataPointRequest {
  name: string;
  value: number;
  unit?: string;
  metadata?: Record<string, unknown>;
}
