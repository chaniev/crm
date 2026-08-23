namespace GymCrm.Application.Bot;

public static class BotAuditConstants
{
    public const string BotAttendanceSavedAction = "BotAttendanceSaved";
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
    TemporaryFailure = 11,
    SingleVisitRestoreConflict = 12
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
    BotAttendanceDateWindow AttendanceDateWindow,
    IReadOnlyList<BotMenuItem> Items);

public sealed record BotMenuItem(string Code, string Label);

public sealed record BotAttendanceDateWindow(
    DateOnly Today,
    DateOnly? MinTrainingDate,
    DateOnly MaxTrainingDate);

public sealed record BotAttendanceGroup(
    Guid Id,
    string Name,
    Guid BranchId,
    string BranchName,
    Guid HallId,
    string HallName,
    string TrainingStartTime,
    int DurationMinutes,
    IReadOnlyList<int> Weekdays,
    bool IsActive,
    int ClientCount);

public sealed record BotAttendanceRoster(
    Guid GroupId,
    string GroupName,
    DateOnly TrainingDate,
    BotAttendanceDateWindow AttendanceDateWindow,
    IReadOnlyList<BotAttendanceClient> Clients);

public sealed record BotAttendanceClient(
    Guid Id,
    string FullName,
    Guid BranchId,
    string BranchName,
    IReadOnlyList<BotClientGroupSummary> Groups,
    BotClientPhoto? Photo,
    bool IsPresent,
    bool IsProfessional,
    string? ProfessionalComment,
    bool HasMembershipWarning,
    string? MembershipWarning,
    bool HasActiveMembership);

public sealed record BotAttendanceMarkInput(Guid ClientId, bool IsPresent);

public sealed record BotAttendanceSaveResponse(
    Guid GroupId,
    string GroupName,
    DateOnly TrainingDate,
    BotAttendanceDateWindow AttendanceDateWindow,
    int MarkedCount,
    int PresentCount,
    int AbsentCount,
    IReadOnlyList<BotAttendanceClientWarning> Warnings);

public sealed record BotAttendanceClientWarning(
    Guid ClientId,
    string FullName,
    string? MembershipWarning);

public sealed record BotClientSearchResponse(
    IReadOnlyList<BotClientListItem> Items,
    int Skip,
    int Take,
    bool HasMore);

public sealed record BotClientListItem(
    Guid Id,
    string FullName,
    string? Phone,
    Guid BranchId,
    string BranchName,
    string Status,
    IReadOnlyList<BotClientGroupSummary> Groups,
    BotClientPhoto? Photo,
    bool IsProfessional,
    string? ProfessionalComment,
    bool HasMembershipWarning,
    string? MembershipWarning,
    bool HasActiveMembership,
    string? BehaviorKind = null,
    string? MembershipLabel = null);

public sealed record BotClientCard(
    Guid Id,
    string FullName,
    string? Phone,
    Guid BranchId,
    string BranchName,
    string Status,
    IReadOnlyList<BotClientGroupSummary> Groups,
    BotClientPhoto? Photo,
    bool IsProfessional,
    string? ProfessionalComment,
    bool HasMembershipWarning,
    string? MembershipWarning,
    bool HasActiveMembership,
    IReadOnlyList<BotClientMembership> CurrentMemberships,
    IReadOnlyList<BotAttendanceHistoryItem> AttendanceHistory);

public sealed record BotClientMembership(
    Guid Id,
    Guid SaleId,
    Guid? MembershipCatalogItemId,
    string BehaviorKind,
    string MembershipLabel,
    string PricingMode,
    decimal GrossAmount,
    decimal? CatalogPrice,
    DateOnly PurchaseDate,
    DateOnly PaymentDate,
    DateOnly? ExpirationDate,
    bool SingleVisitUsed,
    string CoverageKind,
    string EntitlementState,
    IReadOnlyList<BotClientMembershipTarget> TargetGroups);

public sealed record BotClientMembershipTarget(
    Guid GroupId,
    string GroupName,
    Guid BranchId,
    string BranchName,
    int Position,
    bool IsActive);

public sealed record BotAttendanceHistoryItem(
    DateOnly TrainingDate,
    bool IsPresent,
    Guid GroupId,
    string GroupName);

public sealed record BotClientGroupSummary(
    Guid Id,
    string Name,
    Guid BranchId,
    string BranchName,
    Guid HallId,
    string HallName,
    bool IsActive,
    string TrainingStartTime,
    int DurationMinutes,
    IReadOnlyList<int> Weekdays);

public sealed record BotClientPhoto(
    string Path,
    string ContentType,
    long SizeBytes,
    DateTimeOffset UploadedAt,
    bool HasPhoto);

public sealed record BotExpiringMembershipListItem(
    Guid ClientId,
    Guid MembershipId,
    Guid SaleId,
    string FullName,
    string BehaviorKind,
    string MembershipLabel,
    DateOnly ExpirationDate,
    int DaysUntilExpiration,
    IReadOnlyList<BotClientMembershipTarget> TargetGroups);

public sealed record BotAccessDeniedAuditRequest(
    string ActionCode,
    string? EntityType,
    string? EntityId,
    string? Reason);

public sealed record BotAccessDeniedAuditResponse(bool Recorded);
