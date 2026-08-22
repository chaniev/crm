using System.Text;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;

namespace GymCrm.Domain.Memberships;

public class MembershipCatalogItem
{
    public const int NameMaxLength = 128;

    public Guid Id { get; set; }
    public Guid? BranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public MembershipBehaviorKind BehaviorKind { get; set; }
    public DateOnly AvailableFrom { get; set; }
    public DateOnly? AvailableTo { get; set; }
    public bool IsSystemOwned { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Branch? Branch { get; set; }

    public static MembershipCatalogItem CreateBranchOwned(Guid branchId, string name, decimal price,
        MembershipBehaviorKind behaviorKind, DateOnly availableFrom, DateOnly? availableTo, DateTimeOffset now)
    {
        if (branchId == Guid.Empty || behaviorKind == MembershipBehaviorKind.Professional || price <= 0)
            throw new ArgumentException("Branch catalog item requires a branch, positive price and ordinary behavior.");
        return Create(branchId, name, price, behaviorKind, availableFrom, availableTo, false, now);
    }

    public static MembershipCatalogItem CreateProfessional(string name, DateOnly availableFrom,
        DateOnly? availableTo, DateTimeOffset now) =>
        Create(null, name, 0m, MembershipBehaviorKind.Professional, availableFrom, availableTo, true, now);

    public void Update(string name, DateOnly availableFrom, DateOnly? availableTo, DateTimeOffset now)
    {
        Validate(name, Price, BehaviorKind, availableFrom, availableTo);
        Name = name.Trim();
        NormalizedName = NormalizeName(name);
        AvailableFrom = availableFrom;
        AvailableTo = availableTo;
        UpdatedAt = now;
    }

    public bool IsAvailableOn(DateOnly date) => date >= AvailableFrom && (AvailableTo is null || date <= AvailableTo);

    public static string NormalizeName(string value)
    {
        ArgumentNullException.ThrowIfNull(value);
        var result = new StringBuilder();
        var pendingSpace = false;
        foreach (var character in value.Trim())
        {
            if (char.IsWhiteSpace(character)) { pendingSpace = result.Length > 0; continue; }
            if (pendingSpace) { result.Append(' '); pendingSpace = false; }
            result.Append(char.ToUpperInvariant(character == 'ё' || character == 'Ё' ? 'е' : character));
        }
        return result.ToString();
    }

    private static MembershipCatalogItem Create(Guid? branchId, string name, decimal price,
        MembershipBehaviorKind behaviorKind, DateOnly availableFrom, DateOnly? availableTo,
        bool systemOwned, DateTimeOffset now)
    {
        Validate(name, price, behaviorKind, availableFrom, availableTo);
        return new MembershipCatalogItem
        {
            Id = Guid.NewGuid(),
            BranchId = branchId,
            Name = name.Trim(),
            NormalizedName = NormalizeName(name),
            Price = price,
            BehaviorKind = behaviorKind,
            AvailableFrom = availableFrom,
            AvailableTo = availableTo,
            IsSystemOwned = systemOwned,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static void Validate(string name, decimal price, MembershipBehaviorKind behaviorKind,
        DateOnly availableFrom, DateOnly? availableTo)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > NameMaxLength)
            throw new ArgumentException("Catalog name is required.", nameof(name));
        if (availableTo < availableFrom) throw new ArgumentException("Availability range is reversed.");
        if (!RubMoneyPolicy.IsWholeAmount(
                price,
                allowZero: behaviorKind == MembershipBehaviorKind.Professional) ||
            (behaviorKind == MembershipBehaviorKind.Professional && price != 0m))
            throw new ArgumentException("Invalid catalog price.", nameof(price));
    }
}
