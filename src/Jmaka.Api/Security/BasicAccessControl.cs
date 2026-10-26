using System.Security.Cryptography;
using System.Text;

namespace Jmaka.Api.Security;

public sealed record BasicAccessControlOptions(
    bool Enabled,
    string Username,
    string Password)
{
    public static BasicAccessControlOptions FromEnvironment(bool isDevelopment)
    {
        var allowAnonymous = string.Equals(
            Environment.GetEnvironmentVariable("JMAKA_ALLOW_ANONYMOUS"),
            "true",
            StringComparison.OrdinalIgnoreCase);

        if (isDevelopment || allowAnonymous)
        {
            return new BasicAccessControlOptions(false, string.Empty, string.Empty);
        }

        var username = Environment.GetEnvironmentVariable("JMAKA_AUTH_USERNAME")?.Trim();
        if (string.IsNullOrWhiteSpace(username))
        {
            username = "jmaka";
        }

        var password = Environment.GetEnvironmentVariable("JMAKA_AUTH_PASSWORD");
        if (string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException(
                "JMAKA_AUTH_PASSWORD is required outside Development. " +
                "Set JMAKA_ALLOW_ANONYMOUS=true only for an explicitly trusted network.");
        }

        return new BasicAccessControlOptions(true, username, password);
    }
}

public sealed class BasicAccessControlMiddleware
{
    private const string Challenge = "Basic realm=\"Jmaka\", charset=\"UTF-8\"";

    private readonly RequestDelegate _next;
    private readonly BasicAccessControlOptions _options;

    public BasicAccessControlMiddleware(RequestDelegate next, BasicAccessControlOptions options)
    {
        _next = next;
        _options = options;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!_options.Enabled || HasValidCredentials(context.Request.Headers.Authorization))
        {
            await _next(context);
            return;
        }

        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        context.Response.Headers.WWWAuthenticate = Challenge;
        await context.Response.WriteAsJsonAsync(new { error = "authentication required" });
    }

    internal bool HasValidCredentials(string? authorization)
    {
        if (string.IsNullOrWhiteSpace(authorization)
            || !authorization.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        try
        {
            var encoded = authorization[6..].Trim();
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(encoded));
            var separator = decoded.IndexOf(':');
            if (separator <= 0)
            {
                return false;
            }

            var username = decoded[..separator];
            var password = decoded[(separator + 1)..];
            return FixedTimeEquals(username, _options.Username)
                & FixedTimeEquals(password, _options.Password);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static bool FixedTimeEquals(string actual, string expected)
    {
        var actualHash = SHA256.HashData(Encoding.UTF8.GetBytes(actual));
        var expectedHash = SHA256.HashData(Encoding.UTF8.GetBytes(expected));
        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }
}

public static class BasicAccessControlExtensions
{
    public static IApplicationBuilder UseJmakaAccessControl(
        this IApplicationBuilder app,
        BasicAccessControlOptions options)
    {
        return app.UseMiddleware<BasicAccessControlMiddleware>(options);
    }
}
