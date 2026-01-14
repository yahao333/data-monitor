/**
 * Cloudflare Pages Function - Data Monitor Webhook Handler
 *
 * 部署说明：
 * 1. 在 Pages 项目设置中添加环境变量：
 *    - UPSTASH_REDIS_REST_URL
 *    - UPSTASH_REDIS_REST_TOKEN
 *    - VITE_WEBHOOK_API_KEY (用于管理 API)
 * 2. Cloudflare 会自动部署此函数
 */

interface Env {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  VITE_WEBHOOK_API_KEY?: string;
}

interface WebhookToken {
  projectId: string;
  token: string;
  createdAt: string;
  lastUsedAt?: string;
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

// Redis HTTP 请求 helper
async function redisRequest(env: Env, path: string, method = 'GET', body?: unknown): Promise<Response> {
  return fetch(`${env.UPSTASH_REDIS_REST_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// 验证 token 是否有效
async function validateToken(env: Env, token: string): Promise<string | null> {
  const response = await redisRequest(env, `/get/webhook:token:${token}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.result as string | null;
}

// 更新项目数据（合并更新）
async function updateProjectData(env: Env, projectId: string, newData: Record<string, unknown>): Promise<boolean> {
  const projectStr = await redisRequest(env, `/get/project:${projectId}`);
  if (!projectStr.ok) return false;
  const projectData = await projectStr.json();

  if (!projectData.result) return false;

  const project = JSON.parse(projectData.result);

  // 合并数据
  if (Array.isArray(newData)) {
    project.content = newData;
  } else if (typeof newData === 'object' && newData !== null) {
    project.content = { ...(project.content as object), ...newData };
  }

  project.updatedAt = new Date().toISOString();

  await redisRequest(env, `/set/project:${projectId}`, 'PUT', JSON.stringify(project));

  return true;
}

// 更新 token 最后使用时间
async function updateTokenUsage(env: Env, token: string): Promise<void> {
  await redisRequest(env, `/set/webhook:token:${token}:lastUsed`, 'PUT', new Date().toISOString());
}

// 获取 Origin (处理同一站点请求)
function getOrigin(request: Request): string {
  return request.headers.get('Origin') || request.url;
}

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 健康检查
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Webhook 接收端点：POST /api/webhook/{token}
    const webhookMatch = path.match(/^\/api\/webhook\/(.+)$/);
    if (request.method === 'POST' && webhookMatch) {
      const token = webhookMatch[1];
      const origin = getOrigin(request);

      // 验证 token
      const projectId = await validateToken(env, token);
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

      // 更新项目数据
      const success = await updateProjectData(env, projectId, data);
      if (success) {
        await updateTokenUsage(env, token);
        return new Response(JSON.stringify({ success: true, message: 'Data updated' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({ error: 'Failed to update data' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 管理 API
    if (path.startsWith('/api/')) {
      const apiKey = request.headers.get('X-API-Key');

      if (!apiKey || apiKey !== env.VITE_WEBHOOK_API_KEY) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 创建 webhook：POST /api/webhook/create
      if (path === '/api/webhook/create' && request.method === 'POST') {
        const { projectId } = await request.json();
        if (!projectId) {
          return new Response(JSON.stringify({ error: 'projectId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const token = generateToken();
        const webhookData: WebhookToken = {
          projectId,
          token,
          createdAt: new Date().toISOString(),
        };

        await redisRequest(env, `/set/webhook:token:${token}`, 'PUT', projectId);
        await redisRequest(env, `/set/webhook:${projectId}:${token}`, 'PUT', JSON.stringify(webhookData));

        const listKey = `project:${projectId}:webhooks`;
        const listResponse = await redisRequest(env, `/get/${listKey}`);
        let webhooks: string[] = [];
        if (listResponse.ok) {
          const listData = await listResponse.json();
          if (listData.result) {
            webhooks = JSON.parse(listData.result);
          }
        }
        webhooks.push(token);
        await redisRequest(env, `/set/${listKey}`, 'PUT', JSON.stringify(webhooks));

        const origin = getOrigin(request);
        const webhookUrl = `${origin}/api/webhook/${token}`;

        return new Response(JSON.stringify({
          success: true,
          webhookUrl,
          token,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 列出 webhooks：GET /api/webhook/list/{projectId}
      if (path.match(/^\/api\/webhook\/list\/(.+)$/) && request.method === 'GET') {
        const [, projectId] = path.match(/^\/api\/webhook\/list\/(.+)$/)!;

        const listKey = `project:${projectId}:webhooks`;
        const listResponse = await redisRequest(env, `/get/${listKey}`);
        let webhooks: string[] = [];
        if (listResponse.ok) {
          const listData = await listResponse.json();
          if (listData.result) {
            webhooks = JSON.parse(listData.result);
          }
        }

        const webhookDetails = await Promise.all(webhooks.map(async (t) => {
          const detailResponse = await redisRequest(env, `/get/webhook:${projectId}:${t}`);
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            if (detailData.result) {
              return JSON.parse(detailData.result);
            }
          }
          return null;
        }));

        return new Response(JSON.stringify({
          success: true,
          webhooks: webhookDetails.filter(Boolean),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 删除 webhook：DELETE /api/webhook/delete/{projectId}/{token}
      if (path.match(/^\/api\/webhook\/delete\/(.+)\/(.+)$/) && request.method === 'DELETE') {
        const [, projectId, token] = path.match(/^\/api\/webhook\/delete\/(.+)\/(.+)$/)!;

        await redisRequest(env, `/del/webhook:token:${token}`);
        await redisRequest(env, `/del/webhook:${projectId}:${token}`);

        const listKey = `project:${projectId}:webhooks`;
        const listResponse = await redisRequest(env, `/get/${listKey}`);
        if (listResponse.ok) {
          const listData = await listResponse.json();
          if (listData.result) {
            const webhooks = JSON.parse(listData.result).filter((t: string) => t !== token);
            await redisRequest(env, `/set/${listKey}`, 'PUT', JSON.stringify(webhooks));
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
