using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api;

internal static class AttendanceTransitionMaintenanceCommand
{
    private const string Marker = "--attendance-transition";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    public static bool IsRequested(string[] args) =>
        args.Any(argument => string.Equals(argument, Marker, StringComparison.Ordinal));

    public static async Task<int> RunAsync(
        string[] args,
        IServiceProvider services,
        CancellationToken cancellationToken)
    {
        var commandArgs = args
            .SkipWhile(argument => !string.Equals(argument, Marker, StringComparison.Ordinal))
            .Skip(1)
            .ToArray();
        if (commandArgs.Length == 0 || commandArgs.Contains("--help", StringComparer.Ordinal))
        {
            WriteUsage(Console.Out);
            return commandArgs.Length == 0 ? 2 : 0;
        }

        await using var scope = services.CreateAsyncScope();
        var transitionService = scope.ServiceProvider.GetRequiredService<IAttendanceTransitionService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var command = commandArgs[0];
        var options = ParseOptions(commandArgs.Skip(1).ToArray());

        try
        {
            return command switch
            {
                "ensure-run" => await EnsureRunAsync(transitionService, options, cancellationToken),
                "report" => await PrintReportAsync(dbContext, options, cancellationToken),
                "activation-check" => await ActivationCheckAsync(transitionService, options, cancellationToken),
                "resolve-existing" => await ResolveExistingAsync(transitionService, options, cancellationToken),
                "resolve-legacy" => await ResolveLegacyAsync(transitionService, options, cancellationToken),
                "resolve-trainer-substitution" => await ResolveTrainerSubstitutionAsync(transitionService, options, cancellationToken),
                _ => StableError($"attendance-transition-unknown-command: {command}")
            };
        }
        catch (ArgumentException exception)
        {
            return StableError($"attendance-transition-invalid-arguments: {exception.Message}");
        }
        catch (InvalidOperationException exception)
        {
            return StableError($"attendance-transition-operation-failed: {exception.Message}", exitCode: 1);
        }
    }

    private static async Task<int> EnsureRunAsync(
        IAttendanceTransitionService transitionService,
        IReadOnlyDictionary<string, IReadOnlyList<string>> options,
        CancellationToken cancellationToken)
    {
        var result = await transitionService.EnsureRunAsync(
            RequiredDate(options, "--cutover-date"),
            Required(options, "--source-version"),
            cancellationToken);

        WriteJson(new
        {
            command = "ensure-run",
            result.Succeeded,
            error = result.Error.ToString(),
            result.RunId,
            result.UnresolvedCount
        });
        return result.Succeeded ? 0 : 1;
    }

    private static async Task<int> PrintReportAsync(
        GymCrmDbContext dbContext,
        IReadOnlyDictionary<string, IReadOnlyList<string>> options,
        CancellationToken cancellationToken)
    {
        var runId = options.ContainsKey("--run-id")
            ? RequiredGuid(options, "--run-id")
            : await dbContext.AttendanceTransitionRuns
                .Where(run => run.SourceSchemaVersion == Required(options, "--source-version"))
                .Select(run => (Guid?)run.Id)
                .SingleOrDefaultAsync(cancellationToken);
        if (!runId.HasValue)
        {
            return StableError("attendance-transition-run-not-found", exitCode: 1);
        }

        var run = await dbContext.AttendanceTransitionRuns
            .AsNoTracking()
            .SingleAsync(item => item.Id == runId.Value, cancellationToken);
        var mappings = await dbContext.AttendanceTransitionRowResolutions
            .AsNoTracking()
            .Where(item => item.RunId == runId)
            .OrderBy(item => item.ReportItemId)
            .ThenBy(item => item.AttendanceRowId)
            .Select(item => new
            {
                item.ReportItemId,
                item.AttendanceRowId,
                item.TargetLessonOccurrenceId,
                item.ResolutionKind,
                item.ResolvedByUserId,
                item.ResolvedAt,
                item.ResolutionDigest
            })
            .ToArrayAsync(cancellationToken);
        var reportItems = await dbContext.AttendanceTransitionReportItems
            .AsNoTracking()
            .Where(item => item.RunId == runId)
            .OrderBy(item => item.ResolutionStatus)
            .ThenBy(item => item.TrainingDate)
            .ThenBy(item => item.GroupId)
            .ToArrayAsync(cancellationToken);
        var report = reportItems
            .Select(item =>
            {
                var itemMappings = mappings.Where(resolution => resolution.ReportItemId == item.Id).ToArray();
                return new
                {
                    item.Id,
                    item.GroupId,
                    item.TrainingDate,
                    item.ReasonCode,
                    item.RowCount,
                    attendanceRowIds = DeserializeRowIds(item.AttendanceRowIdsJson),
                    resolutionStatus = item.ResolutionStatus.ToString(),
                    item.ResolutionKind,
                    item.TargetLessonOccurrenceId,
                    mappedRowCount = itemMappings.Length,
                    mappings = itemMappings
                };
            })
            .ToArray();

        WriteJson(new
        {
            command = "report",
            run.Id,
            run.CutoverDate,
            run.SourceSchemaVersion,
            status = run.Status.ToString(),
            unresolvedCount = report.Count(item => string.Equals(
                item.resolutionStatus,
                "Unresolved",
                StringComparison.Ordinal)),
            items = report
        });
        return 0;
    }

