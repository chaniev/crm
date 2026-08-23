using GymCrm.Api;
using GymCrm.Application.Attendance;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GymCrm.Tests;

[Collection("AttendanceTransitionMaintenanceConsole")]
public sealed class AttendanceTransitionMaintenanceCommandTests
{
    [Fact]
    public async Task Resolve_trainer_substitution_cli_parses_required_ids_and_returns_success_json()
    {
        var fakeService = new RecordingAttendanceTransitionService();
        await using var provider = CreateProvider(fakeService);
        var reportItemId = Guid.NewGuid();
        var operatorId = Guid.NewGuid();
        var occurrenceId = Guid.NewGuid();
        var replacedTrainerId = Guid.NewGuid();
        var substituteTrainerId = Guid.NewGuid();
        var sourceSubstitutionId = Guid.NewGuid();

        var (exitCode, stdout, stderr) = await RunWithConsoleCaptureAsync(
            "--attendance-transition",
            "resolve-trainer-substitution",
            "--report-item-id",
            reportItemId.ToString("D"),
            "--operator-id",
            operatorId.ToString("D"),
            "--target-lesson-occurrence-id",
            occurrenceId.ToString("D"),
            "--replaced-trainer-id",
            replacedTrainerId.ToString("D"),
            "--substitute-trainer-id",
            substituteTrainerId.ToString("D"),
            "--source-substitution-id",
            sourceSubstitutionId.ToString("D"),
            "--comment",
            "operator repair");

        Assert.Equal(0, exitCode);
        Assert.Empty(stderr);
        Assert.Contains("\"command\": \"resolve-trainer-substitution\"", stdout, StringComparison.Ordinal);
        Assert.NotNull(fakeService.LastTrainerSubstitutionCommand);
        Assert.Equal(reportItemId, fakeService.LastTrainerSubstitutionCommand.ReportItemId);
        Assert.Equal(operatorId, fakeService.LastTrainerSubstitutionCommand.OperatorUserId);
        Assert.Equal(occurrenceId, fakeService.LastTrainerSubstitutionCommand.TargetLessonOccurrenceId);
        Assert.Equal(replacedTrainerId, fakeService.LastTrainerSubstitutionCommand.ReplacedTrainerId);
        Assert.Equal(substituteTrainerId, fakeService.LastTrainerSubstitutionCommand.SubstituteTrainerId);
        Assert.Equal(sourceSubstitutionId, fakeService.LastTrainerSubstitutionCommand.SourceGroupTrainerSubstitutionId);
        Assert.Equal("operator repair", fakeService.LastTrainerSubstitutionCommand.OperatorComment);

        async Task<(int ExitCode, string Stdout, string Stderr)> RunWithConsoleCaptureAsync(params string[] args) =>
            await CaptureConsoleAsync(() => AttendanceTransitionMaintenanceCommand.RunAsync(
                args,
                provider,
                CancellationToken.None));
    }

    [Fact]
    public async Task Resolve_trainer_substitution_cli_missing_required_option_returns_stable_error()
    {
        var fakeService = new RecordingAttendanceTransitionService();
        await using var provider = CreateProvider(fakeService);
        var (exitCode, _, stderr) = await CaptureConsoleAsync(() => AttendanceTransitionMaintenanceCommand.RunAsync(
            [
                "--attendance-transition",
                "resolve-trainer-substitution",
                "--report-item-id",
                Guid.NewGuid().ToString("D")
            ],
            provider,
            CancellationToken.None));

        Assert.Equal(2, exitCode);
        Assert.Contains("attendance-transition-invalid-arguments", stderr, StringComparison.Ordinal);
        Assert.Null(fakeService.LastTrainerSubstitutionCommand);
    }

    private static ServiceProvider CreateProvider(RecordingAttendanceTransitionService transitionService)
    {
        var services = new ServiceCollection();
        services.AddSingleton<IAttendanceTransitionService>(transitionService);
        services.AddDbContext<GymCrmDbContext>(options =>
            options.UseInMemoryDatabase($"attendance-transition-cli-{Guid.NewGuid():N}"));
        return services.BuildServiceProvider();
    }

    private static async Task<(int ExitCode, string Stdout, string Stderr)> CaptureConsoleAsync(Func<Task<int>> action)
    {
        var originalOut = Console.Out;
        var originalError = Console.Error;
        using var stdout = new StringWriter();
        using var stderr = new StringWriter();
        try
        {
            Console.SetOut(stdout);
            Console.SetError(stderr);
            var exitCode = await action();
            return (exitCode, stdout.ToString(), stderr.ToString());
        }
        finally
        {
            Console.SetOut(originalOut);
            Console.SetError(originalError);
        }
    }

    private sealed class RecordingAttendanceTransitionService : IAttendanceTransitionService
    {
        public ResolveTrainerSubstitutionTransitionReportItemCommand? LastTrainerSubstitutionCommand { get; private set; }

        public Task<AttendanceTransitionRunResult> EnsureRunAsync(
            DateOnly cutoverDate,
            string sourceSchemaVersion,
            CancellationToken cancellationToken) =>
            Task.FromResult(AttendanceTransitionRunResult.Success(Guid.NewGuid(), 0));

        public Task<AttendanceTransitionActivationResult> ValidateActivationAsync(
            Guid runId,
            CancellationToken cancellationToken) =>
            Task.FromResult(new AttendanceTransitionActivationResult(true, 0));

        public Task<AttendanceTransitionResolutionResult> ResolveReportItemAsync(
            ResolveAttendanceTransitionReportItemCommand command,
            CancellationToken cancellationToken) =>
            Task.FromResult(AttendanceTransitionResolutionResult.Success(true, 0));

        public Task<AttendanceTransitionResolutionResult> ResolveTrainerSubstitutionReportItemAsync(
            ResolveTrainerSubstitutionTransitionReportItemCommand command,
            CancellationToken cancellationToken)
        {
            LastTrainerSubstitutionCommand = command;
            return Task.FromResult(AttendanceTransitionResolutionResult.Success(true, 0));
        }
    }
}
