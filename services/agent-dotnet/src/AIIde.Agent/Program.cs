using System.Text.Json;
using AIIde.Agent.Tools;

var jsonOptions = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
};

var tools = new Dictionary<string, ITool>(StringComparer.OrdinalIgnoreCase)
{
    ["read"] = new ReadTool(),
    ["grep"] = new GrepTool(),
    ["bash"] = new BashTool()
};

var runTimeout = TimeSpan.FromSeconds(120);
var toolTimeout = TimeSpan.FromSeconds(30);

while (true)
{
    var line = await Console.In.ReadLineAsync();
    if (line is null) break;
    if (string.IsNullOrWhiteSpace(line)) continue;

    JsonDocument request;
    try { request = JsonDocument.Parse(line); }
    catch { continue; }

    var id = request.RootElement.TryGetProperty("id", out var idEl)
        ? idEl.GetString() ?? Guid.NewGuid().ToString("N")
        : Guid.NewGuid().ToString("N");

    var runId = request.RootElement
        .GetProperty("params").GetProperty("runId").GetString()
        ?? Guid.NewGuid().ToString("N");

    var model = request.RootElement
        .GetProperty("params").GetProperty("model").GetString()
        ?? "unknown";

    var prompt = request.RootElement
        .GetProperty("params").GetProperty("prompt").GetString()
        ?? "";

    using var runCts = new CancellationTokenSource(runTimeout);

    WriteLog(id, runId, "info", $"Received agent.run request (model={model}).", jsonOptions);
    WriteEvent(id, runId, "run_started", new { model }, jsonOptions);

    var invocations = PromptParser.Parse(prompt);
    WriteLog(id, runId, "info", $"Parsed {invocations.Count} tool invocation(s).", jsonOptions);

    if (invocations.Count == 0)
    {
        WriteLog(id, runId, "info", "No tool invocations detected; returning help text.", jsonOptions);
        var help = "支持的命令格式：\n• read: <path>\n• grep: <pattern> [path]\n• bash: <command>\n\n"
                 + "每行一条命令，示例：\nread: src/index.ts\ngrep: TODO packages/\nbash: Get-Location";
        WriteEvent(id, runId, "token_delta", new { text = help }, jsonOptions);
    }
    else
    {
        foreach (var inv in invocations)
        {
            if (runCts.IsCancellationRequested) break;

            var callId = Guid.NewGuid().ToString("N")[..12];

            WriteEvent(id, runId, "tool_call_started", new
            {
                callId,
                toolName = inv.ToolName,
                input = inv.Input,
                inputSummary = inv.InputSummary
            }, jsonOptions);

            ToolResult result;
            try
            {
                using var toolCts = CancellationTokenSource.CreateLinkedTokenSource(runCts.Token);
                toolCts.CancelAfter(toolTimeout);
                result = await tools[inv.ToolName].ExecuteAsync(inv.Input, toolCts.Token);
            }
            catch (OperationCanceledException)
            {
                WriteLog(id, runId, "warn", $"Tool '{inv.ToolName}' timed out after {toolTimeout.TotalSeconds:0} seconds.", jsonOptions);
                result = new ToolResult("failed", "[超时] 工具执行超过 30 秒已取消。", "", -1, "tool_timeout", "请缩小操作范围或增大超时限制。");
            }
            catch (Exception ex)
            {
                WriteLog(id, runId, "error", $"Tool '{inv.ToolName}' threw an exception: {ex.Message}", jsonOptions);
                result = new ToolResult("failed", ex.Message, "", -1, "tool_exception", "检查输入参数后重试。");
            }

            WriteEvent(id, runId, "tool_call_completed", new
            {
                callId,
                toolName = inv.ToolName,
                status = result.Status,
                resultPreview = result.ResultPreview,
                outputText = result.OutputText,
                outputTruncated = result.OutputTruncated,
                durationMs = result.DurationMs,
                exitCode = result.ExitCode,
                errorCode = result.ErrorCode,
                retryHint = result.RetryHint
            }, jsonOptions);

            if (result.Status == "completed")
            {
                var summary = $"✔ {inv.ToolName}: {result.ResultPreview}";
                WriteEvent(id, runId, "token_delta", new { text = summary + "\n" }, jsonOptions);
            }
            else
            {
                var summary = $"✘ {inv.ToolName}: {result.ResultPreview}";
                if (!string.IsNullOrEmpty(result.RetryHint))
                    summary += $"\n  提示: {result.RetryHint}";
                WriteEvent(id, runId, "token_delta", new { text = summary + "\n" }, jsonOptions);
            }
        }
    }

    WriteLog(id, runId, "info", "Run finished normally.", jsonOptions);
    WriteEvent(id, runId, "status", new { state = "completed", message = "Agent run finished" }, jsonOptions);
    WriteEvent(id, runId, "run_completed", new { outputSummary = $"执行了 {invocations.Count} 个工具调用。" }, jsonOptions);
}

static void WriteLog(string id, string runId, string level, string message, JsonSerializerOptions jsonOptions)
{
    WriteEvent(id, runId, "log", new
    {
        source = "agent",
        level,
        message
    }, jsonOptions);
}

static void WriteEvent(string id, string runId, string type, object payload, JsonSerializerOptions jsonOptions)
{
    var envelope = new
    {
        id,
        method = "agent.event",
        @params = new
        {
            type,
            runId,
            timestamp = DateTimeOffset.UtcNow,
            payload
        }
    };
    Console.WriteLine(JsonSerializer.Serialize(envelope, jsonOptions));
}
