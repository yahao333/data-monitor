/**
 * Cloudflare Worker - Data Monitor Webhook Handler
 *
 * 部署步骤：
 * 1. 创建 Cloudflare Worker
 * 2. 将此脚本复制到 worker 中
 * 3. 在 Workers 设置中添加环境变量：
 *    - UPSTASH_REDIS_REST_URL
 *    - UPSTASH_REDIS_REST_TOKEN
 * 4. 绑定你的 Upstash Redis
 */

interface Env {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
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
async function redisRequest(path: string, method = 'GET', body?: unknown): Promise<Response> {
  const env = process.env as Env;
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
async function validateToken(token: string): Promise<string | null> {
  // 从 Redis 获取 token 对应的项目 ID
  const response = await redisRequest(`/get/webhook:token:${token}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.result as string | null;
}

// 获取项目数据
async function getProject(projectId: string): Promise<unknown> {
  const response = await redisRequest(`/get/project:${projectId}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.result ? JSON.parse(data.result) : null;
}

// 更新项目数据（合并更新）
async function updateProjectData(projectId: string, newData: Record<string, unknown>): Promise<boolean> {
  // 获取当前项目
  const projectStr = await redisRequest(`/get/project:${projectId}`);
  if (!projectStr.ok) return false;
  const projectData = await projectStr.json();

  if (!projectData.result) return false;

  const project = JSON.parse(projectData.result);

  // 合并数据
  if (Array.isArray(newData)) {
    // 如果是数组，直接替换
    project.content = newData;
  } else if (typeof newData === 'object' && newData !== null) {
    // 合并对象
    project.content = { ...(project.content as object), ...newData };
  }

  project.updatedAt = new Date().toISOString();

  // 保存回 Redis
  await redisRequest(`/set/project:${projectId}`, 'PUT', JSON.stringify(project));

  return true;
}

// 更新 token 最后使用时间
async function updateTokenUsage(token: string): Promise<void> {
  await redisRequest(`/set/webhook:token:${token}:lastUsed`, 'PUT', new Date().toISOString());
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 设置 CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 健康检查
      if (path === '/health') {
        return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Webhook 接收端点：POST /webhook/{token}
      const webhookMatch = path.match(/^\/webhook\/(.+)$/);
      if (request.method === 'POST' && webhookMatch) {
        const token = webhookMatch[1];

        // 验证 token
        const projectId = await validateToken(token);
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
        const success = await updateProjectData(projectId, data);
        if (success) {
          await updateTokenUsage(token);
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

      // 管理 API（需要额外的管理密钥，这里简化处理）
      if (path.startsWith('/api/')) {
        const apiKey = request.headers.get('X-API-Key');

        // 简化的 API Key 验证（实际使用应该用更安全的方式）
        if (!apiKey || apiKey !== env.WEBHOOK_API_KEY) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 创建 webhook：POST /api/webhook
        if (path === '/api/webhook' && request.method === 'POST') {
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

          // 存储 token 映射
          await redisRequest(`/set/webhook:token:${token}`, 'PUT', projectId);

          // 存储 webhook 详情
          await redisRequest(`/set/webhook:${projectId}:${token}`, 'PUT', JSON.stringify(webhookData));

          // 添加到项目的 webhook 列表
          const listKey = `project:${projectId}:webhooks`;
          const listResponse = await redisRequest(`/get/${listKey}`);
          let webhooks: string[] = [];
          if (listResponse.ok) {
            const listData = await listResponse.json();
            if (listData.result) {
              webhooks = JSON.parse(listData.result);
            }
          }
          webhooks.push(token);
          await redisRequest(`/set/${listKey}`, 'PUT', JSON.stringify(webhooks));

          const webhookUrl = `${url.origin}/webhook/${token}`;
          return new Response(JSON.stringify({
            success: true,
            webhookUrl,
            token,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 列出项目的 webhooks：GET /api/webhook/{projectId}
        if (path.match(/^\/api\/webhook\/(.+)$/) && request.method === 'GET') {
          const [, projectId] = path.match(/^\/api\/webhook\/(.+)$/)!;

          const listKey = `project:${projectId}:webhooks`;
          const listResponse = await redisRequest(`/get/${listKey}`);
          let webhooks: string[] = [];
          if (listResponse.ok) {
            const listData = await listResponse.json();
            if (listData.result) {
              webhooks = JSON.parse(listData.result);
            }
          }

          // 获取每个 webhook 的详情
          const webhookDetails = await Promise.all(webhooks.map(async (t) => {
            const detailResponse = await redisRequest(`/get/webhook:${projectId}:${t}`);
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

        // 删除 webhook：DELETE /api/webhook/{projectId}/{token}
        if (path.match(/^\/api\/webhook\/(.+)\/(.+)$/) && request.method === 'DELETE') {
          const [, projectId, token] = path.match(/^\/api\/webhook\/(.+)\/(.+)$/)!;

          // 删除 token 映射
          await redisRequest(`/del/webhook:token:${token}`);
          await redisRequest(`/del/webhook:${projectId}:${token}`);

          // 从列表中移除
          const listKey = `project:${projectId}:webhooks`;
          const listResponse = await redisRequest(`/get/${listKey}`);
          if (listResponse.ok) {
            const listData = await listResponse.json();
            if (listData.result) {
              const webhooks = JSON.parse(listData.result).filter((t: string) => t !== token);
              await redisRequest(`/set/${listKey}`, 'PUT', JSON.stringify(webhooks));
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
  },
};
