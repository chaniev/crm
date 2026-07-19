using System.Text.Json;
using GymCrm.Api.Auth;
using GymCrm.Api.SeedData;
using GymCrm.Api.Startup;
using GymCrm.Application;
using GymCrm.Infrastructure;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Diagnostics.HealthChecks;

if (args.Contains("--seed-test-data", StringComparer.Ordinal))
{
    var seedArgs = args
        .Where(argument => !string.Equals(argument, "--seed-test-data", StringComparison.Ordinal))
        .ToArray();

    try
    {
        var options = SeedDataOptionsParser.Parse(seedArgs);

        if (options.ShowHelp)
        {
            Console.WriteLine(SeedDataOptionsParser.Usage);
            return;
        }

        await using var seeder = new TestDataSeeder(options);
        var summary = await seeder.SeedAsync(CancellationToken.None);

        Console.WriteLine("Gym CRM test data seed completed.");
        Console.WriteLine($"Group types: {summary.GroupTypeCount}");
        Console.WriteLine($"Branches: {summary.BranchCount}");
        Console.WriteLine($"Halls: {summary.HallCount}");
        Console.WriteLine($"Coaches: {summary.CoachCount}");
        Console.WriteLine($"Administrators: {summary.AdministratorCount}");
        Console.WriteLine($"Training groups: {summary.GroupCount}");
        Console.WriteLine($"Clients: {summary.ClientCount}");
        Console.WriteLine($"Client photos: {summary.ClientPhotoCount}");
        Console.WriteLine($"Photo storage: {summary.PhotoStorageRootPath}");
        Console.WriteLine($"Seed user password: {summary.DefaultUserPassword}");
        return;
    }
    catch (SeedDataOptionsException exception)
    {
        Console.Error.WriteLine(exception.Message);
        Console.Error.WriteLine();
        Console.Error.WriteLine(SeedDataOptionsParser.Usage);
        Environment.ExitCode = 2;
        return;
    }
}

var builder = WebApplication.CreateBuilder(args);
builder.AddTechnicalLogging();
var secureCookiePolicy = AuthSessionDefaults.ResolveCookieSecurePolicy(
    builder.Environment,
    builder.Configuration);
var clientPhotoOptions = builder.Configuration
    .GetSection(ClientPhotoApiOptions.SectionName)
    .Get<ClientPhotoApiOptions>()
    ?? new ClientPhotoApiOptions();

builder.Services.AddApplication();
builder.Services
    .AddOptions<ClientPhotoApiOptions>()
    .Bind(builder.Configuration.GetSection(ClientPhotoApiOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddAuthorization(GymCrmAuthorizationPolicies.Configure);
builder.Services
    .AddAuthentication(AuthConstants.CookieScheme)
    .AddCookie(AuthConstants.CookieScheme, options =>
    {
        options.Cookie.Name = AuthConstants.AuthCookieName;
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = secureCookiePolicy;
        options.ExpireTimeSpan = AuthConstants.SessionLifetime;
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
    options.Cookie.SecurePolicy = secureCookiePolicy;
    options.HeaderName = AuthConstants.CsrfHeaderName;
});
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = clientPhotoOptions.MaxUploadSizeBytes;
});
builder.Services.Configure<BootstrapUserOptions>(
    builder.Configuration.GetSection(BootstrapUserOptions.SectionName));
builder.Services.Configure<BrandingOptions>(
    builder.Configuration.GetSection(BrandingOptions.SectionName));
builder.Services
    .AddOptions<BotInternalApiOptions>()
    .Bind(builder.Configuration.GetSection(BotInternalApiOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services
    .AddHealthChecks()
    .AddCheck(
        ApiHostingConstants.SelfHealthCheckName,
        () => HealthCheckResult.Healthy(StartupResources.SelfHealthCheckDescription),
        tags: [ApiHostingConstants.LiveHealthTag]);
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

await app.ApplyPersistenceStartupFlowAsync();
await app.SeedBootstrapUserAsync();

app.UseTechnicalRequestLogging();
app.UseAuthentication();
app.UseMiddleware<AuthenticatedUserMiddleware>();
app.UseAuthorization();

app.MapAppConfigEndpoints();
app.MapAuthEndpoints();
app.MapAccessEndpoints();
app.MapAdministratorEndpoints();
app.MapMembershipCatalogEndpoints();
app.MapUserEndpoints();
app.MapAuditLogEndpoints();
app.MapBranchEndpoints();
app.MapGroupTypeEndpoints();
app.MapClientEndpoints();
app.MapClientMessengerEndpoints();
app.MapClientPhotoEndpoints();
app.MapAttendanceEndpoints();
app.MapReportsEndpoints();
app.MapScheduleEndpoints();
app.MapBotInternalEndpoints();
GymCrm.Api.Auth.GroupEndpoints.MapGroupEndpoints(app);

app.MapGet(ApiHostingConstants.RootPath, () => Results.Ok(
    new ServiceMetadataResponse(
        ApiHostingConstants.ServiceName,
        app.Environment.EnvironmentName,
        new ServiceMetadataResponse.EndpointCollectionResponse(
            ApiHostingConstants.LiveHealthPath,
            ApiHostingConstants.ReadyHealthPath))));

app.MapHealthChecks(
    ApiHostingConstants.LiveHealthPath,
    CreateHealthCheckOptions(ApiHostingConstants.LiveHealthTag));

app.MapHealthChecks(
    ApiHostingConstants.ReadyHealthPath,
    CreateHealthCheckOptions(ApiHostingConstants.ReadyHealthTag));

app.Run();

return;

static Task WriteHealthResponse(HttpContext context, HealthReport report)
{
    context.Response.ContentType = "application/json";

    var payload = new HealthReportResponse(
        report.Status.ToString(),
        report.TotalDuration.ToString(),
        DateTimeOffset.UtcNow,
        report.Entries.ToDictionary(
            entry => entry.Key,
            entry => new HealthReportResponse.HealthCheckEntryResponse(
                entry.Value.Status.ToString(),
                entry.Value.Description,
                entry.Value.Duration.ToString())));

    return context.Response.WriteAsync(JsonSerializer.Serialize(payload));
}

static HealthCheckOptions CreateHealthCheckOptions(string tag)
{
    return new HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains(tag),
        ResponseWriter = WriteHealthResponse
    };
}

public partial class Program;
