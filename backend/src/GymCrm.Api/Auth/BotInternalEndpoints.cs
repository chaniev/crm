using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Bot;
using Microsoft.Extensions.Options;

namespace GymCrm.Api.Auth;

internal static class BotInternalEndpoints
{
    private const string IdempotencyKeyHeaderName = "Idempotency-Key";
    private const string RequestIdHeaderName = "X-Request-Id";
    private const string BearerPrefix = "Bearer ";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapBotInternalEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/internal/bot")
            .AddEndpointFilter(ValidateServiceTokenAsync);

        group.MapPost("/telegram/session/resolve", ResolveSessionAsync);
        group.MapGet("/menu", GetMenuAsync);
        group.MapGet("/attendance/groups", ListAttendanceGroupsAsync);
        group.MapGet("/attendance/lessons", ListAttendanceLessonsAsync);
        group.MapGet("/attendance/lessons/{lessonOccurrenceId:guid}/clients", GetAttendanceLessonRosterAsync);
        group.MapPost("/attendance/lessons/{lessonOccurrenceId:guid}", SaveLessonAttendanceAsync);
        group.MapGet("/clients", SearchClientsAsync);
        group.MapGet("/clients/expiring-memberships", ListExpiringMembershipsAsync);
        group.MapGet("/clients/unpaid-memberships", ListUnpaidMembershipsAsync);
        group.MapGet("/clients/{clientId:guid}", GetClientCardAsync);
        group.MapPost("/clients/{clientId:guid}/membership/mark-payment", MarkMembershipPaymentAsync);
        group.MapPost("/audit/access-denied", WriteAccessDeniedAuditAsync);

