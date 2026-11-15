using System.Text.Json;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

// A disposable real HTTP/PostgreSQL fixture owned by the Playwright process.
public class ClientImportBrowserHostTests
{
    [Fact]
    public async Task Serve_isolated_import_browser_fixture_when_requested()
    {
        var target = Environment.GetEnvironmentVariable("TASK196_BROWSER_HOST_FILE");
        if (string.IsNullOrEmpty(target)) return;
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString());
        factory.UseKestrel(0);
        await factory.SeedAsync();
        await ClientImportPostgreSqlTests.SeedGroupAsync(factory);
        var address = factory.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
        await File.WriteAllTextAsync(target, JsonSerializer.Serialize(new { address, branchId = factory.OwnBranchId }));
        using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(15));
        while (!File.Exists(target + ".stop")) await Task.Delay(200, timeout.Token);
    }
}
