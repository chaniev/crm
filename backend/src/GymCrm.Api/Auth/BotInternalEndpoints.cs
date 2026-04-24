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
        group.MapGet("/attendance/groups/{groupId:guid}/clients", GetAttendanceRosterAsync);
        group.MapPost("/attendance/groups/{groupId:guid}", SaveAttendanceAsync);
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
                detail: "Internal Bot API token is not configured.",
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
                ["trainingDate"] = ["Укажите дату в формате yyyy-MM-dd."]
            });
        }

        return ToHttpResult(await botApiService.GetAttendanceRosterAsync(
            ToIdentity(platform, platformUserId),
            groupId,
            parsedTrainingDate.Value,
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
                ["trainingDate"] = ["Укажите дату в формате yyyy-MM-dd."]
            });
        }

        var idempotencyKey = ReadIdempotencyKey(httpContext);
        if (string.IsNullOrWhiteSpace(idempotencyKey))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["idempotencyKey"] = ["Для изменяющего действия нужен Idempotency-Key."]
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
        IBotApiService botApiService,
        CancellationToken cancellationToken)
    {
        return ToHttpResult(await botApiService.ListUnpaidMembershipsAsync(
            ToIdentity(platform, platformUserId),
            cancellationToken));
    }

    private static async Task<IResult> MarkMembershipPaymentAsync(
        Guid clientId,
        TelegramIdentityRequest request,
        HttpContext httpContext,
        IBotApiService botApiService,
        CancellationToken cancellationToken)
    {
        var idempotencyKey = ReadIdempotencyKey(httpContext);
        if (string.IsNullOrWhiteSpace(idempotencyKey))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["idempotencyKey"] = ["Для изменяющего действия нужен Idempotency-Key."]
            });
        }

        return ToHttpResult(await botApiService.MarkMembershipPaymentAsync(
            ToIdentity(request),
            clientId,
            idempotencyKey,
            JsonSerializer.Serialize(request, JsonOptions),
            cancellationToken));
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
                ["idempotencyKey"] = ["Для изменяющего действия нужен Idempotency-Key."]
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
                detail = "Telegram user is not configured in CRM."
            }),
            BotApiError.UserInactive => Results.Problem(
                title: "CrmUserInactive",
                detail: "CRM user is inactive.",
                statusCode: StatusCodes.Status403Forbidden),
            BotApiError.PasswordChangeRequired => Results.Problem(
                title: "PasswordChangeRequired",
                detail: "CRM user must change password in web UI first.",
                statusCode: StatusCodes.Status403Forbidden),
            BotApiError.Forbidden => Results.Forbid(),
            BotApiError.InvalidAttendanceDate => Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["trainingDate"] = ["Дата посещаемости недоступна для роли пользователя."]
            }),
            BotApiError.NotFound => Results.NotFound(),
            BotApiError.Validation => Results.ValidationProblem(
                result.ValidationErrors ?? new Dictionary<string, string[]>
                {
                    ["request"] = ["Запрос не прошел бизнес-валидацию."]
                }),
            BotApiError.IdempotencyConflict => Results.Conflict(new
            {
                title = "IdempotencyConflict",
                detail = "Idempotency-Key уже использован для другого действия или payload."
            }),
            BotApiError.CurrentMembershipMissing => Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["currentMembership"] = ["У клиента нет текущего абонемента."]
            }),
            BotApiError.CurrentMembershipAlreadyPaid => Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["currentMembership"] = ["Текущий абонемент уже оплачен."]
            }),
            _ => Results.Problem(
                title: "TemporaryBackendError",
                detail: "Temporary backend error.",
                statusCode: StatusCodes.Status503ServiceUnavailable)
        };
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
