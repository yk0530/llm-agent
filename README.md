# AI Chat Platform MVP

一个完整的 AI Chat Web App，包含：

- AI 聊天
- 流式输出
- 会话历史
- Markdown 渲染
- 本地存储

## 技术栈

- 前端：Vue 3 + Vite + TypeScript
- 后端：Node.js + Express + TypeScript
- AI：OpenAI / DeepSeek API
- 通信：SSE

## 项目结构

```text
.
├─ client/        # Vue 前端
├─ server/        # Express 后端
└─ shared/        # 前后端共享类型
```

## 本地开发

1. 安装依赖

```bash
npm install
npm install --prefix client
npm install --prefix server
```

2. 配置环境变量

复制 [server/.env.example](/C:/Users/yuke/Documents/New%20project/server/.env.example) 为 `server/.env`

3. 启动开发环境

```bash
npm run dev
```

- 前端默认运行在 `http://localhost:5173`
- 后端默认运行在 `http://localhost:3000`

## 后端环境变量

- `PORT`：后端端口，默认 `3000`
- `OPENAI_API_KEY`：OpenAI API Key
- `OPENAI_BASE_URL`：可选，自定义 OpenAI Base URL
- `DEEPSEEK_API_KEY`：DeepSeek API Key
- `DEEPSEEK_BASE_URL`：可选，自定义 DeepSeek Base URL
- `CORS_ORIGIN`：可选，允许的前端来源

## 当前 MVP 范围

后端用 SQLite 持久化会话和消息
前端现在不再把完整历史作为主数据源提交，而是先从后端拉取会话，再只发送当前输入 message，由后端基于数据库里的历史组装模型上下文