        return endpoints;
    }

    private static async ValueTask<object?> ValidateServiceTokenAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var options = context.HttpContext.RequestServices
            .GetRequiredService<IOptions<BotInternalApiOptions>>()
            .Value;
        PassThroughRequestId(context.HttpContext);

        if (!options.Enabled)
        {
            return Results.NotFound();
        }

        if (string.IsNullOrWhiteSpace(options.Token))
        {
            return Results.Problem(
                title: "BotInternalApiTokenMissing",
                detail: global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine546aec8af2,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        var authorization = context.HttpContext.Request.Headers.Authorization.ToString();
        if (!authorization.StartsWith(BearerPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return Results.Unauthorized();
        }

        var suppliedToken = authorization[BearerPrefix.Length..].Trim();
        return FixedTimeEquals(suppliedToken, options.Token.Trim())
            ? await next(context)
            : Results.Unauthorized();
    }

    private static async Task<IResult> ResolveSessionAsync(
        TelegramIdentityRequest request,
        IBotApiService botApiService,
        CancellationToken cancellationToken)
    {
        return ToHttpResult(await botApiService.ResolveUserContextAsync(
            ToIdentity(request),
            cancellationToken));
    }

    private static async Task<IResult> GetMenuAsync(
        string? platform,
        string? platformUserId,
        IBotApiService botApiService,
        CancellationToken cancellationToken)
    {
        return ToHttpResult(await botApiService.GetMenuAsync(
            ToIdentity(platform, platformUserId),
            cancellationToken));
    }

    private static async Task<IResult> ListAttendanceGroupsAsync(
        string? platform,
        string? platformUserId,
        IBotApiService botApiService,
        CancellationToken cancellationToken)
    {
        return ToHttpResult(await botApiService.ListAttendanceGroupsAsync(
            ToIdentity(platform, platformUserId),
            cancellationToken));
    }

    private static async Task<IResult> ListAttendanceLessonsAsync(
        string? trainingDate,
        string? platform,
        string? platformUserId,
        IBotApiService botApiService,
        CancellationToken cancellationToken)
    {
        var parsedTrainingDate = ParseDate(trainingDate);
        if (!parsedTrainingDate.HasValue)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["trainingDate"] = [global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine114512cc5e3]
            });
        }

        return ToHttpResult(await botApiService.ListAttendanceLessonsAsync(
            ToIdentity(platform, platformUserId),
            parsedTrainingDate.Value,
            cancellationToken));
    }

    private static async Task<IResult> GetAttendanceRosterAsync(
        Guid groupId,
        string? trainingDate,
        string? platform,
        string? platformUserId,
        IBotApiService botApiService,
        CancellationToken cancellationToken)
    {
        var parsedTrainingDate = ParseDate(trainingDate);
        if (!parsedTrainingDate.HasValue)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["trainingDate"] = [global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine137512cc5e3]
            });
        }

        return ToHttpResult(await botApiService.GetAttendanceRosterAsync(
            ToIdentity(platform, platformUserId),
            groupId,
            parsedTrainingDate.Value,
            cancellationToken));
    }

    private static async Task<IResult> GetAttendanceLessonRosterAsync(
        Guid lessonOccurrenceId,
        string? lessonDate,
        string? platform,
        string? platformUserId,
        IBotApiService botApiService,
        CancellationToken cancellationToken)
    {
        var parsedLessonDate = ParseDate(lessonDate);
        if (!parsedLessonDate.HasValue)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["lessonDate"] = [global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine161Ab7c6d65]
            });
        }

        return ToHttpResult(await botApiService.GetAttendanceRosterByLessonAsync(
            ToIdentity(platform, platformUserId),
            lessonOccurrenceId,
            parsedLessonDate.Value,
            cancellationToken));
    }

    private static async Task<IResult> SaveAttendanceAsync(
        Guid groupId,
        BotSaveAttendanceRequest request,
        HttpContext httpContext,
        IBotApiService botApiService,
        CancellationToken cancellationToken)
    {
        var parsedTrainingDate = ParseDate(request.TrainingDate);
        if (!parsedTrainingDate.HasValue)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["trainingDate"] = [global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine184512cc5e3]
            });
        }

        var idempotencyKey = ReadIdempotencyKey(httpContext);
        if (string.IsNullOrWhiteSpace(idempotencyKey))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["idempotencyKey"] = [global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine1931584a20b]
            });
        }

        var result = await botApiService.SaveAttendanceAsync(
            ToIdentity(request),
            groupId,
            parsedTrainingDate.Value,
            request.AttendanceMarks?
                .Select(mark => new BotAttendanceMarkInput(mark.ClientId, mark.IsPresent))
                .ToArray() ?? [],
            idempotencyKey,
            JsonSerializer.Serialize(request, JsonOptions),
            cancellationToken);

        return ToHttpResult(result);
    }

    private static async Task<IResult> SaveLessonAttendanceAsync(
        Guid lessonOccurrenceId,
        string? lessonDate,
        BotSaveAttendanceRequest request,
        HttpContext httpContext,
        IBotApiService botApiService,
        CancellationToken cancellationToken)
    {
        var parsedLessonDate = ParseDate(lessonDate);
        if (!parsedLessonDate.HasValue)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["lessonDate"] = [global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine224Ab7c6d65]
            });
        }

        var idempotencyKey = ReadIdempotencyKey(httpContext);
        if (string.IsNullOrWhiteSpace(idempotencyKey))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["idempotencyKey"] = [global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine2331584a20b]
            });
        }

        var result = await botApiService.SaveAttendanceByLessonAsync(
            ToIdentity(request),
            lessonOccurrenceId,
            parsedLessonDate.Value,
            request.AttendanceMarks?
                .Select(mark => new BotAttendanceMarkInput(mark.ClientId, mark.IsPresent))
                .ToArray() ?? [],
            idempotencyKey,
            JsonSerializer.Serialize(request, JsonOptions),
            cancellationToken);

        return ToHttpResult(result);
    }

    private static async Task<IResult> SearchClientsAsync(
        string? q,
        int? skip,
        int? take,
        string? platform,
        string? platformUserId,
        IBotApiService botApiService,
        CancellationToken cancellationToken)
    {
        return ToHttpResult(await botApiService.SearchClientsAsync(
            ToIdentity(platform, platformUserId),
            q,
            skip.GetValueOrDefault(0),
            take.GetValueOrDefault(10),
            cancellationToken));
    }

    private static async Task<IResult> GetClientCardAsync(
        Guid clientId,
        string? platform,
        string? platformUserId,
        IBotApiService botApiService,
        CancellationToken cancellationToken)
    {
        return ToHttpResult(await botApiService.GetClientCardAsync(
            ToIdentity(platform, platformUserId),
            clientId,
            cancellationToken));
    }

    private static async Task<IResult> ListExpiringMembershipsAsync(
        string? platform,
        string? platformUserId,
        IBotApiService botApiService,
        CancellationToken cancellationToken)
    {
        return ToHttpResult(await botApiService.ListExpiringMembershipsAsync(
            ToIdentity(platform, platformUserId),
            cancellationToken));
    }

    private static async Task<IResult> ListUnpaidMembershipsAsync(
        string? platform,
        string? platformUserId,
        CancellationToken cancellationToken)
    {
        await Task.CompletedTask.WaitAsync(cancellationToken);
        _ = ToIdentity(platform, platformUserId);
        return RemovedProblem(
            "membership-unpaid-list-removed",
            "Membership unpaid list has been removed.");
    }

    private static IResult MarkMembershipPaymentAsync(
        Guid clientId,
        TelegramIdentityRequest request,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _ = clientId;
        _ = ToIdentity(request);
        return RemovedProblem(
            "membership-payment-action-removed",
            "Membership payment marking has been removed.");
    }

    private static async Task<IResult> WriteAccessDeniedAuditAsync(
        BotAccessDeniedAuditHttpRequest request,
        HttpContext httpContext,
        IBotApiService botApiService,
        CancellationToken cancellationToken)
    {
        var idempotencyKey = ReadIdempotencyKey(httpContext);
        if (string.IsNullOrWhiteSpace(idempotencyKey))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["idempotencyKey"] = [global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine3281584a20b]
            });
        }

        return ToHttpResult(await botApiService.WriteAccessDeniedAuditAsync(
            ToIdentity(request),
            new BotAccessDeniedAuditRequest(
                request.ActionCode ?? "Unknown",
                request.EntityType,
                request.EntityId,
                request.Reason),
            idempotencyKey,
            JsonSerializer.Serialize(request, JsonOptions),
            cancellationToken));
    }

    private static IResult ToHttpResult<T>(BotApiResult<T> result)
    {
        if (result.Succeeded)
        {
            return Results.Ok(result.Value);
        }

        return result.Error switch
        {
            BotApiError.UnknownUser => Results.NotFound(new
            {
                title = "TelegramUserNotConfigured",
                detail = global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine356Ea11992e
            }),
            BotApiError.UserInactive => Results.Problem(
                title: "CrmUserInactive",
                detail: global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine360D01e6571,
                statusCode: StatusCodes.Status403Forbidden),
            BotApiError.PasswordChangeRequired => Results.Problem(
                title: "PasswordChangeRequired",
                detail: global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine364F7451b01,
                statusCode: StatusCodes.Status403Forbidden),
            BotApiError.Forbidden => Results.Forbid(),
            BotApiError.InvalidAttendanceDate => Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["trainingDate"] = [global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine3691cd5b8f3]
            }),
            BotApiError.NotFound => Results.NotFound(),
            BotApiError.Validation => Results.ValidationProblem(
                result.ValidationErrors ?? new Dictionary<string, string[]>
                {
                    ["request"] = [global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine3759dc0b53c]
                }),
            BotApiError.IdempotencyConflict => Results.Conflict(new
            {
                title = "IdempotencyConflict",
                detail = global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine3802642715d
            }),
            BotApiError.CurrentMembershipMissing => Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["currentMembership"] = [global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine3843ee05d1f]
            }),
            BotApiError.SingleVisitRestoreConflict => Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["attendanceMarks"] = [global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine388E7d11beb]
            }),
            _ => Results.Problem(
                title: "TemporaryBackendError",
                detail: global::GymCrm.Api.UserFacingText.BE7BotInternalApiText.BotInternalEndpointsLine392A6463b42,
                statusCode: StatusCodes.Status503ServiceUnavailable)
        };
    }

    private static IResult RemovedProblem(string type, string detail)
    {
        return Results.Problem(
            type: type,
            title: type,
            detail: detail,
            statusCode: StatusCodes.Status410Gone);
    }

    private static BotIdentity ToIdentity(BotIdentityHttpRequest request)
    {
        return ToIdentity(request.Platform, request.PlatformUserId);
    }

    private static BotIdentity ToIdentity(string? platform, string? platformUserId)
    {
        return new BotIdentity(
            string.IsNullOrWhiteSpace(platform) ? "Telegram" : platform.Trim(),
            platformUserId?.Trim() ?? string.Empty);
    }

    private static DateOnly? ParseDate(string? value)
    {
        return DateOnly.TryParseExact(
            value?.Trim(),
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsed)
            ? parsed
            : null;
    }

    private static string ReadIdempotencyKey(HttpContext httpContext)
    {
        return httpContext.Request.Headers.TryGetValue(IdempotencyKeyHeaderName, out var value)
            ? value.ToString()
            : string.Empty;
    }

    private static void PassThroughRequestId(HttpContext httpContext)
    {
        if (!httpContext.Request.Headers.TryGetValue(RequestIdHeaderName, out var requestId) ||
            string.IsNullOrWhiteSpace(requestId))
        {
            return;
        }

        httpContext.Response.Headers[RequestIdHeaderName] = requestId.ToString();
    }

    private static bool FixedTimeEquals(string suppliedToken, string expectedToken)
    {
        var suppliedBytes = System.Text.Encoding.UTF8.GetBytes(suppliedToken);
        var expectedBytes = System.Text.Encoding.UTF8.GetBytes(expectedToken);

        return suppliedBytes.Length == expectedBytes.Length &&
            System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(suppliedBytes, expectedBytes);
    }

    private abstract record BotIdentityHttpRequest(
        string? Platform,
        string? PlatformUserId);

    private sealed record TelegramIdentityRequest(
        string? Platform,
        string? PlatformUserId) : BotIdentityHttpRequest(Platform, PlatformUserId);

    private sealed record BotSaveAttendanceRequest(
        string? Platform,
        string? PlatformUserId,
        string? TrainingDate,
        IReadOnlyList<BotAttendanceMarkRequest>? AttendanceMarks) : BotIdentityHttpRequest(Platform, PlatformUserId);

    private sealed record BotAttendanceMarkRequest(
        Guid ClientId,
        bool IsPresent);

    private sealed record BotAccessDeniedAuditHttpRequest(
        string? Platform,
        string? PlatformUserId,
        string? ActionCode,
        string? EntityType,
        string? EntityId,
        string? Reason) : BotIdentityHttpRequest(Platform, PlatformUserId);
}
