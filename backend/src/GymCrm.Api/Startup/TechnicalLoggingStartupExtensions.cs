using System.ComponentModel.DataAnnotations;
using Serilog;
using Serilog.Events;

namespace GymCrm.Api.Startup;

internal static class TechnicalLoggingStartupExtensions
{
    private static readonly TimeSpan RetentionSweepInterval = TimeSpan.FromHours(12);

    public static WebApplicationBuilder AddTechnicalLogging(this WebApplicationBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.Services
            .AddOptions<TechnicalLoggingOptions>()
            .Bind(builder.Configuration.GetSection(TechnicalLoggingOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();
        builder.Services.AddHostedService<TechnicalLogRetentionService>();
        builder.Host.UseSerilog((context, _, loggerConfiguration) =>
        {
            var options = context.Configuration
                .GetSection(TechnicalLoggingOptions.SectionName)
                .Get<TechnicalLoggingOptions>()
                ?? new TechnicalLoggingOptions();

            Validator.ValidateObject(options, new ValidationContext(options), validateAllProperties: true);

            loggerConfiguration
                .MinimumLevel.Information()
                .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
                .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Information)
                .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
                .Enrich.FromLogContext();

            if (!options.Enabled)
            {
                return;
            }

            var runtime = TechnicalLoggingRuntimeOptions.Create(
                context.HostingEnvironment.ContentRootPath,
                options,
                DateTimeOffset.UtcNow);
            Directory.CreateDirectory(runtime.DirectoryPath);

            loggerConfiguration.WriteTo.File(
                path: runtime.FilePath,
                fileSizeLimitBytes: runtime.FileSizeLimitBytes,
                rollOnFileSizeLimit: true,
                retainedFileCountLimit: null,
                shared: true,
                outputTemplate:
                "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} {Level:u3}] {Message:lj}{NewLine}{Exception}");
        }, writeToProviders: true);

        return builder;
    }

    public static IApplicationBuilder UseTechnicalRequestLogging(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var configuration = app.ApplicationServices.GetRequiredService<IConfiguration>();
        var options = configuration
            .GetSection(TechnicalLoggingOptions.SectionName)
            .Get<TechnicalLoggingOptions>()
            ?? new TechnicalLoggingOptions();

        if (!options.Enabled)
        {
            return app;
        }

        return app.UseSerilogRequestLogging(options =>
        {
            options.MessageTemplate =
                "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
            options.GetLevel = static (httpContext, _, exception) =>
            {
                if (exception is not null || httpContext.Response.StatusCode >= StatusCodes.Status500InternalServerError)
                {
                    return LogEventLevel.Error;
                }

                return LogEventLevel.Information;
            };
        });
    }

    internal sealed record TechnicalLoggingRuntimeOptions(
        string DirectoryPath,
        string FilePath,
        string SearchPattern,
        long FileSizeLimitBytes,
        TimeSpan RetentionPeriod)
    {
        public static TechnicalLoggingRuntimeOptions Create(
            string contentRootPath,
            TechnicalLoggingOptions options,
            DateTimeOffset startupTimestamp)
        {
            var directoryPath = Path.GetFullPath(
                Path.Combine(contentRootPath, options.DirectoryPath));
            var startupStamp = startupTimestamp.ToString("yyyyMMdd-HHmmss");
            var filePath = Path.Combine(
                directoryPath,
                $"{options.FileNamePrefix}-{startupStamp}-.log");

            return new TechnicalLoggingRuntimeOptions(
                directoryPath,
                filePath,
                $"{options.FileNamePrefix}-*.log*",
                options.FileSizeLimitMb * 1024L * 1024L,
                TimeSpan.FromDays(options.RetentionDays));
        }
    }

    internal sealed class TechnicalLogRetentionService(
        IConfiguration configuration,
        IHostEnvironment hostEnvironment,
        ILogger<TechnicalLogRetentionService> logger) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var options = configuration
                .GetSection(TechnicalLoggingOptions.SectionName)
                .Get<TechnicalLoggingOptions>()
                ?? new TechnicalLoggingOptions();

            if (!options.Enabled)
            {
                return;
            }

            RunRetentionSweep(options);

            using var timer = new PeriodicTimer(RetentionSweepInterval);
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                RunRetentionSweep(options);
            }
        }

        private void RunRetentionSweep(TechnicalLoggingOptions options)
        {
            var runtimeOptions = TechnicalLoggingRuntimeOptions.Create(
                hostEnvironment.ContentRootPath,
                options,
                DateTimeOffset.UtcNow);

            try
            {
                var cutoffUtc = DateTimeOffset.UtcNow - runtimeOptions.RetentionPeriod;
                var files = Directory.EnumerateFiles(
                        runtimeOptions.DirectoryPath,
                        runtimeOptions.SearchPattern,
                        SearchOption.TopDirectoryOnly)
                    .Select(filePath => new
                    {
                        FilePath = filePath,
                        LastWriteUtc = File.GetLastWriteTimeUtc(filePath)
                    })
                    .ToArray();

                foreach (var file in files)
                {
                    if (file.LastWriteUtc >= cutoffUtc.UtcDateTime)
                    {
                        continue;
                    }

                    File.Delete(file.FilePath);
                }
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Technical log retention sweep failed for directory '{LogDirectory}'.",
                    runtimeOptions.DirectoryPath);
            }
        }
    }
}
