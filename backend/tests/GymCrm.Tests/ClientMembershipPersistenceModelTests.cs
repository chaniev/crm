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

    [Fact]
    public void Sale_is_the_only_catalog_and_money_owner_for_membership_versions()
    {
        using var dbContext = CreateDbContext();
        var membership = dbContext.Model.FindEntityType(typeof(ClientMembership));
        var sale = dbContext.Model.FindEntityType(typeof(ClientMembershipSale));

        Assert.NotNull(membership);
        Assert.NotNull(sale);
        Assert.Null(membership.FindProperty("PaymentAmount"));
        Assert.Null(membership.FindProperty("MembershipCatalogItemId"));
        Assert.Null(membership.FindNavigation("MembershipCatalogItem"));
        Assert.NotNull(sale.FindProperty("PricingMode"));
        Assert.True(sale.FindProperty("MembershipCatalogItemId")!.IsNullable);
        Assert.False(sale.FindProperty("GrossAmount")!.IsNullable);
    }

    [Fact]
    public void Catalog_sale_and_refund_share_numeric_10_2_storage()
    {
        using var dbContext = CreateDbContext();

        Assert.Equal("numeric(10,2)", dbContext.Model.FindEntityType(typeof(GymCrm.Domain.Memberships.MembershipCatalogItem))!
            .FindProperty("Price")!.GetColumnType());
        Assert.Equal("numeric(10,2)", dbContext.Model.FindEntityType(typeof(ClientMembershipSale))!
            .FindProperty("GrossAmount")!.GetColumnType());
        Assert.Equal("numeric(10,2)", dbContext.Model.FindEntityType(typeof(ClientMembershipRefund))!
            .FindProperty("Amount")!.GetColumnType());
    }

    [Fact]
    public void Initial_schema_contains_pricing_catalog_consistency_and_whole_ruble_checks()
    {
        using var dbContext = CreateDbContext();
        var script = dbContext.GetService<IMigrator>().GenerateScript();

        Assert.Contains("CK_ClientMembershipSales_PricingMode_Catalog", script, StringComparison.Ordinal);
        Assert.Contains(
            "\"BehaviorKind\" = 'SingleVisit' AND \"PricingMode\" IN ('Catalog', 'CatalogOverride')",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "\"BehaviorKind\" = 'Term' AND \"PricingMode\" IN ('Catalog', 'CatalogOverride', 'AmountOnly')",
            script,
            StringComparison.Ordinal);
        Assert.Contains("CK_ClientMembershipSales_GrossAmount_WholeRub", script, StringComparison.Ordinal);
        Assert.Contains("CK_ClientMembershipRefunds_Amount_WholeRub", script, StringComparison.Ordinal);
        Assert.Contains("CK_MembershipCatalogItems_Price_WholeRub", script, StringComparison.Ordinal);
        Assert.DoesNotContain("ClientMemberships_PaymentAmount", script, StringComparison.Ordinal);
    }

    [Fact]
    public void Membership_idempotency_is_actor_scoped_in_the_model()
    {
        using var dbContext = CreateDbContext();
        var record = dbContext.Model.FindEntityType(typeof(ClientMembershipIdempotencyRecord));

        Assert.NotNull(record);
        var actorKeyIndex = Assert.Single(
            record.GetIndexes(),
            index =>
                index.IsUnique &&
                index.Properties.Select(property => property.Name).SequenceEqual(
                    [
                        nameof(ClientMembershipIdempotencyRecord.ActorUserId),
                        nameof(ClientMembershipIdempotencyRecord.IdempotencyKey)
                    ]));

        Assert.Null(actorKeyIndex.GetFilter());
        Assert.Equal(
            GymCrmDbContext.ClientMembershipIdempotencyActorKeyIndexName,
            actorKeyIndex.GetDatabaseName());
        Assert.Contains(
            record.GetIndexes(),
            index =>
                !index.IsUnique &&
                index.Properties.Select(property => property.Name).SequenceEqual(
                    [nameof(ClientMembershipIdempotencyRecord.ExpiresAt)]));
    }

    [Fact]
    public void Reproducible_initial_schema_contains_membership_idempotency_storage()
    {
        using var dbContext = CreateDbContext();
        var initialMigration = Assert.Single(
            dbContext.Database.GetMigrations(),
            candidate => candidate.EndsWith("_InitialCreate", StringComparison.Ordinal));
        var script = dbContext.GetService<IMigrator>().GenerateScript(null, initialMigration);

        Assert.Contains("CREATE TABLE \"ClientMembershipIdempotencyRecords\"", script, StringComparison.Ordinal);
        Assert.Contains(
            "CK_ClientMembershipIdempotencyRecords_RequiredValues",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            GymCrmDbContext.ClientMembershipIdempotencyActorKeyIndexName,
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "IX_ClientMembershipIdempotencyRecords_ExpiresAt",
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
