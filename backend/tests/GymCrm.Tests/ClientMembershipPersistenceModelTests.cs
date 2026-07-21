using GymCrm.Domain.Clients;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace GymCrm.Tests;

public sealed class ClientMembershipPersistenceModelTests
{
    [Fact]
    public void Current_version_is_unique_per_sale_instead_of_per_client()
    {
        using var dbContext = CreateDbContext();
        var membership = dbContext.Model.FindEntityType(typeof(ClientMembership));

        Assert.NotNull(membership);
        var currentVersionIndex = Assert.Single(
            membership.GetIndexes(),
            index => index.IsUnique && index.GetFilter() == "\"ValidTo\" IS NULL");

        Assert.Equal([nameof(ClientMembership.SaleId)], currentVersionIndex.Properties.Select(property => property.Name));
    }

    [Fact]
    public void PostgreSql_overlap_constraint_ignores_closed_versions()
    {
        using var dbContext = CreateDbContext();
        var script = dbContext.GetService<IMigrator>().GenerateScript();

        Assert.Contains(
            "\"ValidTo\" IS NULL AND \"BehaviorKind\" IN ('Term', 'Professional')",
            script,
            StringComparison.Ordinal);
    }

    private static GymCrmDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseNpgsql("Host=localhost;Database=gym_crm_model_tests;Username=unused;Password=unused")
            .Options;

        return new GymCrmDbContext(options);
    }
}
