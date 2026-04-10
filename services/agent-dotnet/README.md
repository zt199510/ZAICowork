# agent-dotnet

AIIde 的 .NET Agent MVP。

当前能力：

- 从 stdin 接收 JSON-RPC 请求
- 输出统一的 agent.event 流式事件
- 提供 run_started / token_delta / status / run_completed 示例链路

## 本地运行

```bash
dotnet run --project src/AIIde.Agent/AIIde.Agent.csproj
```
