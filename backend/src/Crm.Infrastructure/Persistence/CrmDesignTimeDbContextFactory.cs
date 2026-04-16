using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Crm.Infrastructure.Persistence;

public sealed class CrmDesignTimeDbContextFactory : IDesignTimeDbContextFactory<CrmDbContext>
{
    public CrmDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        var apiProjectPath = ResolveApiProjectPath();

        var configuration = new ConfigurationBuilder()
            .SetBasePath(apiProjectPath)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("Postgres");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("Connection string 'Postgres' is not configured.");
        }

        var optionsBuilder = new DbContextOptionsBuilder<CrmDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new CrmDbContext(optionsBuilder.Options);
    }

    private static string ResolveApiProjectPath()
    {
        var candidatePaths = new[]
        {
            Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "../Crm.Api")),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../Crm.Api"))
        };

        foreach (var candidatePath in candidatePaths)
        {
            if (Directory.Exists(candidatePath))
            {
                return candidatePath;
            }
        }

        throw new DirectoryNotFoundException("Unable to resolve the Crm.Api project path for design-time DbContext creation.");
    }
}
