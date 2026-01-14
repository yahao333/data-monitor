import { Redis } from '@upstash/redis';

// Upstash Redis 客户端（可直接从浏览器调用）
// 文档: https://upstash.com/docs/redis/sdks/javascriptsdk/getstarted

// 环境变量检查（在前端控制台输出）
const UPSTASH_URL = import.meta.env.VITE_UPSTASH_REDIS_URL;
const UPSTASH_TOKEN = import.meta.env.VITE_UPSTASH_REDIS_TOKEN;

console.log('[Upstash] 环境变量检查:');
console.log('[Upstash] VITE_UPSTASH_REDIS_URL:', UPSTASH_URL ? '已设置' : '未设置');
console.log('[Upstash] VITE_UPSTASH_REDIS_TOKEN:', UPSTASH_TOKEN ? '已设置 (长度:' + UPSTASH_TOKEN.length + ')' : '未设置');
console.log('[Upstash] VITE_WEBHOOK_BASE_URL:', import.meta.env.VITE_WEBHOOK_BASE_URL || '未设置');
console.log('[Upstash] VITE_WEBHOOK_API_KEY:', import.meta.env.VITE_WEBHOOK_API_KEY ? '已设置' : '未设置');

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('[Upstash] 错误: Upstash 环境变量未配置或配置错误');
  console.error('[Upstash] 请检查 .env 文件或 Vercel 环境变量配置');
}

export const redis = new Redis({
  // 从环境变量获取配置
  url: UPSTASH_URL,
  token: UPSTASH_TOKEN,
});

// 数据存储键前缀
export const KEYS = {
  userProjects: (userId: string) => `user:${userId}:projects`,
  project: (id: string) => `project:${id}`,
  projectData: (projectId: string) => `project:${projectId}:data`,
  dataPoint: (id: string) => `data:${id}`,
  shareToken: (token: string) => `share:${token}`,
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