    private static async Task<int> ActivationCheckAsync(
        IAttendanceTransitionService transitionService,
        IReadOnlyDictionary<string, IReadOnlyList<string>> options,
        CancellationToken cancellationToken)
    {
        var result = await transitionService.ValidateActivationAsync(
            RequiredGuid(options, "--run-id"),
            cancellationToken);
        WriteJson(new
        {
            command = "activation-check",
            result.CanActivate,
            result.UnresolvedCount
        });
        return result.CanActivate ? 0 : 1;
    }

    private static async Task<int> ResolveExistingAsync(
        IAttendanceTransitionService transitionService,
        IReadOnlyDictionary<string, IReadOnlyList<string>> options,
        CancellationToken cancellationToken)
    {
        var result = await transitionService.ResolveReportItemAsync(
            new ResolveAttendanceTransitionReportItemCommand(
                RequiredGuid(options, "--report-item-id"),
                RequiredGuid(options, "--operator-id"),
                RequiredGuid(options, "--target-lesson-occurrence-id"),
                RequiredGuidList(options, "--attendance-row-id"),
                Optional(options, "--comment")),
            cancellationToken);
        return WriteResolutionResult("resolve-existing", result);
    }

    private static async Task<int> ResolveLegacyAsync(
        IAttendanceTransitionService transitionService,
        IReadOnlyDictionary<string, IReadOnlyList<string>> options,
        CancellationToken cancellationToken)
    {
        var result = await transitionService.ResolveReportItemAsync(
            new ResolveAttendanceTransitionReportItemCommand(
                RequiredGuid(options, "--report-item-id"),
                RequiredGuid(options, "--operator-id"),
                null,
                RequiredGuidList(options, "--attendance-row-id"),
                Optional(options, "--comment"),
                new CreateLegacyAttendanceOccurrenceCommand(
                    RequiredGuid(options, "--group-id"),
                    RequiredDate(options, "--lesson-date"),
                    RequiredTime(options, "--start-time"),
                    RequiredInt(options, "--duration-minutes"),
                    RequiredGuid(options, "--hall-id"),
                    Required(options, "--provenance"),
                    RequiredGuidList(options, "--permanent-assignment-id"),
                    OptionalGuidList(options, "--substitution-id"))),
            cancellationToken);
        return WriteResolutionResult("resolve-legacy", result);
    }

    private static async Task<int> ResolveTrainerSubstitutionAsync(
        IAttendanceTransitionService transitionService,
        IReadOnlyDictionary<string, IReadOnlyList<string>> options,
        CancellationToken cancellationToken)
    {
        var result = await transitionService.ResolveTrainerSubstitutionReportItemAsync(
            new ResolveTrainerSubstitutionTransitionReportItemCommand(
                RequiredGuid(options, "--report-item-id"),
                RequiredGuid(options, "--operator-id"),
                RequiredGuid(options, "--target-lesson-occurrence-id"),
                RequiredGuid(options, "--replaced-trainer-id"),
                RequiredGuid(options, "--substitute-trainer-id"),
                RequiredGuid(options, "--source-substitution-id"),
                Optional(options, "--comment")),
            cancellationToken);
        return WriteResolutionResult("resolve-trainer-substitution", result);
    }

    private static int WriteResolutionResult(string command, AttendanceTransitionResolutionResult result)
    {
        WriteJson(new
        {
            command,
            result.Succeeded,
            error = result.Error.ToString(),
            result.ReportItemResolved,
            result.RemainingRowCount
        });
        return result.Succeeded ? 0 : 1;
    }

