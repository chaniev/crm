using GymCrm.Domain.Memberships;

namespace GymCrm.Application.Clients;

public interface IClientMembershipTargetTransferService
{
    Task<ClientMembershipTargetTransferResult> PreviewAsync(
        Guid clientId,
        ClientMembershipTargetTransferCommand command,
        CancellationToken cancellationToken);

    Task<ClientMembershipTargetTransferResult> TransferAsync(
        Guid clientId,
        ClientMembershipTargetTransferCommand command,
        CancellationToken cancellationToken);
}

public sealed record ClientMembershipTargetTransferCommand(
    Guid ActorUserId,
    Guid? SourceGroupId,
    Guid? TargetGroupId,
    IReadOnlyList<Guid> ExpectedMembershipIds);

public readonly record struct ClientMembershipTargetTransferResult(
    ClientMembershipTargetTransferStatus Status,
    ClientMembershipTargetTransferPreviewResult? Preview,
    string? Field,
    string? Message)
{
    public bool Succeeded => Status == ClientMembershipTargetTransferStatus.Success;

    public static ClientMembershipTargetTransferResult Success(ClientMembershipTargetTransferPreviewResult preview) =>
        new(ClientMembershipTargetTransferStatus.Success, preview, null, null);

    public static ClientMembershipTargetTransferResult Failure(
        ClientMembershipTargetTransferStatus status,
        string field,
        string message) =>
        new(status, null, field, message);
}

public enum ClientMembershipTargetTransferStatus
{
    Success = 0,
    InvalidRequest = 1,
    ClientMissing = 2,
    TargetUnavailable = 3,
    CrossBranchTarget = 4,
    StaleExpectedMemberships = 5,
    DuplicateTarget = 6,
    MembershipOverlap = 7,
    MembershipTargetMissing = 8
}

public sealed record ClientMembershipTargetTransferPreviewResult(
    Guid ClientId,
    Guid SourceGroupId,
    Guid TargetGroupId,
    IReadOnlyList<ClientMembershipTargetTransferItemResult> AffectedMemberships);

public sealed record ClientMembershipTargetTransferItemResult(
    Guid MembershipId,
    Guid SaleId,
    string MembershipName,
    MembershipBehaviorKind BehaviorKind,
    IReadOnlyList<ClientMembershipTargetSnapshotResult> BeforeTargets,
    IReadOnlyList<ClientMembershipTargetSnapshotResult> AfterTargets);
