using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace GymCrm.Application.Scheduling;

public static class ScheduleMutationTokenPolicy
{
    public const string OneOffCreatePurpose = "schedule-one-off-create";
    public const string OccurrenceChangePurpose = "schedule-occurrence-change";
    public const string OccurrenceCancellationPurpose = "schedule-occurrence-cancellation";
    public const string LessonTrainerSubstitutionPurpose = "schedule-lesson-trainer-substitution";
    public const string LessonTrainerSubstitutionCancellationPurpose = "schedule-lesson-trainer-substitution-cancellation";
    public const string GroupCreatePurpose = "group-create-initial-series";
    public const string GroupTrainerAssignmentsPurpose = "group-trainer-assignments";
    public const string GroupLessonSeriesPurpose = "group-lesson-series";
    public const string PreviewInvalidCode = "lesson-mutation-preview-invalid";
    public const string PreviewExpiredCode = "lesson-mutation-preview-expired";
    public const string PreviewStaleCode = "lesson-mutation-preview-stale";
    public static readonly TimeSpan ConfirmationTokenLifetime = TimeSpan.FromMinutes(15);

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static string CreateSecureToken()
    {
        return Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
    }

    public static string ComputeSha256Base64Url(string value)
    {
        return Base64UrlEncode(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    }

    public static string SerializePayload(ScheduleOneOffConfirmationPayload payload)
    {
        return JsonSerializer.Serialize(payload, JsonOptions);
    }

    public static string SerializePayload(GroupCreateConfirmationPayload payload)
    {
        return JsonSerializer.Serialize(payload, JsonOptions);
    }

    public static string SerializePayload(GroupTrainerAssignmentsConfirmationPayload payload)
    {
        return JsonSerializer.Serialize(payload, JsonOptions);
    }

    public static string SerializePayload(GroupLessonSeriesConfirmationPayload payload)
    {
        return JsonSerializer.Serialize(payload, JsonOptions);
    }

    public static ScheduleOneOffConfirmationPayload? DeserializePayload(string payloadJson)
    {
        return JsonSerializer.Deserialize<ScheduleOneOffConfirmationPayload>(payloadJson, JsonOptions);
    }

    public static string SerializePayload(ScheduleOccurrenceChangeConfirmationPayload payload)
    {
        return JsonSerializer.Serialize(payload, JsonOptions);
    }

    public static ScheduleOccurrenceChangeConfirmationPayload? DeserializeChangePayload(string payloadJson)
    {
        return JsonSerializer.Deserialize<ScheduleOccurrenceChangeConfirmationPayload>(payloadJson, JsonOptions);
    }

    public static bool PayloadMatches(string expectedHash, ScheduleOneOffConfirmationPayload payload)
    {
        var actualHash = ComputeSha256Base64Url(SerializePayload(payload));
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedHash),
            Encoding.UTF8.GetBytes(actualHash));
    }

    public static bool PayloadMatches(string expectedHash, ScheduleOccurrenceChangeConfirmationPayload payload)
    {
        var actualHash = ComputeSha256Base64Url(SerializePayload(payload));
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedHash),
            Encoding.UTF8.GetBytes(actualHash));
    }

    public static string SerializePayload(ScheduleOccurrenceCancellationConfirmationPayload payload)
    {
        return JsonSerializer.Serialize(payload, JsonOptions);
    }

    public static bool PayloadMatches(string expectedHash, ScheduleOccurrenceCancellationConfirmationPayload payload)
    {
        var actualHash = ComputeSha256Base64Url(SerializePayload(payload));
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedHash),
            Encoding.UTF8.GetBytes(actualHash));
    }

    public static string SerializePayload(ScheduleLessonTrainerSubstitutionConfirmationPayload payload)
    {
        return JsonSerializer.Serialize(payload, JsonOptions);
    }

    public static bool PayloadMatches(string expectedHash, ScheduleLessonTrainerSubstitutionConfirmationPayload payload)
    {
        var actualHash = ComputeSha256Base64Url(SerializePayload(payload));
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedHash),
            Encoding.UTF8.GetBytes(actualHash));
    }

    public static string SerializePayload(ScheduleLessonTrainerSubstitutionCancellationConfirmationPayload payload)
    {
        return JsonSerializer.Serialize(payload, JsonOptions);
    }

    public static bool PayloadMatches(string expectedHash, ScheduleLessonTrainerSubstitutionCancellationConfirmationPayload payload)
    {
        var actualHash = ComputeSha256Base64Url(SerializePayload(payload));
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedHash),
            Encoding.UTF8.GetBytes(actualHash));
    }

    public static bool PayloadMatches(string expectedHash, GroupCreateConfirmationPayload payload)
    {
        var actualHash = ComputeSha256Base64Url(SerializePayload(payload));
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedHash),
            Encoding.UTF8.GetBytes(actualHash));
    }

    public static bool PayloadMatches(string expectedHash, GroupTrainerAssignmentsConfirmationPayload payload)
    {
        var actualHash = ComputeSha256Base64Url(SerializePayload(payload));
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedHash),
            Encoding.UTF8.GetBytes(actualHash));
    }

    public static bool PayloadMatches(string expectedHash, GroupLessonSeriesConfirmationPayload payload)
    {
        var actualHash = ComputeSha256Base64Url(SerializePayload(payload));
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedHash),
            Encoding.UTF8.GetBytes(actualHash));
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}

