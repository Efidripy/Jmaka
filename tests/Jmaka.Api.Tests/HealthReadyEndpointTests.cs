using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Jmaka.Api.Tests;

public sealed class HealthReadyEndpointTests
{
    private static DefaultHttpContext CreateHttpContext()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        var sp = services.BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = sp };
        context.Response.Body = new MemoryStream();
        return context;
    }

    [Fact]
    public async Task ReadyEndpoint_WhenHealthy_ReturnsReadyAndVersion()
    {
        var result = HealthEndpoints.CreateReadyResult(Array.Empty<string>());
        var context = CreateHttpContext();

        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);

        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync();

        // Must satisfy grep -q '"version"' in install.sh and update-instance.sh
        Assert.Contains("\"version\"", body);
        Assert.Contains("\"status\"", body);
        Assert.Contains("\"ready\"", body);

        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        Assert.Equal("ready", root.GetProperty("status").GetString());
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("version").GetString()));
    }

    [Fact]
    public async Task ReadyEndpoint_WhenUnhealthy_Returns503WithFailures()
    {
        var failures = new[] { "storage:upload", "ffmpeg" };
        var result = HealthEndpoints.CreateReadyResult(failures);
        var context = CreateHttpContext();

        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, context.Response.StatusCode);

        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync();

        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        Assert.Equal("not-ready", root.GetProperty("status").GetString());
        Assert.True(root.TryGetProperty("failures", out var failuresProp));
        Assert.Equal(2, failuresProp.GetArrayLength());
    }
}
