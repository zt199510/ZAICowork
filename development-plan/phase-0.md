# Phase 0

- Status: completed
- Date Closed: 2026-04-10

## Scope

- Monorepo 结构建立（apps / packages / services）
- 共享协议包 `@aiide/shared-protocol`
- `.NET agent-dotnet` MVP 进程骨架
- 前端引入共享协议类型

## Completed Items

- [x] 根目录脚本改为 workspace 编排
- [x] Web 项目迁移到 `apps/web`
- [x] 新增 `packages/shared-protocol`
- [x] 新增 `services/agent-dotnet`
- [x] 构建与 lint 验证通过

## Verification Commands

```bash
npm run dev
npm run build
npm run lint
npm run build:agent
```

## Notes

- 当前 npm 环境下 `workspace:*` 解析异常，已改为 `file:` 本地依赖（后续可在升级 npm 后再切回 workspace 协议）。
