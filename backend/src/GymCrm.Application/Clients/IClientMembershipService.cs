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

public enum ClientMembershipMutationError
{
    None = 0,
    ClientMissing = 1,
    InvalidRequest = 2,
    CurrentMembershipMissing = 3,
    CurrentMembershipAlreadyPaid = 4
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
