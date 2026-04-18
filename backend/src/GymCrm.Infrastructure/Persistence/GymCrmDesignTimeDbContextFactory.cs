using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace GymCrm.Infrastructure.Persistence;

public sealed class GymCrmDesignTimeDbContextFactory : IDesignTimeDbContextFactory<GymCrmDbContext>
{
    public GymCrmDbContext CreateDbContext(string[] args)
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

        var optionsBuilder = new DbContextOptionsBuilder<GymCrmDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new GymCrmDbContext(optionsBuilder.Options);
    }

    private static string ResolveApiProjectPath()
    {
        var candidatePaths = new[]
        {
            Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "../GymCrm.Api")),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../GymCrm.Api"))
        };

        foreach (var candidatePath in candidatePaths)
        {
            if (Directory.Exists(candidatePath))
            {
                return candidatePath;
            }
        }

        throw new DirectoryNotFoundException("Unable to resolve the GymCrm.Api project path for design-time DbContext creation.");
    }
}
