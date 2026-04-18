using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;

namespace GymCrm.Domain.Attendance;

public class Attendance
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Guid GroupId { get; set; }
    public DateOnly TrainingDate { get; set; }
    public bool IsPresent { get; set; }
    public Guid MarkedByUserId { get; set; }
    public DateTimeOffset MarkedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Client Client { get; set; } = null!;
    public TrainingGroup Group { get; set; } = null!;
    public User MarkedByUser { get; set; } = null!;
}
