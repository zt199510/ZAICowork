# Phase 3

- Status: in-progress

## Goal

引入 Electron 壳层并由 main 进程托管 Agent，保持 Web 与 Electron 使用同一协议模型。

## Task Checklist

- [x] 建立 `apps/electron` 工程骨架
- [x] 实现 preload 安全桥接
- [x] main 进程托管 agent 启停（Batch 1：AgentBridge 类）
- [x] renderer 通过 IPC 请求 main，再由 main 转发 agent
- [x] agentClient.ts transport 抽象：Web HTTP+SSE / Electron IPC 自动切换
- [ ] main 进程 agent 健康检查（Batch 2）
- [ ] 崩溃自动重连（Batch 2）
- [ ] 统一日志链路（renderer/main/agent）（Batch 3）

## Acceptance

- [ ] Electron 下基础会话可运行
- [ ] 崩溃恢复后可重连 agent
- [ ] Web 与 Electron 事件表现一致

## Batch 1 交付清单

| 文件 | 变更 |
|------|------|
| `apps/electron/package.json` | 新建 Electron workspace |
| `apps/electron/electron-vite.config.ts` | electron-vite 构建配置 |
| `apps/electron/tsconfig*.json` | 主进程/renderer 双 tsconfig |
| `apps/electron/src/main/index.ts` | BrowserWindow + IPC handler 注册 |
| `apps/electron/src/main/agent-bridge.ts` | AgentBridge 类（从 Vite bridge 迁移） |
| `apps/electron/src/preload/index.ts` | contextBridge 暴露最小 agentApi |
| `apps/electron/src/renderer/index.html` | Electron renderer 入口 HTML |
| `apps/electron/src/renderer/main.tsx` | 复用 web/src/App 与样式 |
| `apps/web/src/lib/agentClient.ts` | transport 抽象：自动检测 window.agentApi |
| `package.json` | 新增 dev:electron / build:electron 脚本 |
