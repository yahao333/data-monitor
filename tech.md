# Data Monitor 技术文档

## 项目概述

一个轻量级数据监控和分享平台，支持用户创建项目、记录数据点，并通过令牌公开分享数据。

### 核心特性

- 项目管理与数据记录
- 实时数据统计展示
- 公开分享功能
- Clerk 无服务器认证
- Upstash Redis 数据存储

---

## 技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **框架** | SolidJS | ^1.9.10 | 响应式 UI 框架 |
| **UI 组件** | Kobalte Core | ^0.13.11 | 无障碍组件库 |
| **路由** | @solidjs/router | ^0.15.4 | 客户端路由 |
| **样式** | Tailwind CSS | ^4.1.18 | 原子化 CSS |
| **构建** | Vite | ^7.2.4 | 开发服务器/构建 |
| **类型** | TypeScript | ~5.9.3 | 类型安全 |
| **图标** | lucide-solid | ^0.562.0 | 图标库 |
| **认证** | Clerk | ^5.119.1 | 无服务器认证 |
| **存储** | Upstash Redis | ^1.36.1 | RESTful Redis |

---

## 项目结构

```
data-monitor/
├── .env                    # 环境变量（敏感信息）
├── .env.example            # 环境变量示例
├── index.html              # HTML 入口
├── package.json            # 项目配置
├── vite.config.ts          # Vite 配置
├── tailwind.config.js      # Tailwind 配置
├── postcss.config.js       # PostCSS 配置
├── tsconfig.json           # TypeScript 根配置
├── tsconfig.app.json       # 应用配置
├── tsconfig.node.json      # Node 配置
└── src/
    ├── index.tsx           # 应用入口
    ├── index.css           # 全局样式
    ├── App.tsx             # 主应用组件
    ├── assets/             # 静态资源
    ├── components/         # UI 组件
    │   ├── Button.tsx      # 按钮
    │   ├── Card.tsx        # 卡片
    │   ├── Header.tsx      # 顶部导航
    │   ├── Input.tsx       # 输入框
    │   ├── Modal.tsx       # 模态框
    │   ├── Textarea.tsx    # 文本域
    │   └── index.ts        # 导出入口
    ├── lib/                # 工具库
    │   ├── api.ts          # 数据 API
    │   ├── upstash.ts      # Redis 客户端
    │   └── utils.ts        # 工具函数
    ├── pages/              # 页面组件
    │   ├── Home.tsx        # 首页
    │   └── ShareView.tsx   # 分享页
    ├── stores/             # 状态管理
    │   └── index.ts        # 应用状态
    └── types/              # 类型定义
        └── index.ts        # 类型导出
```

---

## 数据存储

### Upstash Redis