    private static IReadOnlyDictionary<string, IReadOnlyList<string>> ParseOptions(string[] args)
    {
        var values = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        for (var index = 0; index < args.Length; index++)
        {
            var option = args[index];
            if (!option.StartsWith("--", StringComparison.Ordinal))
            {
                throw new ArgumentException($"Unexpected positional argument '{option}'.");
            }

            if (index + 1 >= args.Length || args[index + 1].StartsWith("--", StringComparison.Ordinal))
            {
                throw new ArgumentException($"Missing value for '{option}'.");
            }

            if (!values.TryGetValue(option, out var optionValues))
            {
                optionValues = [];
                values[option] = optionValues;
            }

            optionValues.Add(args[++index]);
        }

        return values.ToDictionary(item => item.Key, item => (IReadOnlyList<string>)item.Value, StringComparer.Ordinal);
    }

    private static string Required(IReadOnlyDictionary<string, IReadOnlyList<string>> options, string key) =>
        Optional(options, key) ?? throw new ArgumentException($"Missing required option '{key}'.");

    private static string? Optional(IReadOnlyDictionary<string, IReadOnlyList<string>> options, string key) =>
        options.TryGetValue(key, out var values) ? values.LastOrDefault() : null;

    private static Guid RequiredGuid(IReadOnlyDictionary<string, IReadOnlyList<string>> options, string key) =>
        Guid.TryParse(Required(options, key), out var value)
            ? value
            : throw new ArgumentException($"Option '{key}' must be a GUID.");

    private static IReadOnlyList<Guid> RequiredGuidList(
        IReadOnlyDictionary<string, IReadOnlyList<string>> options,
        string key)
    {
        var values = OptionalGuidList(options, key);
        return values.Count > 0 ? values : throw new ArgumentException($"Missing required option '{key}'.");
    }

    private static IReadOnlyList<Guid> OptionalGuidList(
        IReadOnlyDictionary<string, IReadOnlyList<string>> options,
        string key)
    {
        if (!options.TryGetValue(key, out var values))
        {
            return [];
        }

        return values
            .SelectMany(value => value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Select(value => Guid.TryParse(value, out var parsed)
                ? parsed
                : throw new ArgumentException($"Option '{key}' contains a non-GUID value."))
            .ToArray();
    }

    private static DateOnly RequiredDate(IReadOnlyDictionary<string, IReadOnlyList<string>> options, string key) =>
        DateOnly.TryParseExact(
            Required(options, key),
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var value)
            ? value
            : throw new ArgumentException($"Option '{key}' must use yyyy-MM-dd.");

    private static TimeOnly RequiredTime(IReadOnlyDictionary<string, IReadOnlyList<string>> options, string key) =>
        TimeOnly.TryParseExact(
            Required(options, key),
            "HH:mm",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var value)
            ? value
            : throw new ArgumentException($"Option '{key}' must use HH:mm.");

    private static int RequiredInt(IReadOnlyDictionary<string, IReadOnlyList<string>> options, string key) =>
        int.TryParse(Required(options, key), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
            ? value
            : throw new ArgumentException($"Option '{key}' must be an integer.");

    private static int StableError(string message, int exitCode = 2)
    {
        Console.Error.WriteLine(message);
        return exitCode;
    }

    private static void WriteJson(object payload)
    {
        Console.Out.WriteLine(JsonSerializer.Serialize(payload, JsonOptions));
    }

    private static IReadOnlyList<Guid> DeserializeRowIds(string value) =>
        JsonSerializer.Deserialize<Guid[]>(value) ?? [];

    private static void WriteUsage(TextWriter writer)
    {
        writer.WriteLine("Usage:");
        writer.WriteLine("  --attendance-transition ensure-run --cutover-date YYYY-MM-DD --source-version VERSION");
        writer.WriteLine("  --attendance-transition report (--run-id GUID | --source-version VERSION)");
        writer.WriteLine("  --attendance-transition activation-check --run-id GUID");
        writer.WriteLine("  --attendance-transition resolve-existing --report-item-id GUID --operator-id GUID --target-lesson-occurrence-id GUID --attendance-row-id GUID[,GUID] [--comment TEXT]");
        writer.WriteLine("  --attendance-transition resolve-legacy --report-item-id GUID --operator-id GUID --attendance-row-id GUID[,GUID] --group-id GUID --lesson-date YYYY-MM-DD --start-time HH:mm --duration-minutes N --hall-id GUID --provenance TEXT --permanent-assignment-id GUID[,GUID] [--substitution-id GUID[,GUID]] [--comment TEXT]");
        writer.WriteLine("  --attendance-transition resolve-trainer-substitution --report-item-id GUID --operator-id GUID --target-lesson-occurrence-id GUID --replaced-trainer-id GUID --substitute-trainer-id GUID --source-substitution-id GUID [--comment TEXT]");
    }
}
