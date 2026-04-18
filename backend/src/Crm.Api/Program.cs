using System.Text.Json;
using Crm.Api.Auth;
using Crm.Api.Startup;
using Crm.Application;
using Crm.Infrastructure;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();
builder.Services.AddAuthorization(CrmAuthorizationPolicies.Configure);
builder.Services
    .AddAuthentication(AuthConstants.CookieScheme)
    .AddCookie(AuthConstants.CookieScheme, options =>
    {
        options.Cookie.Name = AuthConstants.AuthCookieName;
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            },
            OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAntiforgery(options =>
{
    options.Cookie.Name = AuthConstants.CsrfCookieName;
    options.Cookie.HttpOnly = false;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
    options.HeaderName = AuthConstants.CsrfHeaderName;
});
builder.Services.Configure<BootstrapUserOptions>(
    builder.Configuration.GetSection(BootstrapUserOptions.SectionName));
builder.Services
    .AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy("API is running."), tags: ["live"]);
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

await app.ApplyPersistenceStartupFlowAsync();
await app.SeedBootstrapUserAsync();

app.UseAuthentication();
app.UseMiddleware<AuthenticatedUserMiddleware>();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapAccessEndpoints();
app.MapUserEndpoints();

app.MapGet("/", () => Results.Ok(new
{
    service = "crm-backend",
    environment = app.Environment.EnvironmentName,
    endpoints = new
    {
        live = "/health/live",
        ready = "/health/ready"
    }
}));

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live"),
    ResponseWriter = WriteHealthResponse
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = WriteHealthResponse
});

app.Run();

return;

static Task WriteHealthResponse(HttpContext context, HealthReport report)
{
    context.Response.ContentType = "application/json";

    var payload = new
    {
        status = report.Status.ToString(),
        totalDuration = report.TotalDuration.ToString(),
        timestamp = DateTimeOffset.UtcNow,
        checks = report.Entries.ToDictionary(
            entry => entry.Key,
            entry => new
            {
                status = entry.Value.Status.ToString(),
                description = entry.Value.Description,
                duration = entry.Value.Duration.ToString()
            })
    };

    return context.Response.WriteAsync(JsonSerializer.Serialize(payload));
}

public partial class Program;
