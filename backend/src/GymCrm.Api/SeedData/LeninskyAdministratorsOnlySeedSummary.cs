namespace GymCrm.Api.SeedData;

internal sealed record LeninskyAdministratorsOnlySeedSummary(
    string BranchName,
    int AdministratorCount,
    string HeadCoachLogin,
    string SuperAdministratorLogin,
    string DefaultUserPassword);
