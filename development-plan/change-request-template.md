# Change Request Template

以后新增功能、改架构、插入需求，建议直接复制这个模板给 Copilot。

```text
请先读取：
- development-plan/current-status.md
- development-plan/phase-overview.md
- development-plan/session-handoff.md

这是一个新需求，请按下面流程处理：
1. 判断它属于当前 Phase 还是后续 Phase
2. 判断它是主线需求还是扩展需求
3. 如果会影响计划，先更新 development-plan
4. 再决定是否开始实现

需求标题：

业务目标：

具体需求：

影响范围：
- 前端：
- 共享协议：
- agent-dotnet：
- Electron：
- 文档：

约束条件：
- 不要改动：
- 必须兼容：
- 性能要求：
- 安全要求：

验收标准：
1.
2.
3.

执行要求：
- 先给出会更新哪些计划文件
- 若可直接做，则从最小实现开始
- 完成后必须回写 current-status.md 和 session-handoff.md
```

## 极简版

如果你不想写太长，至少用这个：

```text
这是一个扩展需求：<你的需求>
先判断它属于哪个 Phase。
如果需要，先更新 development-plan，再开始实现。
完成后更新 current-status.md 和 session-handoff.md。
```
