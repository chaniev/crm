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
        $"Пользователь '{actorLogin}' изменил посещаемость клиента '{clientName}' в группе '{groupName}' за {trainingDate:yyyy-MM-dd}.";

    public static string SingleVisitWrittenOffDescription(string actorLogin, string clientName) =>
        $"Пользователь '{actorLogin}' списал разовое посещение клиента '{clientName}'.";

    public static string SingleVisitRestoredDescription(string actorLogin, string clientName) =>
        $"Пользователь '{actorLogin}' восстановил разовое посещение клиента '{clientName}'.";
}
