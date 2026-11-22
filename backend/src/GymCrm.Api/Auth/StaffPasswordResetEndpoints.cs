using GymCrm.Application.Attendance;
using GymCrm.Application.Security;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;

namespace GymCrm.Api.Auth;

internal static class StaffPasswordResetEndpoints
{
    public static void Map(RouteGroupBuilder group, StaffEndpointRoleFamily family)
    {
        group.MapPost("/{id:guid}/reset-password", async Task<Results<NoContent, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> (
            Guid id,
            ResetStaffPasswordRequest request,
            HttpContext context,
            GymCrmDbContext db,
            IBusinessDateProvider dates,
            IPasswordHashService hasher,
            IAntiforgery antiforgery,
            CancellationToken cancellationToken) =>
        {
            var csrfProblem = await AuthCsrfValidation.ValidateRequestAsync(context, antiforgery);
            if (csrfProblem is not null)
            {
                return csrfProblem;
            }

            var actor = context.GetAuthenticatedGymCrmUser();
            if (actor is null)
            {
                return TypedResults.Unauthorized();
            }

            var result = await StaffPasswordResetService.ResetAsync(
                family, actor, context.User, id, request.TemporaryPassword, db, dates, hasher, cancellationToken);
            return result.Status switch
            {
                StaffMutationStatus.Updated => TypedResults.NoContent(),
                StaffMutationStatus.ValidationFailed => TypedResults.ValidationProblem(result.ValidationErrors!),
                StaffMutationStatus.Forbidden => StaffProblemDetails.FromDenial(result.Denial),
                StaffMutationStatus.NotFound => StaffProblemDetails.NotFound(),
                StaffMutationStatus.Unauthorized => TypedResults.Unauthorized(),
                _ => throw new InvalidOperationException($"Unexpected password reset status '{result.Status}'.")
            };
        });
    }
}
