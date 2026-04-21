# Token Reward System

一个基于 Token 的行为奖励系统，专为家长/老师奖励孩子/学生好行为而设计。

## 技术栈

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Deployment**: Vercel

## 功能

### 家长端
- 登录/注册
- 管理行为规则库（行为名称、奖励 token 数）
- 给孩子发放 token（选行为 → 选孩子 → 一键添加）
- 管理奖品库（图片、名称、所需 token）
- 查看孩子余额与月度报表
- 审核孩子兑换请求

### 孩子端
- 查看当前 token 余额
- 查看 token 获得记录（按月、按原因）
- 浏览奖品商店（图片、价格）
- 兑换奖品（自动扣除 token）

## 数据库结构

- `families` - 家庭/组织
- `profiles` - 用户资料（角色：parent/child）
- `children` - 孩子档案
- `behavior_rules` - 行为奖励规则库
- `token_ledger` - Token 流水账（核心账本）
- `reward_catalog` - 奖品库
- `reward_redemptions` - 兑换记录

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/qiutan-crypto/token-reward-system.git
cd token-reward-system
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你的 Supabase 配置：

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. 初始化数据库

在 Supabase SQL Editor 中依次执行：

1. `supabase/migrations/001_init_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_functions.sql`
4. `supabase/migrations/004_seed.sql`（可选，演示数据）

### 4. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## 部署到 Vercel

1. 把代码 push 到 GitHub
2. 在 Vercel 导入此仓库
3. 添加环境变量（同 `.env.example`）
4. 部署完成

## 项目结构

```
token-reward-system/
├── app/
│   ├── (auth)/           # 登录/注册页
│   ├── parent/           # 家长端页面
│   │   ├── dashboard/
│   │   ├── award/
│   │   ├── behaviors/
│   │   ├── rewards/
│   │   └── reports/
│   ├── kid/              # 孩子端页面
│   │   ├── home/
│   │   ├── store/
│   │   └── history/
│   └── api/              # API routes
├── components/           # 共用组件
├── lib/                  # Supabase client, utils
├── types/                # TypeScript 类型
└── supabase/
    └── migrations/       # 数据库迁移文件
```