public sealed record ScheduleOneOffConfirmationPayload(
    Guid OccurrenceId,
    Guid GroupId,
    string LessonDate,
    string StartTime,
    int DurationMinutes,
    Guid HallId);

public sealed record GroupCreateConfirmationPayload(
    string Name,
    Guid BranchId,
    Guid GroupTypeId,
    bool IsActive,
    IReadOnlyList<Guid> TrainerIds,
    string StartsOn,
    string? EndsOn,
    IReadOnlyList<GroupCreateSlotConfirmationPayload> Slots);

public sealed record GroupCreateSlotConfirmationPayload(
    int IsoWeekday,
    string StartTime,
    int DurationMinutes,
    Guid HallId);

public sealed record GroupTrainerAssignmentsConfirmationPayload(
    Guid GroupId,
    string ExpectedRevision,
    IReadOnlyList<GroupTrainerAssignmentConfirmationPayload> Assignments,
    IReadOnlyList<string> WarningCodes);

public sealed record GroupTrainerAssignmentConfirmationPayload(
    Guid TrainerId,
    string ValidFrom,
    string? ValidTo);

public sealed record GroupLessonSeriesConfirmationPayload(
    Guid GroupId,
    Guid SeriesId,
    string Scope,
    string EffectiveFrom,
    string? EndsOn,
    string ExpectedRevision,
    IReadOnlyList<GroupLessonSeriesSlotConfirmationPayload> Slots,
    IReadOnlyList<string> WarningCodes);

public sealed record GroupLessonSeriesSlotConfirmationPayload(
    int IsoWeekday,
    string StartTime,
    int DurationMinutes,
    Guid HallId);

public sealed record ScheduleOccurrenceChangeConfirmationPayload(
    Guid OccurrenceId,
    string LocatorLessonDate,
    string Scope,
    string NewLessonDate,
    string StartTime,
    int DurationMinutes,
    Guid HallId,
    string ExpectedRevision,
    IReadOnlyList<string> WarningCodes);

public sealed record ScheduleOccurrenceCancellationConfirmationPayload(
    Guid OccurrenceId,
    string LocatorLessonDate,
    string Action,
    string ExpectedRevision,
    string Status);

public sealed record ScheduleLessonTrainerSubstitutionConfirmationPayload(
    Guid ReplacedTrainerId,
    Guid SubstituteTrainerId,
    IReadOnlyList<ScheduleLessonTrainerSubstitutionTargetConfirmationPayload> Targets,
    IReadOnlyList<string> WarningCodes);

public sealed record ScheduleLessonTrainerSubstitutionTargetConfirmationPayload(
    Guid LessonOccurrenceId,
    string LessonDate,
    string ExpectedRevision);

public sealed record ScheduleLessonTrainerSubstitutionCancellationConfirmationPayload(
    IReadOnlyList<ScheduleLessonTrainerSubstitutionCancellationTargetConfirmationPayload> Targets,
    string? Reason,
    IReadOnlyList<string> WarningCodes);

public sealed record ScheduleLessonTrainerSubstitutionCancellationTargetConfirmationPayload(
    Guid LessonOccurrenceId,
    string LessonDate,
    Guid SubstitutionId,
    string ExpectedRevision);
