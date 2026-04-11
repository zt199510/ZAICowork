using System.Diagnostics;
using System.Text.Json;

namespace AIIde.Agent.Tools;

public sealed class ReadTool : ITool
{
    private const int MaxOutputChars = 20_000;

    public async Task<ToolResult> ExecuteAsync(object input, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();

        string path;
        if (input is JsonElement je)
        {
            path = je.GetProperty("path").GetString() ?? "";
        }
        else
        {
            var props = input.GetType().GetProperty("path");
            path = props?.GetValue(input)?.ToString() ?? "";
        }

        if (string.IsNullOrWhiteSpace(path))
            return new ToolResult("failed", "缺少文件路径参数。", "", (int)sw.ElapsedMilliseconds, "invalid_input", "格式: read: <path>");

        // Normalize and constrain to cwd
        var fullPath = Path.GetFullPath(path);
        var cwd = Directory.GetCurrentDirectory();
        if (!fullPath.StartsWith(cwd, StringComparison.OrdinalIgnoreCase))
            return new ToolResult("failed", "路径超出工作目录范围。", "", (int)sw.ElapsedMilliseconds, "path_outside_root", "请使用相对于仓库根目录的路径。");

        if (!File.Exists(fullPath))
            return new ToolResult("failed", $"文件不存在: {path}", "", (int)sw.ElapsedMilliseconds, "file_not_found", "确认路径拼写并重试。");

        var content = await File.ReadAllTextAsync(fullPath, ct);
        var truncated = content.Length > MaxOutputChars;
        var output = truncated ? content[..MaxOutputChars] + "\n…[已截断]" : content;
        var lineCount = content.Split('\n').Length;
        var preview = $"{path} ({lineCount} 行{(truncated ? ", 已截断" : "")})";

        return new ToolResult("completed", preview, output, (int)sw.ElapsedMilliseconds) { OutputTruncated = truncated };
    }
}
