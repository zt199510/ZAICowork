using System.Diagnostics;
using System.Text.Json;

namespace AIIde.Agent.Tools;

public sealed class BashTool : ITool
{
    private const int MaxOutputChars = 20_000;

    public async Task<ToolResult> ExecuteAsync(object input, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();

        string command;
        if (input is JsonElement je)
        {
            command = je.GetProperty("command").GetString() ?? "";
        }
        else
        {
            command = input.GetType().GetProperty("command")?.GetValue(input)?.ToString() ?? "";
        }

        if (string.IsNullOrWhiteSpace(command))
            return new ToolResult("failed", "缺少命令参数。", "", (int)sw.ElapsedMilliseconds, "invalid_input", "格式: bash: <command>");

        string fileName;
        string arguments;

        if (OperatingSystem.IsWindows())
        {
            fileName = "powershell.exe";
            arguments = $"-NoLogo -NoProfile -Command \"{command.Replace("\"", "\\\"")}\"";
        }
        else
        {
            fileName = "/bin/bash";
            arguments = $"-c \"{command.Replace("\"", "\\\"")}\"";
        }

        var psi = new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var proc = Process.Start(psi);
        if (proc is null)
            return new ToolResult("failed", "无法启动 shell 进程。", "", (int)sw.ElapsedMilliseconds, "process_start_failed");

        var stdout = await proc.StandardOutput.ReadToEndAsync(ct);
        var stderr = await proc.StandardError.ReadToEndAsync(ct);
        await proc.WaitForExitAsync(ct);

        var exitCode = proc.ExitCode;
        var combined = string.IsNullOrEmpty(stderr) ? stdout : $"{stdout}\n--- stderr ---\n{stderr}";
        var truncated = combined.Length > MaxOutputChars;
        var output = truncated ? combined[..MaxOutputChars] + "\n…[已截断]" : combined;

        var status = exitCode == 0 ? "completed" : "failed";
        var preview = exitCode == 0
            ? $"退出码 0, {stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries).Length} 行输出{(truncated ? ", 已截断" : "")}"
            : $"退出码 {exitCode}: {(stderr.Length > 80 ? stderr[..80] + "…" : stderr)}";

        var errorCode = exitCode != 0 ? "nonzero_exit" : null;
        var retryHint = exitCode != 0 ? "检查命令语法或权限后重试。" : null;

        return new ToolResult(status, preview, output, (int)sw.ElapsedMilliseconds, errorCode, retryHint) { ExitCode = exitCode, OutputTruncated = truncated };
    }
}
