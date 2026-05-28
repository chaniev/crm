using GymCrm.Domain.Groups;

namespace GymCrm.Api.SeedData;

internal sealed record GroupTypeSeedData(
    IReadOnlyList<GroupType> UsedGroupTypes,
    IReadOnlyList<GroupType> CreatedGroupTypes);
