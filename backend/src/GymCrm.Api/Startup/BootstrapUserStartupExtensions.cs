using GymCrm.Api.Auth;
using GymCrm.Application.Security;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace GymCrm.Api.Startup;

internal static class BootstrapUserStartupExtensions
{
    private const string DefaultPassword = "12345678";

    public static async Task SeedBootstrapUserAsync(
        this WebApplication app,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(app);

        using var scope = app.Services.CreateScope();

        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("GymCrm.Api.BootstrapUser");

        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

        var options = scope.ServiceProvider.GetRequiredService<IOptions<BootstrapUserOptions>>().Value;
        var login = string.IsNullOrWhiteSpace(options.Login) ? "headcoach" : options.Login.Trim();
        var fullName = string.IsNullOrWhiteSpace(options.FullName)
            ? StartupResources.BootstrapFullNameDefault
            : options.FullName.Trim();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        if (await dbContext.Users.AnyAsync(user => user.Login == login, cancellationToken))
        {
            logger.LogDebug(
                StartupResources.BootstrapUserLoginAlreadyExistsLog,
                login);

            return;
        }

        if (await dbContext.Users.AnyAsync(cancellationToken))
        {
            logger.LogDebug(
                StartupResources.BootstrapUserDatabaseAlreadyHasUsersLog);

            return;
        }

        var now = DateTimeOffset.UtcNow;
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = fullName,
            Login = login,
            Role = UserRole.HeadCoach,
            MustChangePassword = true,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = passwordHashService.HashPassword(user, DefaultPassword);

        try
        {
            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsBootstrapLoginConflict(exception))
        {
            logger.LogWarning(
                StartupResources.BootstrapUserConcurrentCreationSkippedLog,
                login);

            return;
        }

        logger.LogInformation(
            StartupResources.BootstrapUserCreatedLog,
            login);
    }

    private static bool IsBootstrapLoginConflict(DbUpdateException exception)
    {
        return exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: "IX_Users_Login"
        };
    }
}
