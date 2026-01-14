/**
 * Vercel Serverless Function - Webhook Handler
 *
 * 部署：推送到 GitHub 后，Vercel 会自动部署
 * 环境变量：在 Vercel 项目设置中配置
 */

import { Redis } from '@upstash/redis';

// 初始化 Upstash Redis 客户端（添加详细日志）
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

console.log('[Webhook] 环境变量检查:');
console.log('[Webhook] UPSTASH_REDIS_REST_URL:', UPSTASH_URL ? '已设置' : '未设置');
console.log('[Webhook] UPSTASH_REDIS_REST_TOKEN:', UPSTASH_TOKEN ? '已设置' : '未设置');
console.log('[Webhook] VITE_WEBHOOK_API_KEY:', process.env.VITE_WEBHOOK_API_KEY ? '已设置' : '未设置');

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('[Webhook] 错误: Upstash 环境变量未配置');
  console.error('[Webhook] 完整环境变量:', JSON.stringify(process.env, null, 2));
}

const redis = new Redis({
  url: UPSTASH_URL || '',
  token: UPSTASH_TOKEN || '',
});

// API Key（用于管理操作）
const WEBHOOK_API_KEY = process.env.VITE_WEBHOOK_API_KEY || '';

// 生成随机 token
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 处理 OPTIONS 预检请求
export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// 健康检查
export async function GET() {
  return new Response(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// 数据推送端点：POST /api/webhook/{token}
export async function POST(request: Request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const token = pathParts[pathParts.length - 1];

  try {
    // 验证 token
    const projectId = await redis.get(`webhook:token:${token}`) as string | null;
    if (!projectId) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 解析请求体
    const contentType = request.headers.get('Content-Type');
    let data: Record<string, unknown>;

    if (contentType?.includes('application/json')) {
      data = await request.json();
    } else if (contentType?.includes('text/plain')) {
      const text = await request.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { value: text };
      }
    } else {
      const formData = await request.formData();
      data = Object.fromEntries(formData.entries());
    }

    // 获取当前项目
    const projectStr = await redis.get(`project:${projectId}`) as string | null;
    if (!projectStr) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const project = JSON.parse(projectStr);

    // 合并数据
    if (Array.isArray(data)) {
      project.content = data;
    } else if (typeof data === 'object' && data !== null) {
      project.content = { ...(project.content as object), ...data };
    }

    project.updatedAt = new Date().toISOString();

    // 保存回 Redis
    await redis.set(`project:${projectId}`, JSON.stringify(project));

    // 更新 token 使用时间
    await redis.set(`webhook:token:${token}:lastUsed`, new Date().toISOString());

    return new Response(JSON.stringify({
      success: true,
      message: 'Data updated',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
