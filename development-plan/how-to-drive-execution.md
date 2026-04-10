# How To Drive Execution

这个文件说明如何让 Copilot 严格按计划推进，以及如何在过程中插入新需求。

## 一、让它按计划执行

如果你已经在 VS Code 里启用了工作区自定义 agent，可以直接选择：`Plan Executor`。

这个 agent 会固定执行：

1. 先读取计划文件
2. 先用 plan mode 输出执行摘要
3. 再做实现
4. 最后回写计划文件

你每次开新对话时，直接发这样的指令：

```text
请按 development-plan/current-status.md 和 development-plan/phase-1.md 继续执行。
先读取当前状态和 phase 文件，完成 Next Actions 的第 1 项。
完成后：
1. 更新 current-status.md
2. 更新对应 phase 文件状态
3. 在 session-handoff.md 追加本次摘要
4. 给我验证结果
```

如果你想更强约束，可以直接说：

```text
不要跳 Phase，不要自己换方向。
只允许做当前 Active Phase 的 Next Actions 第一项，做完再停。
```

## 二、让它只做一个小步骤

适合你想控节奏时使用：

```text
按计划推进，但这次只做一个最小步骤：
只完成 current-status.md 里的 Next Actions 第 1 项。
不要顺带做第 2、3 项。
```

## 三、让它连续推进

适合你希望它自动多做几步时使用：

```text
按计划连续推进，直到完成 Phase 1 当前所有 Next Actions。
每完成一项就更新计划文件，再继续下一项。
如果遇到阻塞，先自己解决；解决不了再停下说明。
```

## 四、如何提扩展需求

扩展需求不要直接口头散说，建议按“目标 / 范围 / 约束 / 验收”结构提。

推荐写法：

```text
这是一个扩展需求，请先判断它属于哪个 Phase。
如果不属于当前 Phase：
1. 不要直接实现
2. 先更新 development-plan/phase-overview.md
3. 把需求写入对应 phase 文件
4. 再告诉我应该排到哪里

扩展需求：
- 目标：
- 范围：
- 约束：
- 验收标准：
```

## 五、什么时候让它先改计划，不先写代码

以下情况先让它更新计划：

1. 需求跨度明显跨多个 Phase。
2. 需求会影响协议、目录结构、运行方式。
3. 需求可能导致当前 Phase 返工。
4. 你自己还没想清楚优先级。

可直接这样说：

```text
先不要实现。
先评估这个需求对 development-plan 的影响，并更新 phase 文件与 current-status.md。
然后给我新的执行顺序。
```

## 六、推荐默认话术

最推荐你以后每次都用这一句开头：

```text
先读取 development-plan/current-status.md、development-plan/phase-overview.md、development-plan/session-handoff.md。
按当前 Active Phase 继续执行，不要跳阶段；完成后同步更新计划文件。
```
