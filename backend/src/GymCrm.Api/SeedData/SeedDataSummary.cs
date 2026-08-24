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
    int AnnualMembershipCount,
    int MonthlyMembershipCount,
    int ProfessionalMembershipCount,
    int ClientsWithoutMembershipCount,
    int MultiGroupClientCount,
    int LessonSeriesCount,
    int LessonScheduleSlotCount,
    string PhotoStorageRootPath,
    string DefaultUserPassword);
