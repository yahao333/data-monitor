# 数据监控

一个轻量级的数据监控和分享平台。

## 功能特性

- 创建和管理数据监控项目
- 添加、删除、查看数据点
- 通过令牌分享项目给其他人（无需登录即可查看）
- 使用 Clerk 进行用户认证（仅支持邮箱）
- 使用 Vercel KV 存储数据

## 技术栈

- **前端**: SolidJS + Kobalte + Tailwind CSS + Vite + TypeScript
- **认证**: Clerk
- **存储**: Vercel KV (Redis)
- **部署**: Vercel

## 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入配置：

```bash
cp .env.example .env
```

需要配置：
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk 公开密钥
- `KV_URL`: Vercel KV 连接字符串
- `KV_REST_API_TOKEN`: Vercel KV REST API Token

### 3. 启动开发服务器

```bash
bun dev
```

访问 http://localhost:3000

### 4. 构建生产版本

```bash
bun build
```

## 部署到 Vercel

1. 将项目推送到 GitHub
2. 在 Vercel 控制台导入项目
3. 配置环境变量
4. 部署

## 使用说明

### 创建项目

1. 登录后点击"新建项目"
2. 输入项目名称和描述
3. 点击创建

### 添加数据

1. 点击项目卡片进入详情
2. 点击"添加数据"
3. 输入数据名称、数值和单位
4. 点击添加

### 分享项目

1. 点击项目卡片上的分享图标
2. 复制分享链接
3. 任何人可以通过该链接查看项目的公开数据

## 项目结构

```
data-monitor/
├── api/                    # Vercel API 路由
│   ├── projects.ts        # 项目 CRUD API
│   ├── projects/[id]/     # 单个项目相关 API
│   └── share/[token]/     # 分享数据 API
├── src/
│   ├── components/        # UI 组件
│   ├── lib/              # 工具函数和 API
│   ├── pages/            # 页面组件
│   ├── stores/           # 状态管理
│   ├── types/            # 类型定义
│   └── App.tsx           # 应用入口
├── vercel.json           # Vercel 配置
└── vite.config.ts        # Vite 配置
```
