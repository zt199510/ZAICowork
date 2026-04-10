# Phase 2

- Status: in-progress
- Start Date: 2026-04-10

## Goal

实现最小工具执行循环（Read/Grep/Bash），形成类似 OpenCowork 的工具驱动任务执行体验。

## Task Checklist

- [ ] 定义 ToolCall 请求/结果协议
- [ ] 后端实现工具执行与超时控制
- [ ] 前端展示 ToolCard（入参与结果预览）
- [ ] 增加用户确认策略（高风险工具）
- [ ] 对工具输出做截断与折叠

## Acceptance

- [ ] 至少 3 个工具可执行
- [ ] 工具调用在时间线上可追踪
- [ ] 出错时有错误码与重试建议

## Next Step

- 先在 shared-protocol 中定义 ToolCall 事件和最小 Read/Grep/Bash 请求结果结构，再让后端与前端按同一协议推进。
