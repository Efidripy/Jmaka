using System.Net;
using System.Text;
using System.Threading.RateLimiting;
using Jmaka.Api.Security;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Jmaka.Api.Tests;

public sealed class RateLimiterAccessControlOrderTests
{
    [Fact]
    public async Task RateLimiter_Before_AccessControl_PreventsBruteForceBypass()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
                RateLimitPartition.GetFixedWindowLimiter(
                    ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 1,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0,
                        AutoReplenishment = true
                    }));
        });

        var sp = services.BuildServiceProvider();
        var app = new ApplicationBuilder(sp);

        // Correct order: RateLimiter must run BEFORE AccessControl
        app.UseRateLimiter();
        app.UseJmakaAccessControl(new BasicAccessControlOptions(true, "operator", "correct-horse-battery-staple"));
        app.Run(ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status200OK;
            return Task.CompletedTask;
        });

        var pipeline = app.Build();

        // 1st request with invalid credentials: rate limiter admits request (consumes the 1 permit),
        // access control rejects with 401 Unauthorized.
        var ctx1 = new DefaultHttpContext { RequestServices = sp };
        ctx1.Connection.RemoteIpAddress = IPAddress.Parse("10.0.0.1");
        ctx1.Request.Headers.Authorization = "Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes("operator:bad-password-1"));
        ctx1.Response.Body = new MemoryStream();

        await pipeline(ctx1);
        Assert.Equal(StatusCodes.Status401Unauthorized, ctx1.Response.StatusCode);

        // 2nd request with invalid credentials: rate limit is now exhausted for this IP.
        // Rate limiter blocks request with 429 Too Many Requests before access control is reached.
        // If access control had run before rate limiter, 401 would short-circuit without consuming rate limit.
        var ctx2 = new DefaultHttpContext { RequestServices = sp };
        ctx2.Connection.RemoteIpAddress = IPAddress.Parse("10.0.0.1");
        ctx2.Request.Headers.Authorization = "Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes("operator:bad-password-2"));
        ctx2.Response.Body = new MemoryStream();

        await pipeline(ctx2);
        Assert.Equal(StatusCodes.Status429TooManyRequests, ctx2.Response.StatusCode);
    }
}
