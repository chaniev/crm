using System.Text.Json;

namespace GymCrm.Api.SeedData;

internal static class SeedDataOptionsParser
{
    public const string LeninskyUsage = """
        Usage:
          backend/scripts/seed-leninsky-test-data.sh [options]

        Creates or updates the Leninsky branch, five administrators (password: 1),
        and the branch membership catalog. The command is safe to run repeatedly.

        Options:
          --connection <value>   PostgreSQL connection string.
          --skip-migrations      Do not apply EF Core migrations before seeding.
          -h, --help             Show help.
        """;

    public const string LeninskyAdminsOnlyUsage = """
        Usage:
          backend/scripts/seed-leninsky-admins-only.sh [options]

        Creates or updates the Leninsky branch, HeadCoach 'headcoach',
        SuperAdministrator 'sa', and five administrators 'admin1' through
        'admin5' (password: 1). This command does not create membership catalog
        items, clients, training groups, schedules, or attendance data.

        Options:
          --connection <value>   PostgreSQL connection string.
          --skip-migrations      Do not apply EF Core migrations before seeding.
          -h, --help             Show help.
        """;

    public const string Usage = """
        Usage:
          dotnet run --no-launch-profile --project backend/src/GymCrm.Api/GymCrm.Api.csproj -- --seed-test-data [options]

        Recreates the deterministic local demo data: branches, halls, users,
        clients, memberships, group assignments, and recurring lesson schedules.
        Lesson calendars and memberships start on the command execution date.

        Options:
          --connection <value>   PostgreSQL connection string.
          --photo-root <path>    Directory for generated client photos.
          --skip-migrations      Do not apply EF Core migrations before seeding.
          -h, --help             Show help.

        Defaults:
          Connection string is resolved from --connection, ConnectionStrings__Postgres,
          POSTGRES_CONNECTION_STRING, GYM_CRM_POSTGRES_CONNECTION_STRING, then
          backend/src/GymCrm.Api/appsettings.Development.json.

          Photo root is resolved from --photo-root, ClientPhoto__StorageRootPath,
          GYM_CRM_CLIENT_PHOTO_ROOT, appsettings.Development.json, then
          uploads/client-photos under the repository root.

          Calendar date uses BusinessTime__TimeZoneId,
          BACKEND_BUSINESS_TIME_ZONE_ID, appsettings.Development.json, then
          Europe/Moscow.
        """;

    public static SeedDataOptions Parse(string[] args)
    {
        string? connectionString = null;
        string? photoStorageRootPath = null;
        var applyMigrations = true;

        for (var index = 0; index < args.Length; index++)
        {
            var argument = args[index];

            switch (argument)
            {
                case "-h":
                case "--help":
                    return SeedDataOptions.Help;
                case "--connection":
                    connectionString = ReadOptionValue(args, ref index, argument);
                    break;
                case "--photo-root":
                    photoStorageRootPath = ReadOptionValue(args, ref index, argument);
                    break;
                case "--skip-migrations":
                    applyMigrations = false;
                    break;
                default:
                    throw new SeedDataOptionsException($"Unknown option '{argument}'.");
            }
        }

        var repositoryRoot = FindRepositoryRoot();
        var appSettings = LoadAppSettings(repositoryRoot);

        connectionString = FirstNonEmpty(
            connectionString,
            Environment.GetEnvironmentVariable("ConnectionStrings__Postgres"),
            Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING"),
            Environment.GetEnvironmentVariable("GYM_CRM_POSTGRES_CONNECTION_STRING"),
            appSettings.ConnectionString);

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new SeedDataOptionsException("PostgreSQL connection string is not configured.");
        }

        photoStorageRootPath = FirstNonEmpty(
            photoStorageRootPath,
            Environment.GetEnvironmentVariable("ClientPhoto__StorageRootPath"),
            Environment.GetEnvironmentVariable("GYM_CRM_CLIENT_PHOTO_ROOT"),
            appSettings.PhotoStorageRootPath,
            Path.Combine(repositoryRoot, "uploads", "client-photos"));
        var businessTimeZoneId = FirstNonEmpty(
            Environment.GetEnvironmentVariable("BusinessTime__TimeZoneId"),
            Environment.GetEnvironmentVariable("BACKEND_BUSINESS_TIME_ZONE_ID"),
            appSettings.BusinessTimeZoneId,
            "Europe/Moscow")!;
        ValidateTimeZone(businessTimeZoneId);

        return new SeedDataOptions
        {
            ConnectionString = connectionString,
            PhotoStorageRootPath = ResolvePath(repositoryRoot, photoStorageRootPath!),
            BusinessTimeZoneId = businessTimeZoneId,
            ApplyMigrations = applyMigrations
        };
    }

    private static string ReadOptionValue(string[] args, ref int index, string option)
    {
        if (index + 1 >= args.Length)
        {
            throw new SeedDataOptionsException($"Option '{option}' requires a value.");
        }

        index++;
        return args[index];
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

    private static string ResolvePath(string repositoryRoot, string path) =>
        Path.GetFullPath(Path.IsPathRooted(path) ? path : Path.Combine(repositoryRoot, path));

    private static string FindRepositoryRoot()
    {
        var currentDirectory = new DirectoryInfo(Directory.GetCurrentDirectory());

        while (currentDirectory is not null)
        {
            var appSettingsPath = Path.Combine(
                currentDirectory.FullName,
                "backend",
                "src",
                "GymCrm.Api",
                "appsettings.Development.json");

            if (File.Exists(appSettingsPath))
            {
                return currentDirectory.FullName;
            }

            currentDirectory = currentDirectory.Parent;
        }

        return Directory.GetCurrentDirectory();
    }

    private static void ValidateTimeZone(string timeZoneId)
    {
        try
        {
            _ = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch (Exception exception) when (exception is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            throw new SeedDataOptionsException($"Business time zone '{timeZoneId}' is invalid.");
        }
    }

    private static (
        string? ConnectionString,
        string? PhotoStorageRootPath,
        string? BusinessTimeZoneId) LoadAppSettings(string repositoryRoot)
    {
        var developmentAppSettingsPath = Path.Combine(
            repositoryRoot,
            "backend",
            "src",
            "GymCrm.Api",
            "appsettings.Development.json");

        var appSettingsPath = Path.Combine(
            repositoryRoot,
            "backend",
            "src",
            "GymCrm.Api",
            "appsettings.json");

        return (
            ReadJsonString(developmentAppSettingsPath, "ConnectionStrings", "Postgres") ??
                ReadJsonString(appSettingsPath, "ConnectionStrings", "Postgres"),
            ReadJsonString(developmentAppSettingsPath, "ClientPhoto", "StorageRootPath") ??
                ReadJsonString(appSettingsPath, "ClientPhoto", "StorageRootPath"),
            ReadJsonString(developmentAppSettingsPath, "BusinessTime", "TimeZoneId") ??
                ReadJsonString(appSettingsPath, "BusinessTime", "TimeZoneId"));
    }

    private static string? ReadJsonString(string path, params string[] propertyPath)
    {
        if (!File.Exists(path))
        {
            return null;
        }

        try
        {
            using var stream = File.OpenRead(path);
            using var document = JsonDocument.Parse(stream);
            var element = document.RootElement;

            foreach (var propertyName in propertyPath)
            {
                if (!element.TryGetProperty(propertyName, out element))
                {
                    return null;
                }
            }

            return element.ValueKind == JsonValueKind.String ? element.GetString() : null;
        }
        catch (JsonException exception)
        {
            throw new SeedDataOptionsException($"Could not parse JSON configuration '{path}': {exception.Message}");
        }
    }
}
