namespace GymCrm.Api.Auth;

internal sealed record ClientAttentionResponse(
    Guid ClientId,
    string FullName,
    string Phone,
    string? Notes,
    string? TelegramLink,
    IReadOnlyList<ClientAttentionReasonResponse> Reasons);
