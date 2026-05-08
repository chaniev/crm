namespace GymCrm.Api.Auth;

internal sealed record UpdateClientProfessionalStatusRequest(
    bool? IsProfessional,
    string? ProfessionalComment);
