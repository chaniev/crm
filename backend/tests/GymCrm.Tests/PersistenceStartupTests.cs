using GymCrm.Api.Startup;
using GymCrm.Domain.Branches;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public class PersistenceStartupTests
{
    [Fact]
    public async Task Disabled_startup_does_not_resolve_database_context()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Configuration["Persistence:ApplyMigrationsOnStartup"] = "false";
        builder.Services.AddScoped<GymCrmDbContext>(_ => throw new InvalidOperationException("Database must not be resolved."));
        await using var app = builder.Build();

        await app.ApplyPersistenceStartupFlowAsync();
    }

    [Theory]
    [InlineData(null)]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Migration_failure_is_logged_and_obeys_startup_failure_policy(bool? failStartup)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Persistence:ApplyMigrationsOnStartup"] = "true",
            ["Persistence:FailStartupOnMigrationError"] = failStartup?.ToString()
        });
        // InMemory deliberately cannot execute relational migrations.
        builder.Services.AddDbContext<GymCrmDbContext>(options => options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        using var logger = new FailureLogger();
        builder.Logging.ClearProviders();
        builder.Logging.AddProvider(logger);
        await using var app = builder.Build();

        if (failStartup != false)
        {
            var failure = await Record.ExceptionAsync(() => app.ApplyPersistenceStartupFlowAsync());
            Assert.NotNull(failure);
            Assert.IsType<InvalidOperationException>(failure.GetBaseException());
            Assert.Same(failure.GetBaseException(), Assert.Single(logger.Exceptions));
        }
        else
        {
            await app.ApplyPersistenceStartupFlowAsync();
        }

        Assert.Single(logger.Exceptions);
        Assert.IsType<InvalidOperationException>(logger.Exceptions[0]);
    }

    [Fact]
    public async Task Enabled_startup_applies_all_migrations_and_repeated_startup_preserves_data()
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddDbContext<GymCrmDbContext>(options => options.UseNpgsql(postgres.GetConnectionString()));
        await using var app = builder.Build();

        await app.ApplyPersistenceStartupFlowAsync();
        var branchId = Guid.NewGuid();
        string[] applied;
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            applied = (await db.Database.GetAppliedMigrationsAsync()).ToArray();
            Assert.NotEmpty(applied);
            Assert.Equal(db.Database.GetMigrations(), applied);
            var timestamp = new DateTimeOffset(2026, 10, 24, 8, 0, 0, TimeSpan.Zero);
            db.Branches.Add(new Branch { Id = branchId, Name = "Retained branch", CreatedAt = timestamp, UpdatedAt = timestamp });
            await db.SaveChangesAsync();
        }

        await app.ApplyPersistenceStartupFlowAsync();

        using var verificationScope = app.Services.CreateScope();
        var verificationDb = verificationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(applied, await verificationDb.Database.GetAppliedMigrationsAsync());
        Assert.Equal("Retained branch", (await verificationDb.Branches.SingleAsync(branch => branch.Id == branchId)).Name);
    }

    private sealed class FailureLogger : ILoggerProvider, ILogger
    {
        public List<Exception?> Exceptions { get; } = [];

        public ILogger CreateLogger(string categoryName) => this;
        public bool IsEnabled(LogLevel logLevel) => logLevel == LogLevel.Error;
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public void Dispose() { }

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (logLevel == LogLevel.Error)
            {
                Exceptions.Add(exception);
            }
        }
    }
}
