# Development Plan Directory

这个目录用于长期留存 AIIde 的研发路线和执行进度，便于任何新对话快速接手。

## 文件说明

- `phase-overview.md`：全部阶段总览（目标、验收标准、依赖关系）
- `phase-0.md` ~ `phase-4.md`：各阶段执行清单与状态
- `current-status.md`：当前版本状态、最近完成项、下一步
- `session-handoff.md`：会话交接摘要（每次任务结束时更新）
- `how-to-drive-execution.md`：如何让 Copilot 严格按计划推进
- `change-request-template.md`：扩展需求提报模板

## 更新规范

1. 每完成一个里程碑，更新对应 `phase-x.md` 的状态。
2. 每次结束开发会话，更新 `session-handoff.md` 与 `current-status.md`。
3. 状态字段统一使用：`not-started`、`in-progress`、`completed`、`blocked`。
4. 所有时间统一使用 `YYYY-MM-DD`（北京时间）。

## 快速入口

- 当前状态：`current-status.md`
- 下一阶段：`phase-1.md`
- 执行说明：`how-to-drive-execution.md`
- 需求模板：`change-request-template.md`

## 自定义 Agent

- `Plan Executor`：位于 `.github/agents/plan-executor.agent.md`
