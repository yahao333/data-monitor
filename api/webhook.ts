/**
 * Vercel Serverless Function - Webhook Handler
 *
 * 端点：
 * - POST /api/webhook/{token} - 推送数据到项目
 * - GET /api/webhook - 健康检查
 * - POST /api/webhook/manage/create - 创建 webhook
 * - GET /api/webhook/manage/list/{projectId} - 列出 webhooks
 * - DELETE /api/webhook/manage/delete/{projectId}/{token} - 删除 webhook
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
  console.log('[Webhook] API Key 验证:', {
    received: apiKey ? apiKey.substring(0, 10) + '...' : '未提供',
    expected: WEBHOOK_API_KEY ? WEBHOOK_API_KEY.substring(0, 10) + '...' : '未设置',
    match: apiKey === WEBHOOK_API_KEY
  });
  return apiKey === WEBHOOK_API_KEY;
}

// 处理 OPTIONS 预检请求
export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// 健康检查
export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // /api/webhook - 健康检查
  if (path === '/api/webhook') {
    return new Response(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // /api/webhook/manage/list/{projectId} - 列出 webhooks
  const listMatch = path.match(/^\/api\/webhook\/manage\/list\/(.+)$/);
  console.log('[Webhook List] path:', path, 'listMatch:', listMatch);
  if (listMatch) {
    if (!validateApiKey(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const projectId = listMatch[1];
      const listKey = `project:${projectId}:webhooks`;
      console.log('[Webhook List] 查询 key:', listKey);

      const listStr = await redis.get(listKey) as string | null;
      console.log('[Webhook List] listStr:', listStr);

      if (!listStr) {
        return new Response(JSON.stringify({
          success: true,
          webhooks: [],
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let webhooks: string[];
      try {
        webhooks = JSON.parse(listStr);
        console.log('[Webhook List] webhooks:', webhooks);
      } catch (e) {
        console.error('[Webhook List] JSON 解析错误:', e);
        webhooks = [];
      }

      // 获取每个 webhook 的详情
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
      console.error('[Webhook List] Error:', error);
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

// 数据推送端点：POST /api/webhook/{token}
export async function POST(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // /api/webhook/manage/create - 创建 webhook
  if (path === '/api/webhook/manage/create') {
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
      console.error('[Webhook Create] Error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // /api/webhook/{token} - 推送数据
  const webhookMatch = path.match(/^\/api\/webhook\/(.+)$/);
  if (webhookMatch) {
    const token = webhookMatch[1];

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

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// 删除 webhook：DELETE /api/webhook/manage/delete/{projectId}/{token}
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;

  const deleteMatch = path.match(/^\/api\/webhook\/manage\/delete\/(.+)\/(.+)$/);
  if (!deleteMatch) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!validateApiKey(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const projectId = deleteMatch[1];
    const token = deleteMatch[2];

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
    console.error('[Webhook Delete] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
