using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;

namespace GymCrm.Domain.Attendance;

public class AttendanceEntitlementTargetSnapshot
{
    public Guid Id { get; set; }
    public Guid AttendanceId { get; set; }
    public Guid ClientId { get; set; }
    public Guid FactualGroupId { get; set; }
    public DateOnly TrainingDate { get; set; }
    public Guid? MembershipId { get; set; }
    public Guid? SaleId { get; set; }
    public MembershipCoverageKind CoverageKind { get; set; }
    public Guid? TargetGroupId { get; set; }
    public Guid? TargetBranchId { get; set; }
    public int Position { get; set; }
    public string Provenance { get; set; } = "Write";
    public DateTimeOffset CreatedAt { get; set; }

    public TrainingGroup FactualGroup { get; set; } = null!;
    public TrainingGroup? TargetGroup { get; set; }
}
