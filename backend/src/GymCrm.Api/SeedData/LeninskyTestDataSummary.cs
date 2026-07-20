namespace GymCrm.Api.SeedData;

internal sealed record LeninskyTestDataSummary(
    string BranchName,
    int AdministratorCount,
    int MembershipCount,
    string DefaultUserPassword);
