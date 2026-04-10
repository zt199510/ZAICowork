# Phase Overview

## Phase 0 - Monorepo & Foundation

- Status: completed
- Goal: 完成 Monorepo 重构、共享协议包、.NET Agent MVP 骨架
- Exit Criteria:
  - 根目录可运行 `npm run dev`、`npm run build`、`npm run lint`
  - 可运行 `npm run build:agent`
  - 前端已消费共享协议类型

## Phase 1 - Agent Runtime Wiring

- Status: completed
- Goal: 打通 Web 客户端与 agent-dotnet 的真实请求/流式响应链路
- Exit Criteria:
  - 点击发送后可触发一次真实 agent 运行
  - UI 可增量显示 token_delta
  - 支持取消运行与错误态展示

## Phase 2 - Tool Execution Loop

- Status: in-progress
- Goal: 引入最小工具执行（Read/Grep/Bash）并回传结果
- Exit Criteria:
  - Tool call 可视化
  - 工具执行日志可追踪
  - 工具结果可回注到后续推理

## Phase 3 - Electron Shell Integration

- Status: not-started
- Goal: 接入 Electron main/preload，托管 agent 生命周期
- Exit Criteria:
  - renderer -> main -> agent 通道稳定
  - 统一协议在 Web 与 Electron 下行为一致

## Phase 4 - Quality & Open Source Readiness

- Status: not-started
- Goal: 完善测试、可观测性、开源治理
- Exit Criteria:
  - CI 稳定通过
  - 发布流程可复现
  - 文档完整可上手
