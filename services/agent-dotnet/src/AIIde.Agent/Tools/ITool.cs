using System.Text.Json.Serialization;

namespace AIIde.Agent.Tools;

public interface ITool
{
    Task<ToolResult> ExecuteAsync(object input, CancellationToken ct);
}

public sealed record ToolResult(
    string Status,
    string ResultPreview,
    string OutputText,
    int DurationMs,
    string? ErrorCode = null,
    string? RetryHint = null)
{
    public int? ExitCode { get; init; }
    public bool OutputTruncated { get; init; }
}

public sealed record ToolInvocation(
    string ToolName,
    object Input,
    string InputSummary);
