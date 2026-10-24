using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;

namespace GymCrm.Tests;

internal sealed class BranchSettingsAppFactory(string? connectionString = null, IInterceptor? interceptor = null, string? botServiceToken = null, Action<IServiceCollection>? configureServices = null)
    : WebApplicationFactory<Program>
{
    public const string Password = "branch-settings-password";
    public Guid OwnBranchId { get; } = Guid.NewGuid();
    public Guid ForeignBranchId { get; } = Guid.NewGuid();
    public Guid OwnHallId { get; } = Guid.NewGuid();
    public Guid ForeignHallId { get; } = Guid.NewGuid();
    public string PhotoStorageRootPath { get; } = Path.Combine(Path.GetTempPath(), $"crm-scope-photos-{Guid.NewGuid():N}");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Postgres"] = connectionString ?? "Host=localhost;Database=unused;Username=unused;Password=unused",
            ["Persistence:ApplyMigrationsOnStartup"] = (connectionString is not null).ToString(),
            ["BootstrapUser:Login"] = "bootstrap-branch-settings",
            ["BotInternalApi:Enabled"] = (botServiceToken is not null).ToString(),
            ["BotInternalApi:Token"] = botServiceToken,
            ["ClientPhoto:StorageRootPath"] = PhotoStorageRootPath
        }));
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
            services.RemoveAll<GymCrmDbContext>();
            services.RemoveAll<IDbContextOptionsConfiguration<GymCrmDbContext>>();
            if (connectionString is not null)
            {
                services.RemoveAll<NpgsqlDataSource>();
                services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));
            }
            var databaseName = $"branch-settings-{Guid.NewGuid():N}";
            services.AddDbContext<GymCrmDbContext>(options =>
            {
                if (connectionString is null)
                {
                    options.UseInMemoryDatabase(databaseName);
                }
                else
                {
                    options.UseNpgsql(connectionString);
                }
                if (interceptor is not null)
                {
                    options.AddInterceptors(interceptor);
                }
            });
            configureServices?.Invoke(services);
        });
    }

    public async Task SeedAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwords = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
        var now = DateTimeOffset.UtcNow;
        db.Branches.AddRange(
            new Branch { Id = OwnBranchId, Name = "Own branch", CreatedAt = now, UpdatedAt = now },
            new Branch { Id = ForeignBranchId, Name = "Foreign branch", CreatedAt = now, UpdatedAt = now });
        db.Halls.AddRange(
            new Hall { Id = OwnHallId, BranchId = OwnBranchId, Name = "Own hall", CreatedAt = now, UpdatedAt = now },
            new Hall { Id = ForeignHallId, BranchId = ForeignBranchId, Name = "Foreign hall", CreatedAt = now, UpdatedAt = now });
        foreach (var role in Enum.GetValues<UserRole>())
        {
            var user = new User
            {
                Id = Guid.NewGuid(),
                Login = role.ToString(),
                FullName = role.ToString(),
                Role = role,
                BranchId = role == UserRole.Administrator ? OwnBranchId : null,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            user.PasswordHash = passwords.HashPassword(user, Password);
            db.Users.Add(user);
        }
        await db.SaveChangesAsync();
    }

    public async Task<(HttpClient Client, string Token)> LoginAsync(UserRole? role)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = ClientOptions.BaseAddress, AllowAutoRedirect = false, HandleCookies = true });
        var session = await client.GetFromJsonAsync<JsonElement>("/auth/session");
        if (role.HasValue)
        {
            using var response = await SendAsync(client, HttpMethod.Post, "/auth/login",
                new { login = role.ToString(), password = Password }, session.GetProperty("csrfToken").GetString());
            response.EnsureSuccessStatusCode();
            session = await response.Content.ReadFromJsonAsync<JsonElement>();
        }
        return (client, session.GetProperty("csrfToken").GetString()!);
    }

    public static async Task<HttpResponseMessage> SendAsync(HttpClient client, HttpMethod method, string path, object? body, string? token)
    {
        using var request = new HttpRequestMessage(method, path);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        if (token is not null)
        {
            request.Headers.Add("X-CSRF-TOKEN", token);
        }
        return await client.SendAsync(request);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing && Directory.Exists(PhotoStorageRootPath))
        {
            Directory.Delete(PhotoStorageRootPath, recursive: true);
        }
    }
}
