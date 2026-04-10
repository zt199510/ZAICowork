# AIIde

一个面向开发者的开源 AI 编程助手项目，架构对齐 OpenCowork：

- 前端客户端（Web，后续接 Electron）
- 共享协议包（前后端统一事件模型）
- .NET Agent 进程（MVP 流式输出）

当前版本提供：

- Monorepo 目录结构（apps / packages / services）
- React + TypeScript + Vite 客户端骨架
- 共享 StreamEvent 协议类型（@aiide/shared-protocol）
- .NET Agent Loop MVP（stdio 输入，JSON 事件输出）

## 快速开始

```bash
npm install
npm run dev
```

默认访问地址：http://localhost:5173

构建 Web：

```bash
npm run build
```

构建 .NET Agent：

```bash
npm run build:agent
```

## 项目结构

```text
apps/
  web/                      # 前端客户端
packages/
  shared-protocol/          # 前后端共享协议
services/
  agent-dotnet/             # .NET Agent 后端
```

## 当前里程碑

1. 已完成 Phase 0 起步：Monorepo + 协议层 + Agent MVP 骨架
2. 下一步进入 Phase 1：真实 Provider 接入与流式链路联调

## 开发计划留存

长期计划与进度记录在 `development-plan/`：

- 总览：`development-plan/phase-overview.md`
- 当前状态：`development-plan/current-status.md`
- 会话交接：`development-plan/session-handoff.md`

## 开源协议

本项目采用 MIT 协议，见 LICENSE。
