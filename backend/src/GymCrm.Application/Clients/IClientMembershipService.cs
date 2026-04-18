using GymCrm.Domain.Clients;

namespace GymCrm.Application.Clients;

public interface IClientMembershipService
{
    Task<ClientMembershipDetailsResult?> GetAsync(
        Guid clientId,
        CancellationToken cancellationToken);

    Task<ClientMembershipMutationResult> PurchaseAsync(
        Guid clientId,
        CreateClientMembershipPurchaseCommand command,
        CancellationToken cancellationToken);

    Task<ClientMembershipMutationResult> RenewAsync(
        Guid clientId,
        RenewClientMembershipCommand command,
        CancellationToken cancellationToken);

    Task<ClientMembershipMutationResult> CorrectAsync(
        Guid clientId,
        CorrectClientMembershipCommand command,
        CancellationToken cancellationToken);

    Task<ClientMembershipMutationResult> MarkPaymentAsync(
        Guid clientId,
        MarkClientMembershipPaymentCommand command,
        CancellationToken cancellationToken);

    Task<SingleVisitWriteOffResult> WriteOffSingleVisitAsync(
        Guid clientId,
        WriteOffSingleVisitCommand command,
        CancellationToken cancellationToken);
}

public sealed record CreateClientMembershipPurchaseCommand(
    Guid ChangedByUserId,
    MembershipType MembershipType,
    DateOnly PurchaseDate,
    DateOnly? ExpirationDate,
    decimal PaymentAmount,
    bool IsPaid);

public sealed record RenewClientMembershipCommand(
    Guid ChangedByUserId,
    DateOnly RenewalDate,
    DateOnly? ExpirationDate,
    decimal PaymentAmount,
    bool IsPaid);

public sealed record CorrectClientMembershipCommand(
    Guid ChangedByUserId,
    MembershipType MembershipType,
    DateOnly PurchaseDate,
    DateOnly? ExpirationDate,
    decimal PaymentAmount,
    bool IsPaid);

public sealed record MarkClientMembershipPaymentCommand(
    Guid ChangedByUserId);

public sealed record WriteOffSingleVisitCommand(
    Guid ChangedByUserId,
    DateOnly TrainingDate);

public enum ClientMembershipMutationError
{
    None = 0,
    ClientMissing = 1,
    InvalidRequest = 2,
    CurrentMembershipMissing = 3,
    CurrentMembershipAlreadyPaid = 4
}

public enum SingleVisitWriteOffStatus
{
    Applied = 0,
    InvalidRequest = 1,
    ClientMissing = 2,
    CurrentMembershipMissing = 3,
    MembershipNotSingleVisit = 4,
    SingleVisitAlreadyUsed = 5,
    MembershipPurchasedAfterTrainingDate = 6
}

public sealed record ClientMembershipDetailsResult(
    Guid ClientId,
    ClientMembershipSnapshotResult? CurrentMembership,
    IReadOnlyList<ClientMembershipSnapshotResult> MembershipHistory);

public sealed record ClientMembershipSnapshotResult(
    Guid Id,
    MembershipType MembershipType,
    DateOnly PurchaseDate,
    DateOnly? ExpirationDate,
    decimal PaymentAmount,
    bool IsPaid,
    bool SingleVisitUsed,
    Guid? PaidByUserId,
    DateTimeOffset? PaidAt,
    DateTimeOffset ValidFrom,
    DateTimeOffset? ValidTo,
    ClientMembershipChangeReason ChangeReason,
    Guid ChangedByUserId,
    DateTimeOffset CreatedAt);

public readonly record struct ClientMembershipMutationResult(
    ClientMembershipMutationError Error,
    ClientMembershipDetailsResult? Details)
{
    public bool Succeeded => Error == ClientMembershipMutationError.None;

    public static ClientMembershipMutationResult Success(ClientMembershipDetailsResult details) =>
        new(ClientMembershipMutationError.None, details);

    public static ClientMembershipMutationResult Failure(ClientMembershipMutationError error) =>
        new(error, null);
}

public readonly record struct SingleVisitWriteOffResult(
    SingleVisitWriteOffStatus Status,
    ClientMembershipSnapshotResult? PreviousMembership,
    ClientMembershipSnapshotResult? CurrentMembership)
{
    public bool Applied => Status == SingleVisitWriteOffStatus.Applied;

    public static SingleVisitWriteOffResult Success(
        ClientMembershipSnapshotResult previousMembership,
        ClientMembershipSnapshotResult currentMembership) =>
        new(SingleVisitWriteOffStatus.Applied, previousMembership, currentMembership);

    public static SingleVisitWriteOffResult Skip(SingleVisitWriteOffStatus status) =>
        new(status, null, null);
}
