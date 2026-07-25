namespace GymCrm.Api.Auth;

internal sealed record GroupTrainerSubstitutionAllowedActionsResponse(
    bool CanEdit,
    bool CanCancel);
