namespace AIIde.Agent.Tools;

public static class PromptParser
{
    private static readonly string[] Prefixes = ["read:", "grep:", "bash:"];

    public static List<ToolInvocation> Parse(string prompt)
    {
        var results = new List<ToolInvocation>();
        var lines = prompt.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        foreach (var rawLine in lines)
        {
            var line = rawLine.Trim();
            if (string.IsNullOrEmpty(line)) continue;

            string? matchedPrefix = null;
            foreach (var prefix in Prefixes)
            {
                if (line.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                {
                    matchedPrefix = prefix;
                    break;
                }
            }

            if (matchedPrefix is null) continue;

            var toolName = matchedPrefix[..^1]; // remove trailing ':'
            var argument = line[matchedPrefix.Length..].Trim();

            if (string.IsNullOrEmpty(argument)) continue;

            object input;
            string inputSummary;

            switch (toolName)
            {
                case "read":
                    input = new { path = argument };
                    inputSummary = $"read {argument}";
                    break;
                case "grep":
                    var parts = argument.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
                    var pattern = parts[0];
                    var path = parts.Length > 1 ? parts[1] : ".";
                    input = new { pattern, path };
                    inputSummary = $"grep {pattern} {path}";
                    break;
                case "bash":
                    input = new { command = argument };
                    inputSummary = $"bash: {(argument.Length > 60 ? argument[..60] + "…" : argument)}";
                    break;
                default:
                    continue;
            }

            results.Add(new ToolInvocation(toolName, input, inputSummary));
        }

        return results;
    }
}
