using System.Text.Json;
using GymCrm.Domain.Users;

namespace GymCrm.Api.Auth;

internal static class UserAuditSerializer
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public static string Serialize(User user)
    {
        return JsonSerializer.Serialize(
            new UserAuditState(
                user.Id,
                user.FullName,
                user.Login,
                user.Role.ToString(),
                user.MessengerPlatform?.ToString(),
                user.MessengerPlatformUserId,
                user.MustChangePassword,
                user.IsActive,
                user.CreatedAt,
                user.UpdatedAt),
            SerializerOptions);
    }
}
