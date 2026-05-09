# Phase 4

- Status: in-progress

## Goal

完成质量体系与开源发布准备。

## Task Checklist

- [x] 协议层单元测试
- [ ] Agent 集成测试（流式事件顺序）
- [ ] 前端关键路径 E2E
- [ ] 失败重试与可观测指标
- [ ] 贡献指南与 Issue 模板
- [ ] 版本策略与发布流程

## Progress Notes

- 已为 `@aiide/shared-protocol` 建立基于 TypeScript 编译校验的协议契约测试基线。
- 已补齐仓库级 `test` / `verify` 入口，并新增 GitHub Actions CI workflow。
- 已将 `apps/electron/out/` 切换为生成产物，避免本地构建后污染 git 工作区。
- 下一步聚焦 Agent 集成测试与前端关键路径 E2E 设计。

## Acceptance

- [ ] CI 全绿（lint/test/build）
- [ ] 新贡献者可按 README 在 15 分钟内跑通
- [ ] 首个可发布版本可复现打包