使用 [Upstash](https://upstash.com/) 提供全局可访问的 Redis 存储，通过 REST API 直接从浏览器调用，无需后端服务器。

#### 环境配置

```env
VITE_UPSTASH_REDIS_URL=https://your-db.upstash.io
VITE_UPSTASH_REDIS_TOKEN=your-token
```

#### Redis 键设计

```
user:{userId}:projects    # 用户的项目 ID 列表
project:{id}              # 项目详情
project:{projectId}:data  # 项目的数据点 ID 列表
data:{id}                 # 数据点详情
```

#### 数据结构

```typescript
// 项目
interface DataProject {
  id: string;           // UUID
  name: string;
  description: string;
  ownerId: string;      // Clerk 用户 ID
  isPublic: boolean;
  shareToken: string;   // 32 位随机字符串
  createdAt: string;    // ISO 8601
  updatedAt: string;
}

// 数据点
interface DataPoint {
  id: string;           // UUID
  projectId: string;
  name: string;
  value: number;
  unit?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;    // ISO 8601
}
```

---

## 认证

### Clerk 集成

使用 [Clerk](https://clerk.com/) 提供无服务器身份验证。

#### 配置

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

#### 使用方式

```typescript
import Clerk from "@clerk/clerk-js";

// 初始化
const clerk = new Clerk("pk_test_xxx");
await clerk.load();

// 获取当前用户
const userId = clerk.user?.id;
```

#### 用户状态管理

```typescript
// src/stores/index.ts
function createAppStore() {
  const [user, setUser] = createSignal<{ id: string; email: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);
  // ...
}
```

---

## 核心模块

### API 层 (`src/lib/api.ts`)

所有数据操作封装为异步函数：

| 函数 | 说明 |
|------|------|
| `listProjects()` | 获取用户所有项目 |
| `getProject(id)` | 获取单个项目 |
| `getProjectByToken(token)` | 通过令牌获取项目（公开） |
| `createProject(data)` | 创建项目 |
| `updateProject(id, data)` | 更新项目 |
| `deleteProject(id)` | 删除项目 |
| `regenerateToken(id)` | 重新生成分享令牌 |
| `listDataPoints(projectId)` | 获取数据点列表 |
| `createDataPoint(projectId, data)` | 添加数据点 |
| `deleteDataPoint(projectId, dataPointId)` | 删除数据点 |

### Redis 客户端 (`src/lib/upstash.ts`)

```typescript
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: import.meta.env.VITE_UPSTASH_REDIS_URL,
  token: import.meta.env.VITE_UPSTASH_REDIS_TOKEN,
});
```

### 页面组件

#### 首页 (`src/pages/Home.tsx`)

- 项目列表展示
- 创建/编辑/删除项目
- 添加/删除数据点
- 生成分享链接

#### 分享页 (`src/pages/ShareView.tsx`)

- 通过令牌公开访问
- 数据统计展示
- 数据列表详情

---

## 状态管理

使用 SolidJS 的 `createSignal` 实现轻量级响应式状态：

```typescript
// src/stores/index.ts
export const appStore = createRoot(() => {
  const [user, setUser] = createSignal<User | null>(null);
  const [projects, setProjects] = createSignal<DataProject[]>([]);
  const [currentProject, setCurrentProject] = createSignal<DataProject | null>(null);
  const [projectData, setProjectData] = createSignal<DataPoint[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  return {
    user, setUser,
    projects, setProjects,
    currentProject, setCurrentProject,
    projectData, setProjectData,
    isLoading, setIsLoading,
    error, setError,
  };
});
```

---

## 组件设计

### Button (`src/components/Button.tsx`)

基于 Kobalte 的 Button 组件：

```tsx
<Button variant="primary" size="sm" onClick={handleClick}>
  <Icon class="mr-2 h-4 w-4" />
  按钮文本
</Button>
```

### Modal (`src/components/Modal.tsx`)

基于 Kobalte Dialog 的模态框：

```tsx
<Modal isOpen={showModal} onClose={() => setShowModal(false)} title="标题">
  <div class="space-y-4">内容</div>
</Modal>
```

---

## 构建与部署

### 开发

```bash
bun run dev    # 启动开发服务器 (http://localhost:3000)
```

### 构建

```bash
bun run build  # 构建生产版本到 dist/
```

### 部署

项目可部署到 Vercel 等静态托管平台：

```bash
# Vercel 部署
npx vercel --prod
```

---

## 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk 公钥 | ✅ |
| `VITE_UPSTASH_REDIS_URL` | Upstash Redis URL | ✅ |
| `VITE_UPSTASH_REDIS_TOKEN` | Upstash Redis Token | ✅ |

---

## 安全考虑

1. **认证**: Clerk 处理所有认证逻辑，敏感操作依赖用户 ID
2. **权限检查**: API 层验证项目所有权
3. **令牌分享**: 分享令牌为随机生成，无法猜测
4. **环境变量**: 敏感信息通过 `.env` 管理，不提交到代码仓库

---

## 扩展建议

1. **数据验证**: 使用 Zod 或类似库验证输入
2. **错误边界**: 添加 SolidJS 错误边界处理
3. **分页**: 大数据量时添加列表分页
4. **实时更新**: 使用 Upstash Redis 订阅实现实时推送
5. **图表**: 集成图表库展示数据趋势
