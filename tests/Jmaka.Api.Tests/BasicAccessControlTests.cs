using System.Text;
using Jmaka.Api.Security;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Jmaka.Api.Tests;

public sealed class BasicAccessControlTests
{
    [Fact]
    public async Task MissingCredentials_AreRejectedWithChallenge()
    {
        var called = false;
        var middleware = CreateMiddleware(() => called = true);
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        Assert.False(called);
        Assert.Equal(StatusCodes.Status401Unauthorized, context.Response.StatusCode);
        Assert.Equal("Basic realm=\"Jmaka\", charset=\"UTF-8\"", context.Response.Headers.WWWAuthenticate);
    }

    [Fact]
    public async Task ValidCredentials_ReachApplication()
    {
        var called = false;
        var middleware = CreateMiddleware(() => called = true);
        var context = new DefaultHttpContext();
        context.Request.Headers.Authorization = CreateAuthorization("operator", "correct horse battery staple");

        await middleware.InvokeAsync(context);

        Assert.True(called);
    }

    [Theory]
    [InlineData("operator", "wrong")]
    [InlineData("wrong", "correct horse battery staple")]
    [InlineData("operator", "")]
    public async Task InvalidCredentials_AreRejected(string username, string password)
    {
        var called = false;
        var middleware = CreateMiddleware(() => called = true);
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        context.Request.Headers.Authorization = CreateAuthorization(username, password);

        await middleware.InvokeAsync(context);

        Assert.False(called);
        Assert.Equal(StatusCodes.Status401Unauthorized, context.Response.StatusCode);
    }

    private static BasicAccessControlMiddleware CreateMiddleware(Action onCalled)
    {
        return new BasicAccessControlMiddleware(
            _ =>
            {
                onCalled();
                return Task.CompletedTask;
            },
            new BasicAccessControlOptions(true, "operator", "correct horse battery staple"));
    }

    private static string CreateAuthorization(string username, string password)
    {
        return "Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes($"{username}:{password}"));
    }
}
