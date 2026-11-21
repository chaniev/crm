using System.Text.Json.Serialization;

namespace GymCrm.Api.Auth;

internal record ClientProfileRequest
{
    public string? LastName { get; init; }
    public string? FirstName { get; init; }
    public string? MiddleName { get; init; }
    public string? Phone { get; init; }
    public DateOnly? BirthDate { get; init; }
    public string? Notes { get; init; }
    public IReadOnlyList<UpsertClientContactRequest>? Contacts { get; init; }
    public string? TelegramContactUsername
    {
        get;
        init
        {
            field = value;
            HasTelegramContactUsername = true;
        }
    }

    [JsonIgnore]
    public bool HasTelegramContactUsername { get; private set; }
}
