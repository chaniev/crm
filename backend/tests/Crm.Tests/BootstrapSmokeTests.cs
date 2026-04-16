using Crm.Application;
using Crm.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Crm.Tests;

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
    public void AddInfrastructure_registers_postgres_datasource()
    {
        var services = new ServiceCollection();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=crm;Username=crm;Password=crm"
            })
            .Build();

        services.AddInfrastructure(configuration);

        using var provider = services.BuildServiceProvider();

        Assert.NotNull(provider.GetRequiredService<NpgsqlDataSource>());
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
}
