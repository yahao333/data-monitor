/**
 * Vercel Serverless Function - Webhook 管理 API
 *
 * 端点：
 * - POST /api/webhook/manage/create - 创建 webhook
 * - GET /api/webhook/manage/list/{projectId} - 列出 webhooks
 * - DELETE /api/webhook/manage/delete/{projectId}/{token} - 删除 webhook
 */

import { Redis } from '@upstash/redis';

// 初始化 Upstash Redis 客户端（添加详细日志）
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

console.log('[Webhook-Manage] 环境变量检查:');
console.log('[Webhook-Manage] UPSTASH_REDIS_REST_URL:', UPSTASH_URL ? '已设置' : '未设置');
console.log('[Webhook-Manage] UPSTASH_REDIS_REST_TOKEN:', UPSTASH_TOKEN ? '已设置' : '未设置');

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('[Webhook-Manage] 错误: Upstash 环境变量未配置');
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

// 验证 API Key
function validateApiKey(request: Request): boolean {
  const apiKey = request.headers.get('X-API-Key');
  return apiKey === WEBHOOK_API_KEY;
}

// 处理 OPTIONS 预检请求
export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// GET - 列出 webhooks
export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const pathParts = path.split('/').filter(Boolean);

  // /api/webhook/manage/list/{projectId}
  // pathParts = ['api', 'webhook', 'manage', 'list', 'projectId']
  if (pathParts[3] === 'list' && pathParts[4]) {
    const projectId = pathParts[4];

    if (!validateApiKey(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const listKey = `project:${projectId}:webhooks`;
      const listStr = await redis.get(listKey) as string | null;
      const webhooks: string[] = listStr ? JSON.parse(listStr) : [];

      const webhookDetails = await Promise.all(
        webhooks.map(async (t) => {
          const detailStr = await redis.get(`webhook:${projectId}:${t}`) as string | null;
          if (detailStr) {
            const detail = JSON.parse(detailStr);
            const lastUsed = await redis.get(`webhook:token:${t}:lastUsed`) as string | null;
            if (lastUsed) detail.lastUsedAt = lastUsed;
            const callCount = await redis.get(`webhook:token:${t}:callCount`) as number | null;
            detail.callCount = callCount || 0;
            return detail;
          }
          return null;
        })
      );

      return new Response(JSON.stringify({
        success: true,
        webhooks: webhookDetails.filter(Boolean),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('[Webhook-Manage List] Error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// POST - 创建 webhook
export async function POST(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const pathParts = path.split('/').filter(Boolean);

  // /api/webhook/manage/create
  // pathParts = ['api', 'webhook', 'manage', 'create']
  if (pathParts[3] === 'create') {
    if (!validateApiKey(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const { projectId } = await request.json();
      if (!projectId) {
        return new Response(JSON.stringify({ error: 'projectId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = generateToken();
      const webhookData = {
        projectId,
        token,
        createdAt: new Date().toISOString(),
      };

      await redis.set(`webhook:token:${token}`, projectId);
      await redis.set(`webhook:${projectId}:${token}`, JSON.stringify(webhookData));

      const listKey = `project:${projectId}:webhooks`;
      const listStr = await redis.get(listKey) as string | null;
      const webhooks: string[] = listStr ? JSON.parse(listStr) : [];
      webhooks.push(token);
      await redis.set(listKey, JSON.stringify(webhooks));

      const origin = request.headers.get('Origin') || '';
      const webhookUrl = `${origin}/api/webhook/${token}`;

      return new Response(JSON.stringify({
        success: true,
        webhookUrl,
        token,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('[Webhook-Manage Create] Error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// DELETE - 删除 webhook
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const pathParts = path.split('/').filter(Boolean);

  // /api/webhook/manage/delete/{projectId}/{token}
  // pathParts = ['api', 'webhook', 'manage', 'delete', 'projectId', 'token']
  if (pathParts[3] === 'delete' && pathParts[4] && pathParts[5]) {
    if (!validateApiKey(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const projectId = pathParts[4];
      const token = pathParts[5];

      await redis.del(`webhook:token:${token}`);
      await redis.del(`webhook:${projectId}:${token}`);
      await redis.del(`webhook:token:${token}:lastUsed`);
      await redis.del(`webhook:token:${token}:callCount`);

      const listKey = `project:${projectId}:webhooks`;
      const listStr = await redis.get(listKey) as string | null;
      if (listStr) {
        const webhooks = JSON.parse(listStr).filter((t: string) => t !== token);
        await redis.set(listKey, JSON.stringify(webhooks));
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('[Webhook-Manage Delete] Error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
