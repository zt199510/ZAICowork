using System.Text.Json;

var jsonOptions = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
};

while (true)
{
    var line = Console.ReadLine();
    if (line is null)
    {
        break;
    }

    if (string.IsNullOrWhiteSpace(line))
    {
        continue;
    }

    JsonDocument request;
    try
    {
        request = JsonDocument.Parse(line);
    }
    catch
    {
        continue;
    }

    var id = request.RootElement.TryGetProperty("id", out var idElement)
        ? idElement.GetString() ?? Guid.NewGuid().ToString("N")
        : Guid.NewGuid().ToString("N");

    var runId = request.RootElement
        .GetProperty("params")
        .GetProperty("runId")
        .GetString() ?? Guid.NewGuid().ToString("N");

    var model = request.RootElement
        .GetProperty("params")
        .GetProperty("model")
        .GetString() ?? "unknown";

    WriteEvent(id, runId, "run_started", new { model }, jsonOptions);

    var segments = new[]
    {
        "已接收任务。",
        "正在分析需求边界。",
        "下一步将进入工具执行阶段。"
    };

    foreach (var segment in segments)
    {
        WriteEvent(id, runId, "token_delta", new { text = segment }, jsonOptions);
    }

    WriteEvent(
        id,
        runId,
        "status",
        new
        {
            state = "completed",
            message = "Agent loop MVP run finished"
        },
        jsonOptions
    );

    WriteEvent(
        id,
        runId,
        "run_completed",
        new
        {
            outputSummary = "MVP stream emitted successfully"
        },
        jsonOptions
    );
}

static void WriteEvent(
    string id,
    string runId,
    string type,
    object payload,
    JsonSerializerOptions jsonOptions
)
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
