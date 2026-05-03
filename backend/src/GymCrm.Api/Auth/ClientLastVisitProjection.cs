namespace GymCrm.Api.Auth;

internal sealed record ClientLastVisitProjection(
    Guid ClientId,
    DateOnly TrainingDate);
