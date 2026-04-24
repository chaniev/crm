using GymCrm.Domain.Users;

namespace GymCrm.Application.Bot;

public static class BotAuditConstants
{
    public const string BotAttendanceSavedAction = "BotAttendanceSaved";
    public const string BotMembershipPaymentMarkedAction = "BotMembershipPaymentMarked";
    public const string BotAccessDeniedAction = "BotAccessDenied";
    public const string TelegramPlatform = "Telegram";
}

public sealed record BotIdentity(string Platform, string PlatformUserId);

public enum BotApiError
{
    None = 0,
    UnknownUser = 1,
    UserInactive = 2,
    PasswordChangeRequired = 3,
    Forbidden = 4,
    InvalidAttendanceDate = 5,
    NotFound = 6,
    Validation = 7,
    IdempotencyConflict = 8,
    CurrentMembershipMissing = 9,
    CurrentMembershipAlreadyPaid = 10,
    TemporaryFailure = 11
}

public sealed record BotApiResult<T>(
    BotApiError Error,
    T? Value,
    IReadOnlyDictionary<string, string[]>? ValidationErrors = null)
{
    public bool Succeeded => Error == BotApiError.None;

    public static BotApiResult<T> Success(T value) => new(BotApiError.None, value);

    public static BotApiResult<T> Failure(BotApiError error) => new(error, default);

    public static BotApiResult<T> Validation(IReadOnlyDictionary<string, string[]> errors) =>
        new(BotApiError.Validation, default, errors);
}

public sealed record BotUserContext(
    Guid UserId,
    string FullName,
    string Login,
    string Role,
    string Platform,
    string PlatformUserId);

public sealed record BotMenuResponse(
    BotUserContext User,
    IReadOnlyList<BotMenuItem> Items);

public sealed record BotMenuItem(string Code, string Label);

public sealed record BotAttendanceGroup(
    Guid Id,
    string Name,
    string TrainingStartTime,
    string ScheduleText,
    bool IsActive,
    int ClientCount);

public sealed record BotAttendanceRoster(
    Guid GroupId,
    string GroupName,
    DateOnly TrainingDate,
    IReadOnlyList<BotAttendanceClient> Clients);

public sealed record BotAttendanceClient(
    Guid Id,
    string FullName,
    IReadOnlyList<BotClientGroupSummary> Groups,
    BotClientPhoto? Photo,
    bool IsPresent,
    bool HasMembershipWarning,
    string? MembershipWarning,
    bool HasUnpaidCurrentMembership,
    bool HasActivePaidMembership);

public sealed record BotAttendanceMarkInput(Guid ClientId, bool IsPresent);

public sealed record BotAttendanceSaveResponse(
    Guid GroupId,
    string GroupName,
    DateOnly TrainingDate,
    int MarkedCount,
    int PresentCount,
    int AbsentCount,
    IReadOnlyList<BotAttendanceClientWarning> Warnings);

public sealed record BotAttendanceClientWarning(
    Guid ClientId,
    string FullName,
    string? MembershipWarning,
    bool HasUnpaidCurrentMembership);

public sealed record BotClientSearchResponse(
    IReadOnlyList<BotClientListItem> Items,
    int Skip,
    int Take,
    bool HasMore);

public sealed record BotClientListItem(
    Guid Id,
    string FullName,
    string? Phone,
    string Status,
    IReadOnlyList<BotClientGroupSummary> Groups,
    BotClientPhoto? Photo,
    bool HasMembershipWarning,
    string? MembershipWarning,
    bool HasUnpaidCurrentMembership,
    bool HasActivePaidMembership);

public sealed record BotClientCard(
    Guid Id,
    string FullName,
    string? Phone,
    string Status,
    IReadOnlyList<BotClientGroupSummary> Groups,
    BotClientPhoto? Photo,
    bool HasMembershipWarning,
    string? MembershipWarning,
    bool HasUnpaidCurrentMembership,
    bool HasActivePaidMembership,
    BotClientMembership? CurrentMembership,
    IReadOnlyList<BotAttendanceHistoryItem> AttendanceHistory);

public sealed record BotClientMembership(
    Guid Id,
    string MembershipType,
    DateOnly PurchaseDate,
    DateOnly? ExpirationDate,
    decimal? PaymentAmount,
    bool IsPaid,
    bool SingleVisitUsed);

public sealed record BotAttendanceHistoryItem(
    DateOnly TrainingDate,
    bool IsPresent,
    Guid GroupId,
    string GroupName);

public sealed record BotClientGroupSummary(
    Guid Id,
    string Name,
    bool IsActive,
    string TrainingStartTime,
    string ScheduleText);

public sealed record BotClientPhoto(
    string Path,
    string ContentType,
    long SizeBytes,
    DateTimeOffset UploadedAt,
    bool HasPhoto);

public sealed record BotExpiringMembershipListItem(
    Guid ClientId,
    string FullName,
    string MembershipType,
    DateOnly ExpirationDate,
    int DaysUntilExpiration,
    bool IsPaid);

public sealed record BotUnpaidMembershipListItem(
    Guid ClientId,
    string FullName,
    string MembershipType,
    DateOnly PurchaseDate,
    DateOnly? ExpirationDate,
    bool IsPaid);

public sealed record BotMembershipPaymentResponse(
    Guid ClientId,
    string FullName,
    string MembershipType,
    DateOnly PurchaseDate,
    DateOnly? ExpirationDate,
    bool IsPaid,
    bool WasAlreadyPaid);

public sealed record BotAccessDeniedAuditRequest(
    string ActionCode,
    string? EntityType,
    string? EntityId,
    string? Reason);

public sealed record BotAccessDeniedAuditResponse(bool Recorded);
