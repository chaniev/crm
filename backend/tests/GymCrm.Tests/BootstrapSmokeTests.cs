using GymCrm.Application;
using GymCrm.Infrastructure;
using GymCrm.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GymCrm.Tests;

public class BootstrapSmokeTests
{
    [Fact]
    public void AddApplication_returns_original_service_collection()
    {
        var services = new ServiceCollection();

        var result = services.AddApplication();

        Assert.Same(services, result);
    }

    [Fact]
    public void AddInfrastructure_registers_postgres_datasource_and_ready_healthcheck()
    {
        var services = new ServiceCollection();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm"
            })
            .Build();

        services.AddInfrastructure(configuration);

        using var provider = services.BuildServiceProvider();

        Assert.NotNull(provider.GetRequiredService<NpgsqlDataSource>());

        var options = provider.GetRequiredService<IOptions<HealthCheckServiceOptions>>();
        Assert.Contains(options.Value.Registrations, check =>
            check.Name == "postgres" &&
            check.Tags.Contains("ready") &&
            check.FailureStatus == HealthStatus.Unhealthy);
    }

    [Fact]
    public void AddInfrastructure_throws_when_connection_string_is_missing()
    {
        var services = new ServiceCollection();
        var configuration = new ConfigurationBuilder().Build();

        var action = () => services.AddInfrastructure(configuration);

        var exception = Assert.Throws<InvalidOperationException>(action);

        Assert.Contains("Postgres", exception.Message);
    }

    [Fact]
    public void AddInfrastructure_registers_db_context_for_stage_one_model_smoke()
    {
        var services = new ServiceCollection();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm"
            })
            .Build();

        services.AddInfrastructure(configuration);

        using var provider = services.BuildServiceProvider();

        var dbContext = provider.GetRequiredService<GymCrmDbContext>();
        Assert.NotNull(dbContext);

        Assert.NotNull(dbContext.Model.FindEntityType("GymCrm.Domain.Users.User"));
        Assert.NotNull(dbContext.Model.FindEntityType("GymCrm.Domain.Clients.Client"));
        Assert.NotNull(dbContext.Model.FindEntityType("GymCrm.Domain.Clients.ClientMembership"));
        Assert.NotNull(dbContext.Model.FindEntityType("GymCrm.Domain.Groups.TrainingGroup"));
        Assert.NotNull(dbContext.Model.FindEntityType("GymCrm.Domain.Attendance.Attendance"));
        Assert.NotNull(dbContext.Model.FindEntityType("GymCrm.Domain.Audit.AuditLog"));
    }

    [Fact]
    public void Stage_one_migration_smoke_is_stable_without_postgresql()
    {
        var services = new ServiceCollection();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm"
            })
            .Build();

        services.AddInfrastructure(configuration);

        using var provider = services.BuildServiceProvider();
        var dbContext = provider.GetRequiredService<GymCrmDbContext>();

        Assert.NotNull(dbContext);
        Assert.Contains(dbContext.Database.GetMigrations(), migration => migration.EndsWith("_InitialCreate", StringComparison.Ordinal));
    }
}
