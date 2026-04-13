# Phase 3

- Status: completed

## Goal

引入 Electron 壳层并由 main 进程托管 Agent，保持 Web 与 Electron 使用同一协议模型。

## Task Checklist

- [x] 建立 `apps/electron` 工程骨架
- [x] 实现 preload 安全桥接
- [x] main 进程托管 agent 启停（Batch 1：AgentBridge 类）
- [x] renderer 通过 IPC 请求 main，再由 main 转发 agent
- [x] agentClient.ts transport 抽象：Web HTTP+SSE / Electron IPC 自动切换
- [x] main 进程健康检查（Batch 2）
- [x] 崩溃自动重连（Batch 2）
- [x] 统一日志链路（renderer/main/agent）（Batch 3）

## Acceptance

- [x] Electron 下基础会话可运行
- [x] 崩溃恢复后可重连 agent
- [x] Web 与 Electron 事件表现一致

## Verification Notes

- `apps/electron/scripts/run-electron-vite.cjs` 在启动 `electron-vite` 前清理 `ELECTRON_RUN_AS_NODE`，`npm run dev:electron` 与 `npm run start --workspace @aiide/electron` 在脏环境变量下 smoke 通过，不再出现 `app.whenReady` 为 `undefined` 的启动错误。
- Web 开发态 UI 验证通过：`OUTPUT` 同时出现 `renderer` / `bridge` / `agent`，`TIMELINE` 包含 `run_started`、`tool_call_started`、`tool_call_completed`、`status`、`run_completed`，`bash: Get-Location` 会先弹确认框再完成执行。
- Electron 运行态 UI 验证通过：通过实际 Electron 进程复用同一套 UI，`OUTPUT` / `TIMELINE` 与 Web 保持同类事件表现，`bash:` 确认流正常。
- 新增 Electron 开发态 `debugCrashRun(runId)` 调试入口：renderer 可对活动 run 触发模拟崩溃，main 进程将其视作真实异常退出并进入恢复逻辑。
- 通过定向 `AgentBridge` 验证脚本确认：长运行 `bash: Start-Sleep -Seconds 8` 被强制终止后，bridge 状态流为 `reconnecting -> ready`；恢复期间新的 `read:` 请求会被明确拒绝；恢复后 `read: package.json`、`grep: AgentBridge apps/electron`、`bash: Get-Location` 均再次成功完成。
- 新增 `npm run verify:electron:crash-recovery` 回归脚本：在 Electron 开发态自动执行 `bash: Start-Sleep -Seconds 8` + `debugCrashRun(runId)`，验证冷启动 ready、`reconnecting` 提示、恢复期间提交拦截、恢复后错误 banner 自动清理，以及 `read:` / `grep:` / `bash:` 的 OUTPUT/TIMELINE 闭环。
- renderer `useAgentRun` 补齐 `bridge_error` 的瞬态错误清理：当 bridge 从异常恢复到 `ready` 时，自动清掉恢复期间遗留的错误 banner，避免 UI 停留在过期失败状态。

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

## Batch 3 交付清单

- shared-protocol 新增 `log` 事件、`LogLevel`、`LogSource`、`LogPayload`
- Web Vite bridge 与 Electron `AgentBridge` 改为发送结构化 `log` 事件
- `agent-dotnet` 新增 `WriteLog`，输出 agent 来源日志
- renderer `OUTPUT` 面板改为显示时间、来源徽标与级别样式
- `TIMELINE` 面板补齐 `log` 事件摘要，保留当前 run 作用域
