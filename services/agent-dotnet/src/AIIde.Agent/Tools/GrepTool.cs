using System.Diagnostics;
using System.Text.Json;

namespace AIIde.Agent.Tools;

public sealed class GrepTool : ITool
{
    private const int MaxOutputChars = 20_000;

    public async Task<ToolResult> ExecuteAsync(object input, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();

        string pattern, path;
        if (input is JsonElement je)
        {
            pattern = je.GetProperty("pattern").GetString() ?? "";
            path = je.TryGetProperty("path", out var pEl) ? pEl.GetString() ?? "." : ".";
        }
        else
        {
            pattern = input.GetType().GetProperty("pattern")?.GetValue(input)?.ToString() ?? "";
            path = input.GetType().GetProperty("path")?.GetValue(input)?.ToString() ?? ".";
        }

        if (string.IsNullOrWhiteSpace(pattern))
            return new ToolResult("failed", "缺少搜索模式。", "", (int)sw.ElapsedMilliseconds, "invalid_input", "格式: grep: <pattern> [path]");

        // Try ripgrep first, fall back to findstr on Windows
        var (executable, args) = FindGrepExecutable(pattern, path);
        if (executable is null)
            return new ToolResult("failed", "未找到 rg 或 findstr。", "", (int)sw.ElapsedMilliseconds, "tool_unavailable", "请安装 ripgrep (rg) 后重试。");

        var psi = new ProcessStartInfo
        {
            FileName = executable,
            Arguments = args,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var proc = Process.Start(psi);
        if (proc is null)
            return new ToolResult("failed", "无法启动 grep 进程。", "", (int)sw.ElapsedMilliseconds, "process_start_failed", "检查系统环境后重试。");

        var stdout = await proc.StandardOutput.ReadToEndAsync(ct);
        var stderr = await proc.StandardError.ReadToEndAsync(ct);
        await proc.WaitForExitAsync(ct);

        var exitCode = proc.ExitCode;
        var truncated = stdout.Length > MaxOutputChars;
        var output = truncated ? stdout[..MaxOutputChars] + "\n…[已截断]" : stdout;
        var matchCount = stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries).Length;
        var preview = exitCode == 0
            ? $"找到 {matchCount} 处匹配{(truncated ? ", 已截断" : "")}"
            : matchCount > 0 ? $"找到 {matchCount} 处匹配{(truncated ? ", 已截断" : "")}" : "无匹配结果";

        var status = (exitCode == 0 || matchCount > 0) ? "completed" : "completed";
        return new ToolResult(status, preview, output, (int)sw.ElapsedMilliseconds) { ExitCode = exitCode, OutputTruncated = truncated };
    }

    private static (string? executable, string args) FindGrepExecutable(string pattern, string path)
    {
        // Try rg
        try
        {
            var test = Process.Start(new ProcessStartInfo
            {
                FileName = "rg",
                Arguments = "--version",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            });
            test?.WaitForExit(2000);
            test?.Dispose();
            if (test is not null)
                return ("rg", $"--no-heading --line-number --color never -e \"{pattern}\" \"{path}\"");
        }
        catch { /* rg not available */ }

        // Fallback to findstr on Windows
        if (OperatingSystem.IsWindows())
        {
            return ("findstr", $"/s /n /i /c:\"{pattern}\" \"{path}\\*\"");
        }

        return (null, "");
    }
}
