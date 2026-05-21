using GymCrm.Application.Messenger;
using Microsoft.AspNetCore.Antiforgery;

namespace GymCrm.Api.Auth;

internal static class ClientMessengerEndpoints
{
    public static IEndpointRouteBuilder MapClientMessengerEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/clients/{clientId:guid}/messenger/telegram");

        group.MapGet("", GetSummaryAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ViewClientMessenger);
        group.MapGet("/messages", ListMessagesAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ViewClientMessenger);
        group.MapPost("/link-token", CreateLinkTokenAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.CreateClientMessengerLink);
        group.MapPost("/messages", SendMessageAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ReplyClientMessenger);
        group.MapPost("/read", MarkReadAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ViewClientMessenger);

        return endpoints;
    }

    private static async Task<IResult> GetSummaryAsync(
        Guid clientId,
        HttpContext httpContext,
        IClientMessengerService messengerService,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var result = await messengerService.GetTelegramSummaryAsync(clientId, currentUser, cancellationToken);
        return ToHttpResult(result);
    }

    private static async Task<IResult> ListMessagesAsync(
        Guid clientId,
        int? skip,
        int? take,
        HttpContext httpContext,
        IClientMessengerService messengerService,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var result = await messengerService.ListTelegramMessagesAsync(
            clientId,
            currentUser,
            skip,
            take,
            cancellationToken);
        return ToHttpResult(result);
    }

    private static async Task<IResult> CreateLinkTokenAsync(
        Guid clientId,
        HttpContext httpContext,
        IClientMessengerService messengerService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var result = await messengerService.CreateTelegramLinkTokenAsync(clientId, currentUser, cancellationToken);
        return ToHttpResult(result);
    }

    private static async Task<IResult> SendMessageAsync(
        Guid clientId,
        SendClientMessengerMessageRequest request,
        HttpContext httpContext,
        IClientMessengerService messengerService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var idempotencyKey = string.IsNullOrWhiteSpace(request.IdempotencyKey)
            ? httpContext.Request.Headers["Idempotency-Key"].FirstOrDefault()
            : request.IdempotencyKey;
        var result = await messengerService.SendTelegramMessageAsync(
            clientId,
            currentUser,
            request.Text ?? string.Empty,
            idempotencyKey,
            cancellationToken);
        return ToHttpResult(result);
    }

    private static async Task<IResult> MarkReadAsync(
        Guid clientId,
        HttpContext httpContext,
        IClientMessengerService messengerService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var result = await messengerService.MarkTelegramReadAsync(clientId, currentUser, cancellationToken);
        return ToHttpResult(result);
    }

    private static IResult ToHttpResult<T>(ClientMessengerResult<T> result)
    {
        return result.Error switch
        {
            ClientMessengerError.None => TypedResults.Ok(result.Value),
            ClientMessengerError.NotFound => TypedResults.NotFound(),
            ClientMessengerError.Forbidden => TypedResults.Forbid(),
            ClientMessengerError.Validation => TypedResults.ValidationProblem(result.ValidationErrors ?? new Dictionary<string, string[]>()),
            ClientMessengerError.NotConnected => TypedResults.Problem(
                title: "Telegram is not connected.",
                detail: "Connect the client Telegram account before sending messages.",
                statusCode: StatusCodes.Status409Conflict),
            ClientMessengerError.IdempotencyConflict => TypedResults.Problem(
                title: "Idempotency conflict.",
                detail: "A message with the same idempotency key has different content.",
                statusCode: StatusCodes.Status409Conflict),
            ClientMessengerError.BotNotConfigured => TypedResults.Problem(
                title: "Client Telegram bot is not configured.",
                statusCode: StatusCodes.Status503ServiceUnavailable),
            ClientMessengerError.TelegramTransportFailure => TypedResults.Problem(
                title: "Telegram request failed.",
                statusCode: StatusCodes.Status502BadGateway),
            _ => TypedResults.Problem(statusCode: StatusCodes.Status500InternalServerError)
        };
    }

    private sealed record SendClientMessengerMessageRequest(
        string? Text,
        string? IdempotencyKey = null);
}
