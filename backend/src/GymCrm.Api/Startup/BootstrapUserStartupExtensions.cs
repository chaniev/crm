using GymCrm.Api.Auth;
using GymCrm.Application.Security;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

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

        if (await dbContext.Users.AnyAsync(cancellationToken))
        {
            logger.LogDebug("Bootstrap user seeding skipped because at least one user already exists.");
            return;
        }

        var options = scope.ServiceProvider.GetRequiredService<IOptions<BootstrapUserOptions>>().Value;
        var login = string.IsNullOrWhiteSpace(options.Login) ? "headcoach" : options.Login.Trim();
        var fullName = string.IsNullOrWhiteSpace(options.FullName) ? "Главный тренер" : options.FullName.Trim();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

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

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Bootstrap HeadCoach user '{Login}' has been created with a forced password change.",
            login);
    }
}
