using System.Text.Json;

namespace GymCrm.Api.SeedData;

internal static class SeedDataOptionsParser
{
    public const string Usage = """
        Usage:
          dotnet run --project backend/src/GymCrm.Api/GymCrm.Api.csproj -- --seed-test-data [options]

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

        return new SeedDataOptions
        {
            ConnectionString = connectionString,
            PhotoStorageRootPath = ResolvePath(repositoryRoot, photoStorageRootPath!),
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

    private static (string? ConnectionString, string? PhotoStorageRootPath) LoadAppSettings(string repositoryRoot)
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
                ReadJsonString(appSettingsPath, "ClientPhoto", "StorageRootPath"));
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
