using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;

namespace GymCrm.Api.Auth;

internal static class AuthCsrfValidation
{
    public static async Task<ProblemHttpResult?> ValidateRequestAsync(
        HttpContext httpContext,
        IAntiforgery antiforgery)
    {
        try
        {
            await antiforgery.ValidateRequestAsync(httpContext);
            return null;
        }
        catch (AntiforgeryValidationException)
        {
            return TypedResults.Problem(
                title: AuthConstants.InvalidCsrfProblemTitle,
                detail: AuthConstants.InvalidCsrfProblemDetail,
                statusCode: StatusCodes.Status400BadRequest);
        }
    }
}
