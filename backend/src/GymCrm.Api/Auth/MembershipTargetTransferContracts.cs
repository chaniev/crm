using Microsoft.AspNetCore.Http.HttpResults;

namespace GymCrm.Api.Auth;

internal sealed record MembershipTargetTransferRequest(
    Guid? SourceGroupId,
    Guid? TargetGroupId,
    IReadOnlyList<Guid>? ExpectedMembershipIds);

internal sealed record MembershipTargetTransferPreviewResponse(
    Guid ClientId,
    Guid SourceGroupId,
    Guid TargetGroupId,
    IReadOnlyList<MembershipTargetTransferItemResponse> AffectedMemberships);

internal sealed record MembershipTargetTransferItemResponse(
    Guid MembershipId,
    Guid SaleId,
    string MembershipName,
    string BehaviorKind,
    IReadOnlyList<ClientMembershipTargetGroupResponse> BeforeTargets,
    IReadOnlyList<ClientMembershipTargetGroupResponse> AfterTargets);

internal readonly record struct MembershipTargetTransferPreviewResult(
    bool Succeeded,
    MembershipTargetTransferPreviewResponse? Preview,
    Results<Ok<MembershipTargetTransferPreviewResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult> Result)
{
    public static MembershipTargetTransferPreviewResult Success(MembershipTargetTransferPreviewResponse preview) =>
        new(true, preview, TypedResults.Ok(preview));

    public static MembershipTargetTransferPreviewResult Failure(
        Results<Ok<MembershipTargetTransferPreviewResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult> result) =>
        new(false, null, result);
}
