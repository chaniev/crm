namespace GymCrm.Api.SeedData;

internal sealed record SeedDataSummary(
    int GroupTypeCount,
    int BranchCount,
    int HallCount,
    int CoachCount,
    int AdministratorCount,
    int GroupCount,
    int ClientCount,
    int ClientPhotoCount,
    string PhotoStorageRootPath,
    string DefaultUserPassword);
