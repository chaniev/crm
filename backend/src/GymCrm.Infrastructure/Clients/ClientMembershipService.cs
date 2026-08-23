using GymCrm.Application.Clients;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientMembershipService(
    ClientMembershipDetailsReader detailsReader,
    ClientMembershipSaleLifecycleService saleLifecycleService,
    ClientMembershipRefundService refundService,
    ClientMembershipVisitService visitService) : IClientMembershipService
{
    public Task<ClientMembershipDetailsResult?> GetAsync(
        Guid clientId,
        CancellationToken cancellationToken) =>
        detailsReader.GetAsync(clientId, cancellationToken);

    public Task<ClientMembershipMutationResult> PurchaseAsync(
        Guid clientId,
        CreateClientMembershipPurchaseCommand command,
        CancellationToken cancellationToken) =>
        saleLifecycleService.PurchaseAsync(clientId, command, cancellationToken);

    public Task<ClientMembershipMutationResult> RenewAsync(
        Guid clientId,
        RenewClientMembershipCommand command,
        CancellationToken cancellationToken) =>
        saleLifecycleService.RenewAsync(clientId, command, cancellationToken);

    public Task<ClientMembershipCommentMutationResult> UpdateCommentAsync(
        Guid clientId,
        Guid saleId,
        UpdateClientMembershipCommentCommand command,
        CancellationToken cancellationToken) =>
        saleLifecycleService.UpdateCommentAsync(clientId, saleId, command, cancellationToken);

    public Task<ClientMembershipMutationResult> CorrectAsync(
        Guid clientId,
        CorrectClientMembershipCommand command,
        CancellationToken cancellationToken) =>
        saleLifecycleService.CorrectAsync(clientId, command, cancellationToken);

    public Task<ClientMembershipRefundMutationResult> RegisterRefundAsync(
        Guid clientId,
        RegisterClientMembershipRefundCommand command,
        CancellationToken cancellationToken) =>
        refundService.RegisterRefundAsync(clientId, command, cancellationToken);

    public Task<ClientMembershipRefundMutationResult> CancelRefundAsync(
        Guid clientId,
        CancelClientMembershipRefundCommand command,
        CancellationToken cancellationToken) =>
        refundService.CancelRefundAsync(clientId, command, cancellationToken);

    public Task<SingleVisitWriteOffResult> WriteOffSingleVisitAsync(
        Guid clientId,
        WriteOffSingleVisitCommand command,
        CancellationToken cancellationToken) =>
        visitService.WriteOffSingleVisitAsync(clientId, command, cancellationToken);

    public Task<SingleVisitRestoreResult> RestoreSingleVisitAsync(
        Guid clientId,
        RestoreSingleVisitCommand command,
        CancellationToken cancellationToken) =>
        visitService.RestoreSingleVisitAsync(clientId, command, cancellationToken);
}
