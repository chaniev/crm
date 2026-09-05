using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class ClientResponseMapper
{
    internal static async Task<Client?> LoadClientSnapshotAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.Clients
            .AsNoTracking()
            .Include(client => client.Branch)
            .Include(client => client.NotesChangedByUser)
            .Include(client => client.Contacts)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.Refunds)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.CommentChangedByUser)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.CreatedByUser)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.TargetGroups)
                    .ThenInclude(target => target.Group)
                        .ThenInclude(group => group.Branch)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Trainers)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Branch)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Hall)
            .AsSplitQuery()
            .SingleOrDefaultAsync(client => client.Id == id, cancellationToken);
    }

    internal static async Task<ClientAttendanceHistoryPageResponse> LoadAttendanceHistoryAsync(
        Guid clientId,
        IReadOnlyCollection<Guid>? allowedGroupIds,
        AttendanceHistoryPaging paging,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Attendance
            .AsNoTracking()
            .Where(attendance => attendance.ClientId == clientId);

        if (allowedGroupIds is { Count: > 0 })
        {
            query = query.Where(attendance => allowedGroupIds.Contains(attendance.GroupId));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(attendance => attendance.TrainingDate)
            .ThenByDescending(attendance => attendance.UpdatedAt)
            .ThenByDescending(attendance => attendance.Id)
            .Skip(paging.Skip)
            .Take(paging.Take)
            .Select(attendance => new ClientAttendanceHistoryEntryResponse(
                attendance.Id,
                attendance.TrainingDate,
                attendance.IsPresent,
                attendance.GroupId,
                attendance.Group.Name,
                attendance.Group.TrainingStartTime.ToString("HH\\:mm"),
                attendance.Group.DurationMinutes,
                attendance.Group.Weekdays))
            .ToArrayAsync(cancellationToken);

        return new ClientAttendanceHistoryPageResponse(
            items,
            paging.Skip,
            paging.Take,
            totalCount,
            paging.Skip + items.Length < totalCount);
    }


    internal static ClientAttendanceHistoryPageResponse EmptyAttendanceHistoryPage()
    {
        return new ClientAttendanceHistoryPageResponse([], 0, ClientApiConstants.DefaultTake, 0, false);
    }

    internal static async Task<IReadOnlyList<ClientListItemResponse>> HydrateClientListItemsAsync(
        IReadOnlyList<ClientListItemResponse> items,
        bool hasElevatedClientAccess,
        GymCrmDbContext dbContext,
        IReadOnlyCollection<Guid> effectiveGroupIds,
        DateOnly businessDate,
        CancellationToken cancellationToken)
    {
        if (items.Count == 0)
        {
            return items;
        }

        var clientIds = items.Select(item => item.Id).ToArray();
        var currentMemberships = await dbContext.ClientMemberships
            .AsNoTracking()
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.CreatedByUser)
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.Refunds)
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.CommentChangedByUser)
            .Include(membership => membership.TargetGroups)
                .ThenInclude(target => target.Group)
                    .ThenInclude(group => group.Branch)
            .Where(membership => clientIds.Contains(membership.ClientId) && membership.ValidTo == null)
            .ToArrayAsync(cancellationToken);
        var attendanceQuery = dbContext.Attendance
            .AsNoTracking()
            .Where(attendance => clientIds.Contains(attendance.ClientId) && attendance.IsPresent);

        if (!hasElevatedClientAccess)
        {
            attendanceQuery = attendanceQuery.Where(attendance => effectiveGroupIds.Contains(attendance.GroupId));
        }

        var lastVisits = await attendanceQuery
            .GroupBy(attendance => attendance.ClientId)
            .Select(group => new ClientLastVisitProjection(
                group.Key,
                group.Max(attendance => attendance.TrainingDate)))
            .ToArrayAsync(cancellationToken);
        var lastVisitByClientId = lastVisits.ToDictionary(
            lastVisit => lastVisit.ClientId,
            lastVisit => (DateOnly?)lastVisit.TrainingDate);

        return items
            .Select(item =>
            {
                var currentMembershipEntities = currentMemberships
                    .Where(membership => membership.ClientId == item.Id)
                    .OrderByDescending(membership => membership.IndividualValidTo ?? DateOnly.MaxValue)
                    .ThenByDescending(membership => membership.IndividualValidFrom ?? DateOnly.MaxValue)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .ToArray();
                var orderedMemberships = currentMembershipEntities
                    .Select(membership => MapMembership(membership, businessDate))
                    .ToArray();
                lastVisitByClientId.TryGetValue(item.Id, out var lastVisitDate);

                return item with
                {
                    HasActiveMembership = HasActiveMembership(currentMembershipEntities, businessDate),
                    CurrentMemberships = hasElevatedClientAccess ? orderedMemberships : [],
                    HasCurrentMembership = currentMembershipEntities.Length > 0,
                    MembershipState = GetMembershipState(currentMembershipEntities, businessDate).ToString(),
                    LastVisitDate = lastVisitDate,
                    ActionHints = BuildActionHints(
                        item.IsProfessional,
                        item.ProfessionalComment,
                        currentMembershipEntities,
                        businessDate,
                        item.Groups.Count)
                };
            })
            .ToArray();
    }

    internal static ClientDetailsResponse MapDetails(
        Client client,
        ClientAttendanceHistoryPageResponse attendanceHistory,
        DateOnly businessDate,
        ILogger? logger = null)
    {
        var today = businessDate;
        var groups = MapGroups(client.Groups);
        var contacts = client.Contacts
            .Select(contact => new ClientContactResponse(
                contact.Type,
                contact.FullName,
                contact.Phone))
            .OrderBy(contact => contact.FullName, StringComparer.CurrentCulture)
            .ThenBy(contact => contact.Type, StringComparer.CurrentCulture)
            .ThenBy(contact => contact.Phone, StringComparer.CurrentCulture)
            .ToArray();
        var membershipHistory = MapMembershipHistory(client.Memberships, businessDate, logger);
        var currentMembershipEntities = GetCurrentMemberships(client);
        var currentMemberships = currentMembershipEntities
            .Select(membership => MapMembership(membership, businessDate, logger))
            .ToArray();
        var professionalMembership = currentMembershipEntities.SingleOrDefault(membership =>
            membership.BehaviorKind == MembershipBehaviorKind.Professional &&
            ClientMembershipTargetPolicy.ResolveEntitlementState(membership, businessDate) ==
            ClientMembershipEntitlementState.Active);
        var notesMetadata = ResolveNotesMetadata(client, logger);

        return new ClientDetailsResponse(
            client.Id,
            client.LastName,
            client.FirstName,
            client.MiddleName,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            client.Phone,
            client.BranchId,
            client.Branch.Name,
            client.BirthDate,
            businessDate,
            client.Notes,
            notesMetadata.Name,
            notesMetadata.ChangedAt,
            client.Status.ToString(),
            groups.Select(group => group.Id).ToArray(),
            groups,
            contacts,
            MapPhoto(client),
            professionalMembership is not null,
            professionalMembership?.ProfessionalComment,
            HasActiveMembership(currentMembershipEntities, businessDate),
            currentMemberships,
            BuildActionHints(professionalMembership is not null, professionalMembership?.ProfessionalComment, currentMembershipEntities, businessDate, groups.Count),
            membershipHistory,
            attendanceHistory.Items,
            attendanceHistory.Skip,
            attendanceHistory.Take,
            attendanceHistory.TotalCount,
            attendanceHistory.HasMore,
            client.CreatedAt,
            client.UpdatedAt);
    }

    internal static ClientDetailsResponse MapCoachDetails(
        Client client,
        IReadOnlyCollection<ClientGroup> coachGroups,
        ClientAttendanceHistoryPageResponse attendanceHistory,
        DateOnly businessDate,
        ILogger? logger = null)
    {
        var today = businessDate;
        var groups = MapGroups(coachGroups);
        var currentMembershipEntities = GetCurrentMemberships(client);
        var professionalMembership = currentMembershipEntities.SingleOrDefault(membership =>
            membership.BehaviorKind == MembershipBehaviorKind.Professional &&
            ClientMembershipTargetPolicy.ResolveEntitlementState(membership, businessDate) ==
            ClientMembershipEntitlementState.Active);
        var notesMetadata = ResolveNotesMetadata(client, logger);

        return new ClientDetailsResponse(
            client.Id,
            client.LastName,
            client.FirstName,
            client.MiddleName,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            string.Empty,
            client.BranchId,
            client.Branch.Name,
            client.BirthDate,
            businessDate,
            client.Notes,
            notesMetadata.Name,
            notesMetadata.ChangedAt,
            client.Status.ToString(),
            groups.Select(group => group.Id).ToArray(),
            groups,
            [],
            MapPhoto(client),
            professionalMembership is not null,
            professionalMembership?.ProfessionalComment,
            HasActiveMembership(currentMembershipEntities, businessDate),
            [],
            BuildActionHints(professionalMembership is not null, professionalMembership?.ProfessionalComment, currentMembershipEntities, businessDate, groups.Count),
            [],
            attendanceHistory.Items,
            attendanceHistory.Skip,
            attendanceHistory.Take,
            attendanceHistory.TotalCount,
            attendanceHistory.HasMore,
            client.CreatedAt,
            client.UpdatedAt);
    }

    private static IReadOnlyList<ClientGroupSummaryResponse> MapGroups(IEnumerable<ClientGroup> groups)
    {
        return groups
            .Select(clientGroup => new ClientGroupSummaryResponse(
                clientGroup.GroupId,
                clientGroup.Group.Name,
                clientGroup.Group.BranchId,
                clientGroup.Group.Branch.Name,
                clientGroup.Group.HallId,
                clientGroup.Group.Hall.Name,
                clientGroup.Group.IsActive,
                clientGroup.Group.TrainingStartTime.ToString("HH\\:mm"),
                clientGroup.Group.DurationMinutes,
                clientGroup.Group.Weekdays))
            .OrderBy(group => group.Name, StringComparer.CurrentCulture)
            .ThenBy(group => group.Id)
            .ToArray();
    }

    private static IReadOnlyList<ClientMembershipResponse> MapMembershipHistory(
        ICollection<ClientMembership> memberships,
        DateOnly businessDate,
        ILogger? logger = null)
    {
        return memberships
            .OrderByDescending(membership => membership.ValidFrom)
            .ThenByDescending(membership => membership.CreatedAt)
            .ThenByDescending(membership => membership.Id)
            .Select(membership => MapMembership(membership, businessDate, logger))
            .ToArray();
    }

    private static ClientPhotoSummaryResponse? MapPhoto(Client client)
    {
        if (string.IsNullOrWhiteSpace(client.PhotoPath) ||
            string.IsNullOrWhiteSpace(client.PhotoContentType) ||
            client.PhotoSizeBytes is null ||
            client.PhotoUploadedAt is null)
        {
            return null;
        }

        return new ClientPhotoSummaryResponse(
            client.PhotoPath,
            client.PhotoContentType,
            client.PhotoSizeBytes.Value,
            client.PhotoUploadedAt.Value,
            true);
    }

    private static ClientMembershipResponse MapMembership(ClientMembership membership, DateOnly businessDate, ILogger? logger = null)
    {
        var commentMetadata = ResolveMembershipCommentMetadata(membership.Sale, logger);
        return new ClientMembershipResponse(
            membership.Id,
            membership.SaleId,
            membership.Sale.MembershipCatalogItemId,
            ClientMembershipSaleDisplay.GetMembershipName(membership.Sale),
            membership.BehaviorKind.ToString(),
            membership.Sale.PricingMode.ToString(),
            membership.Sale.GrossAmount,
            ClientMembershipSaleDisplay.GetCatalogPrice(membership.Sale),
            membership.Sale.PurchaseDate,
            membership.Sale.PaymentDate,
            membership.IndividualValidTo,
            membership.IndividualValidFrom,
            membership.IndividualValidTo,
            membership.ProfessionalComment,
            membership.SingleVisitUsed,
            membership.Sale.CreatedByUserId,
            membership.Sale.CreatedByUser.FullName,
            membership.Sale.CreatedAt,
            membership.ChangeReason.ToString(),
            membership.ValidFrom,
            membership.ValidTo,
            membership.CreatedAt,
            ClientMembershipTargetPolicy.ResolveCoverageKind(membership.BehaviorKind).ToString(),
            ClientMembershipTargetPolicy.ResolveEntitlementState(membership, businessDate).ToString(),
            MapMembershipTargets(membership.TargetGroups),
            membership.Sale.Comment,
            commentMetadata.Name,
            commentMetadata.ChangedAt,
            MapFinancialSummary(membership.Sale),
            MapRefunds(membership.Sale));
    }

    private static (string? Name, DateTimeOffset? ChangedAt) ResolveMembershipCommentMetadata(ClientMembershipSale sale, ILogger? logger)
    {
        if (sale.CommentChangedByUserId.HasValue && sale.CommentChangedAt.HasValue && sale.CommentChangedByUser is not null)
            return (sale.CommentChangedByUser.FullName, sale.CommentChangedAt);

        if (sale.CommentChangedByUserId.HasValue || sale.CommentChangedAt.HasValue)
        {
            logger?.LogWarning(
                "Membership comment metadata is incomplete or its author cannot be resolved. SaleId={SaleId} HasActorId={HasActorId} HasChangedAt={HasChangedAt} HasResolvedActor={HasResolvedActor}",
                sale.Id,
                sale.CommentChangedByUserId.HasValue,
                sale.CommentChangedAt.HasValue,
                sale.CommentChangedByUser is not null);
        }
        return (null, null);
    }

    private static IReadOnlyList<ClientMembershipTargetGroupResponse> MapMembershipTargets(
        IEnumerable<ClientMembershipTargetGroup> targets)
    {
        return targets
            .OrderBy(target => target.Position)
            .Select(target => new ClientMembershipTargetGroupResponse(
                target.GroupId,
                target.Group.Name,
                target.BranchId,
                target.Group.Branch.Name,
                target.Position,
                target.Group.IsActive))
            .ToArray();
    }

    private static ClientMembershipFinancialSummaryResponse MapFinancialSummary(ClientMembershipSale sale)
    {
        var nonCanceledRefunds = sale.Refunds
            .Where(refund => refund.CanceledAt is null)
            .ToArray();
        var refundedAmount = nonCanceledRefunds.Sum(refund => refund.Amount);
        var refundStatus = refundedAmount <= 0
            ? ClientMembershipRefundStatus.None
            : refundedAmount >= sale.GrossAmount
                ? ClientMembershipRefundStatus.Full
                : ClientMembershipRefundStatus.Partial;

        return new ClientMembershipFinancialSummaryResponse(
            sale.GrossAmount,
            refundedAmount,
            sale.GrossAmount - refundedAmount,
            refundStatus.ToString(),
            nonCanceledRefunds
                .Select(refund => (DateOnly?)refund.RefundDate)
                .OrderByDescending(refundDate => refundDate)
                .FirstOrDefault());
    }

    private static IReadOnlyList<ClientMembershipRefundResponse> MapRefunds(ClientMembershipSale sale)
    {
        return sale.Refunds
            .OrderByDescending(refund => refund.RefundDate)
            .ThenByDescending(refund => refund.CreatedAt)
            .ThenByDescending(refund => refund.Id)
            .Select(refund => new ClientMembershipRefundResponse(
                refund.Id,
                refund.SaleId,
                refund.ClientId,
                refund.Amount,
                refund.RefundDate,
                refund.Comment,
                refund.CreatedByUserId,
                refund.CreatedAt,
                refund.CanceledAt,
                refund.CanceledByUserId))
            .ToArray();
    }

    private static IReadOnlyList<ClientMembership> GetCurrentMemberships(Client client)
    {
        return client.Memberships
            .Where(membership => membership.ValidTo is null)
            .OrderByDescending(membership => membership.IndividualValidTo ?? DateOnly.MaxValue)
            .ThenByDescending(membership => membership.IndividualValidFrom ?? DateOnly.MaxValue)
            .ThenByDescending(membership => membership.CreatedAt)
            .ThenByDescending(membership => membership.Id)
            .ToArray();
    }

    private static bool HasActiveMembership(
        IReadOnlyCollection<ClientMembership> memberships,
        DateOnly businessDate) =>
        memberships.Any(membership =>
            ClientMembershipTargetPolicy.ResolveEntitlementState(membership, businessDate) ==
            ClientMembershipEntitlementState.Active);

    private static ClientMembershipState GetMembershipState(
        IReadOnlyCollection<ClientMembership> memberships,
        DateOnly businessDate)
    {
        if (memberships.Count == 0)
        {
            return ClientMembershipState.None;
        }

        var states = memberships
            .Select(membership => ClientMembershipTargetPolicy.ResolveEntitlementState(membership, businessDate))
            .ToHashSet();
        if (states.Contains(ClientMembershipEntitlementState.Active))
        {
            return ClientMembershipState.Active;
        }

        if (states.Contains(ClientMembershipEntitlementState.Future))
        {
            return ClientMembershipState.Future;
        }

        if (states.Contains(ClientMembershipEntitlementState.LegacyTargetMissing))
        {
            return ClientMembershipState.LegacyTargetMissing;
        }

        return states.Contains(ClientMembershipEntitlementState.UsedSingleVisit)
            ? ClientMembershipState.UsedSingleVisit
            : ClientMembershipState.Expired;
    }

    private static IReadOnlyList<ClientActionHintResponse> BuildActionHints(
        bool isProfessional,
        string? professionalComment,
        IReadOnlyCollection<ClientMembership> currentMemberships,
        DateOnly businessDate,
        int visibleGroupCount)
    {
        var hints = new List<ClientActionHintResponse>();
        var today = businessDate;

        if (isProfessional)
        {
            hints.Add(new ClientActionHintResponse(
                global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine5166bd8ee2e,
                string.IsNullOrWhiteSpace(professionalComment)
                    ? global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine51867fa40bd
                    : professionalComment,
                "blue",
                "info",
                null));

            if (visibleGroupCount == 0)
            {
                hints.Add(new ClientActionHintResponse(
                    global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine527C76b894e,
                    global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine528F5e76471,
                    "blue",
                    "group",
                    null));
            }

            return hints;
        }

        if (currentMemberships.Count == 0)
        {
            hints.Add(new ClientActionHintResponse(
                global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine54063e29a54,
                global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine541202af31a,
                "orange",
                "membership",
                null));
        }
        else
        {
            var expiration = currentMemberships
                .Where(membership => membership.IndividualValidTo.HasValue)
                .Select(membership => membership.IndividualValidTo!.Value)
                .Order()
                .FirstOrDefault();
            if (expiration != default)
            {
                var daysUntilExpiration = expiration.DayNumber - today.DayNumber;

                if (daysUntilExpiration < 0)
                {
                    hints.Add(new ClientActionHintResponse(
                        global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine560B62f978a,
                        global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine561818b63db,
                        "orange",
                        "membership",
                        daysUntilExpiration));
                }
                else if (daysUntilExpiration < ClientMembershipQueryConstants.ExpiringMembershipWindowDays)
                {
                    hints.Add(new ClientActionHintResponse(
                        global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine569B62f978a,
                        daysUntilExpiration == 0
                            ? global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine571679f07cb
                            : global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine572D51da79f(daysUntilExpiration),
                        "yellow",
                        "membership",
                        daysUntilExpiration));
                }
            }

            if (currentMemberships.Any(membership =>
                    membership.BehaviorKind == MembershipBehaviorKind.SingleVisit &&
                    membership.SingleVisitUsed))
            {
                hints.Add(new ClientActionHintResponse(
                    global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine58463e29a54,
                    global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine585Fa507898,
                    "orange",
                    "membership",
                    null));
            }

            if (currentMemberships.Any(membership => membership.TargetGroups.Count == 0))
            {
                hints.Add(new ClientActionHintResponse(
                    global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine594De3830e7,
                    global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine5952baf9f33,
                    "orange",
                    "membership",
                    null));
            }
        }

        if (visibleGroupCount == 0)
        {
            hints.Add(new ClientActionHintResponse(
                global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine605C76b894e,
                global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine606F5e76471,
                "blue",
                "group",
                null));
        }

        if (hints.Count == 0)
        {
            hints.Add(new ClientActionHintResponse(
                global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine615C19bb335,
                global::GymCrm.Api.UserFacingText.BE2ClientsText.ClientResponseMapperLine61688f78723,
                "gray",
                "check",
                null));
        }

        return hints;
    }

    internal static string BuildClientFullName(string? lastName, string? firstName, string? middleName)
    {
        var fullName = string.Join(
            ' ',
            new[] { lastName, firstName, middleName }
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Select(part => part!.Trim()));

        return string.IsNullOrWhiteSpace(fullName)
            ? ClientResources.ClientWithoutName
            : fullName;
    }


    private static (string? Name, DateTimeOffset? ChangedAt) ResolveNotesMetadata(Client client, ILogger? logger)
    {
        if (client.NotesChangedByUserId.HasValue &&
            client.NotesChangedAt.HasValue &&
            client.NotesChangedByUser is not null)
        {
            return (client.NotesChangedByUser.FullName, client.NotesChangedAt);
        }

        if (client.NotesChangedByUserId.HasValue || client.NotesChangedAt.HasValue)
        {
            logger?.LogWarning(
                "Client note metadata is incomplete or its author cannot be resolved. ClientId={ClientId}",
                client.Id);
        }

        return (null, null);
    }
}
