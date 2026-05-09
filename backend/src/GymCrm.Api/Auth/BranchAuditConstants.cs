namespace GymCrm.Api.Auth;

internal static class BranchAuditConstants
{
    public const string BranchCreatedAction = "BranchCreated";
    public const string BranchUpdatedAction = "BranchUpdated";
    public const string BranchArchivedAction = "BranchArchived";
    public const string BranchRestoredAction = "BranchRestored";
    public const string HallCreatedAction = "HallCreated";
    public const string HallUpdatedAction = "HallUpdated";
    public const string HallArchivedAction = "HallArchived";
    public const string HallRestoredAction = "HallRestored";
    public const string HallDeletedAction = "HallDeleted";

    public const string BranchEntityType = "Branch";
    public const string HallEntityType = "Hall";
}
