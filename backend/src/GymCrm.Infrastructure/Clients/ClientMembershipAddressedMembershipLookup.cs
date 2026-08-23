using GymCrm.Domain.Clients;

namespace GymCrm.Infrastructure.Clients;

internal readonly record struct ClientMembershipAddressedMembershipLookup(
    AddressedMembershipStatus Status,
    ClientMembership? Membership);
