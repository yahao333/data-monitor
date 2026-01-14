/**
 * Vercel Serverless Function - Webhook 管理 API
 *
 * 端点：
 * - POST /api/webhook/manage/create - 创建 webhook
 * - GET /api/webhook/manage/list/{projectId} - 列出 webhooks
 * - DELETE /api/webhook/manage/delete/{projectId}/{token} - 删除 webhook
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

const WEBHOOK_API_KEY = process.env.VITE_WEBHOOK_API_KEY || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// 生成随机 token
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 验证 API Key
function validateApiKey(request: Request): boolean {
  const apiKey = request.headers.get('X-API-Key');
  return apiKey === WEBHOOK_API_KEY;
}

// 创建 webhook - POST /api/webhook/manage/create
export async function POST(request: Request) {
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

    // 存储 token 映射
    await redis.set(`webhook:token:${token}`, projectId);

    // 存储 webhook 详情
    await redis.set(`webhook:${projectId}:${token}`, JSON.stringify(webhookData));

    // 添加到项目 webhook 列表
    const listKey = `project:${projectId}:webhooks`;
    const listStr = await redis.get(listKey) as string | null;
    const webhooks: string[] = listStr ? JSON.parse(listStr) : [];
    webhooks.push(token);
    await redis.set(listKey, JSON.stringify(webhooks));

    // 获取请求的 origin
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
    console.error('[Webhook Create] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// 列出 webhooks - GET /api/webhook/manage/list/{projectId}
export async function GET(request: Request) {
  if (!validateApiKey(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const projectId = pathParts[pathParts.length - 1];

    const listKey = `project:${projectId}:webhooks`;
    const listStr = await redis.get(listKey) as string | null;
    const webhooks: string[] = listStr ? JSON.parse(listStr) : [];

    // 获取每个 webhook 的详情
    const webhookDetails = await Promise.all(
      webhooks.map(async (t) => {
        const detailStr = await redis.get(`webhook:${projectId}:${t}`) as string | null;
        if (detailStr) {
          const detail = JSON.parse(detailStr);
          // 获取最后使用时间
          const lastUsed = await redis.get(`webhook:token:${t}:lastUsed`) as string | null;
          if (lastUsed) {
            detail.lastUsedAt = lastUsed;
          }
          // 获取调用次数
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
    console.error('[Webhook List] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// 删除 webhook - DELETE /api/webhook/manage/delete/{projectId}/{token}
export async function DELETE(request: Request) {
  if (!validateApiKey(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const projectId = pathParts[pathParts.length - 2];
    const token = pathParts[pathParts.length - 1];

    // 删除 token 映射
    await redis.del(`webhook:token:${token}`);
    await redis.del(`webhook:${projectId}:${token}`);
    await redis.del(`webhook:token:${token}:lastUsed`);
    await redis.del(`webhook:token:${token}:callCount`);

    // 从列表中移除
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
    console.error('[Webhook Delete] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
