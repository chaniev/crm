using System.Text.Json;

namespace GymCrm.Api.Auth;

internal static partial class ClientEndpoints
{
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);
    private const int MembershipIdempotencyKeyMaxLength = 128;
    private const string MembershipIdempotencyPending = "Pending";
    private const string MembershipIdempotencyCompleted = "Completed";

    public static IEndpointRouteBuilder MapClientEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/clients");

        group.MapClientQueryEndpoints();
        group.MapClientLifecycleEndpoints();
        group.MapClientMembershipEndpoints();

        return endpoints;
    }


}
