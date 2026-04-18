using GymCrm.Application.Authorization;
using GymCrm.Application.Audit;
using GymCrm.Application.Clients;
using GymCrm.Application.Security;
using GymCrm.Infrastructure.Authorization;
using GymCrm.Infrastructure.Audit;
using GymCrm.Infrastructure.Clients;
using GymCrm.Infrastructure.HealthChecks;
using GymCrm.Infrastructure.Persistence;
using GymCrm.Infrastructure.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GymCrm.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Postgres");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("Connection string 'Postgres' is not configured.");
        }

        services.AddSingleton(_ =>
        {
            var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
            return dataSourceBuilder.Build();
        });

        services.AddDbContext<GymCrmDbContext>(options =>
            options.UseNpgsql(connectionString));

        services.AddScoped<IPasswordHashService, PasswordHashService>();
        services.AddScoped<IAuditLogService, AuditLogService>();
        services.AddScoped<IAccessScopeService, AccessScopeService>();
        services.AddScoped<IClientMembershipService, ClientMembershipService>();
        services.Configure<ClientPhotoStorageOptions>(
            configuration.GetSection(ClientPhotoStorageOptions.SectionName));
        services.AddScoped<IClientPhotoImageProcessor, MagickClientPhotoImageProcessor>();
        services.AddScoped<IClientPhotoService, ClientPhotoService>();

        services
            .AddHealthChecks()
            .AddCheck<PostgresConnectivityHealthCheck>(
                "postgres",
                tags: ["ready"]);

        return services;
    }
}
