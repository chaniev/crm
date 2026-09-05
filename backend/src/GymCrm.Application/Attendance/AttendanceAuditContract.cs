namespace GymCrm.Application.Attendance;

public static class AttendanceAuditContract
{
    public const string AttendanceMarkedAction = "AttendanceMarked";
    public const string AttendanceUpdatedAction = "AttendanceUpdated";
    public const string AttendanceEntityType = "Attendance";
    public const string SingleVisitWrittenOffAction = "ClientMembershipSingleVisitWrittenOff";
    public const string SingleVisitRestoredAction = "ClientMembershipSingleVisitRestored";
    public const string MembershipEntityType = "ClientMembership";

    public static string AttendanceChangedDescription(
        string actorLogin,
        string clientName,
        string groupName,
        DateOnly trainingDate) =>
        global::GymCrm.Application.UserFacingText.AttendanceText.AttendanceAuditContractLine17b75586e3(actorLogin, clientName, groupName, trainingDate);

    public static string SingleVisitWrittenOffDescription(string actorLogin, string clientName) =>
        global::GymCrm.Application.UserFacingText.AttendanceText.AttendanceAuditContractLine203cfee4d5(actorLogin, clientName);

    public static string SingleVisitRestoredDescription(string actorLogin, string clientName) =>
        global::GymCrm.Application.UserFacingText.AttendanceText.AttendanceAuditContractLine23a3aea2d3(actorLogin, clientName);
}
