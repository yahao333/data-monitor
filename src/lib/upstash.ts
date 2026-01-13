import { Redis } from '@upstash/redis';

// Upstash Redis 客户端（可直接从浏览器调用）
// 文档: https://upstash.com/docs/redis/sdks/javascriptsdk/getstarted

export const redis = new Redis({
  // 从环境变量获取配置
  url: import.meta.env.VITE_UPSTASH_REDIS_URL,
  token: import.meta.env.VITE_UPSTASH_REDIS_TOKEN,
});

// 数据存储键前缀
export const KEYS = {
  userProjects: (userId: string) => `user:${userId}:projects`,
  project: (id: string) => `project:${id}`,
  projectData: (projectId: string) => `project:${projectId}:data`,
  dataPoint: (id: string) => `data:${id}`,
};

// 辅助函数：生成分享令牌
export function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
