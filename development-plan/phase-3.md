# Phase 3

- Status: not-started

## Goal

引入 Electron 壳层并由 main 进程托管 Agent，保持 Web 与 Electron 使用同一协议模型。

## Task Checklist

- [ ] 建立 `apps/electron` 工程骨架
- [ ] 实现 preload 安全桥接
- [ ] main 进程托管 agent 启停与健康检查
- [ ] renderer 通过 IPC 请求 main，再由 main 转发 agent
- [ ] 统一日志链路（renderer/main/agent）

## Acceptance

- [ ] Electron 下基础会话可运行
- [ ] 崩溃恢复后可重连 agent
- [ ] Web 与 Electron 事件表现一致
