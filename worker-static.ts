/**
 * Cloudflare Worker - 前端静态文件托管 + Webhook API
 *
 * 注意：这是一种替代方案，推荐使用 Cloudflare Pages 托管前端
 */

interface Env {
  // 静态文件所在的 KV 命名空间（可选）
  // STATIC_ASSETS: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 如果是 API 请求，交给 Pages Function 处理
    if (path.startsWith('/api/') || path.startsWith('/webhook/')) {
      return new Response('API endpoint - use Pages Function instead', {
        status: 404,
      });
    }

    // 返回前端页面
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Data Monitor</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f5f5f5;
      color: #333;
    }
    h1 { color: #2563eb; }
    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    code {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 14px;
    }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Data Monitor</h1>
  <div class="card">
    <h2>部署方式</h2>
    <p>当前使用的是 Workers 域名，需要改用 <strong>Cloudflare Pages</strong> 托管前端。</p>
  </div>
  <div class="card">
    <h2>修复步骤</h2>
    <ol>
      <li>删除此 Workers 项目</li>
      <li>在 Cloudflare Pages 中创建新项目</li>
      <li>连接同一个 GitHub 仓库</li>
      <li>配置：Build command: <code>npm run build</code></li>
      <li>配置：Build output directory: <code>dist</code></li>
      <li>设置环境变量并重新部署</li>
    </ol>
  </div>
  <div class="card">
    <h2>项目结构</h2>
    <ul>
      <li><code>src/</code> - 前端源代码</li>
      <li><code>functions/_worker.ts</code> - Webhook API (Pages Functions)</li>
      <li><code>dist/</code> - 构建输出目录</li>
    </ul>
  </div>
</body>
</html>
    `;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  },
};
