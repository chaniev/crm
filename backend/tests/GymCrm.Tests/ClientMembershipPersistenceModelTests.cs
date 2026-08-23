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
    public void PostgreSql_schema_uses_target_rows_without_client_wide_period_exclusion()
    {
        using var dbContext = CreateDbContext();
        var script = dbContext.GetService<IMigrator>().GenerateScript();

        Assert.DoesNotContain("EX_ClientMemberships_ClientId_Period_NoOverlap", script, StringComparison.Ordinal);
        Assert.Contains("CK_ClientMembershipTargetGroups_Position", script, StringComparison.Ordinal);
        Assert.Contains("IX_ClientMembershipTargetGroups_ClientMembershipId_GroupId", script, StringComparison.Ordinal);
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
    public void Sale_is_the_only_payment_owner_for_membership_versions()
    {
        using var dbContext = CreateDbContext();
        var membership = dbContext.Model.FindEntityType(typeof(ClientMembership));
        var sale = dbContext.Model.FindEntityType(typeof(ClientMembershipSale));
        var user = dbContext.Model.FindEntityType(typeof(GymCrm.Domain.Users.User));

        Assert.NotNull(membership);
        Assert.NotNull(sale);
        Assert.NotNull(user);
        Assert.Null(membership.FindProperty("IsPaid"));
        Assert.Null(membership.FindProperty("PaidByUserId"));
        Assert.Null(membership.FindProperty("PaidAt"));
        Assert.Null(membership.FindNavigation("PaidByUser"));
        Assert.Null(user.FindNavigation("MembershipPayments"));

        var paymentDate = sale.FindProperty("PaymentDate");
        Assert.NotNull(paymentDate);
        Assert.False(paymentDate.IsNullable);
        Assert.Equal("date", paymentDate.GetColumnType());
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
    public void Initial_schema_contains_required_sale_payment_date_and_no_membership_payment_status_columns()
    {
        using var dbContext = CreateDbContext();
        var script = dbContext.GetService<IMigrator>().GenerateScript();

        Assert.Contains("\"PaymentDate\" date NOT NULL", script, StringComparison.Ordinal);
        Assert.DoesNotContain("\"ClientMemberships\".\"IsPaid\"", script, StringComparison.Ordinal);
        Assert.DoesNotContain("\"IsPaid\" boolean", script, StringComparison.Ordinal);
        Assert.DoesNotContain("\"PaidByUserId\" uuid", script, StringComparison.Ordinal);
        Assert.DoesNotContain("\"PaidAt\" timestamp with time zone", script, StringComparison.Ordinal);
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

    [Fact]
    public void Target_groups_and_event_snapshots_are_represented_in_the_model()
    {
        using var dbContext = CreateDbContext();

        Assert.NotNull(dbContext.Model.FindEntityType(typeof(ClientMembershipTargetGroup)));
        Assert.NotNull(dbContext.Model.FindEntityType(typeof(ClientMembershipSaleTargetSnapshot)));
        Assert.NotNull(dbContext.Model.FindEntityType(typeof(ClientMembershipRefundTargetSnapshot)));
        Assert.NotNull(dbContext.Model.FindEntityType(typeof(GymCrm.Domain.Attendance.AttendanceEntitlementTargetSnapshot)));

        var membershipTarget = dbContext.Model.FindEntityType(typeof(ClientMembershipTargetGroup))!;
        Assert.Contains(
            membershipTarget.GetIndexes(),
            index => index.IsUnique &&
                     index.Properties.Select(property => property.Name).SequenceEqual([
                         nameof(ClientMembershipTargetGroup.ClientMembershipId),
                         nameof(ClientMembershipTargetGroup.GroupId)
                     ]));
        Assert.Contains(
            membershipTarget.GetKeys(),
            key => key.Properties.Select(property => property.Name).SequenceEqual([
                nameof(ClientMembershipTargetGroup.ClientMembershipId),
                nameof(ClientMembershipTargetGroup.Position)
            ]));
    }

    [Fact]
    public void Initial_schema_contains_target_snapshot_tables_and_branch_fks()
    {
        using var dbContext = CreateDbContext();
        var initialMigration = Assert.Single(
            dbContext.Database.GetMigrations(),
            candidate => candidate.EndsWith("_InitialCreate", StringComparison.Ordinal));
        var script = dbContext.GetService<IMigrator>().GenerateScript(null, initialMigration);

        Assert.Contains("CREATE TABLE \"ClientMembershipTargetGroups\"", script, StringComparison.Ordinal);
        Assert.Contains("CREATE TABLE \"ClientMembershipSaleTargetSnapshots\"", script, StringComparison.Ordinal);
        Assert.Contains("CREATE TABLE \"ClientMembershipRefundTargetSnapshots\"", script, StringComparison.Ordinal);
        Assert.Contains("CREATE TABLE \"AttendanceEntitlementTargetSnapshots\"", script, StringComparison.Ordinal);
        Assert.Contains("FK_ClientMembershipTargetGroups_Branches_BranchId", script, StringComparison.Ordinal);
        Assert.Contains("FK_ClientMembershipSaleTargetSnapshots_Branches_BranchId", script, StringComparison.Ordinal);
        Assert.Contains("FK_ClientMembershipRefundTargetSnapshots_Branches_BranchId", script, StringComparison.Ordinal);
        Assert.Contains("FK_AttendanceEntitlementTargetSnapshots_Branches_TargetBranchId", script, StringComparison.Ordinal);
        Assert.Contains("CK_ClientMembershipTargetGroups_Position", script, StringComparison.Ordinal);
        Assert.Contains("CK_AttendanceEntitlementTargetSnapshots_Position", script, StringComparison.Ordinal);
    }

    [Fact]
    public void Migration_designers_contain_target_snapshot_entities()
    {
        var migrationsPath = FindMigrationsPath();
        foreach (var fileName in new[]
                 {
                     "20260513165936_InitialCreate.Designer.cs",
                     "20260721210111_FixClientMembershipVersionConstraints.Designer.cs"
                 })
        {
            var text = File.ReadAllText(Path.Combine(migrationsPath, fileName));

            Assert.Contains("GymCrm.Domain.Clients.ClientMembershipTargetGroup", text, StringComparison.Ordinal);
            Assert.Contains("GymCrm.Domain.Clients.ClientMembershipSaleTargetSnapshot", text, StringComparison.Ordinal);
            Assert.Contains("GymCrm.Domain.Clients.ClientMembershipRefundTargetSnapshot", text, StringComparison.Ordinal);
            Assert.Contains("GymCrm.Domain.Attendance.AttendanceEntitlementTargetSnapshot", text, StringComparison.Ordinal);
            Assert.Contains("HasIndex(\"ClientMembershipId\", \"GroupId\")", text, StringComparison.Ordinal);
            Assert.Contains("HasKey(\"ClientMembershipId\", \"Position\")", text, StringComparison.Ordinal);
            Assert.Contains("HasForeignKey(\"BranchId\")", text, StringComparison.Ordinal);
            Assert.Contains("HasForeignKey(\"TargetBranchId\")", text, StringComparison.Ordinal);
            Assert.Contains(".OnDelete(DeleteBehavior.Restrict)", text, StringComparison.Ordinal);
        }
    }

    private static string FindMigrationsPath()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var candidate = Path.Combine(
                directory.FullName,
                "backend",
                "src",
                "GymCrm.Infrastructure",
                "Persistence",
                "Migrations");
            if (Directory.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate backend persistence migrations directory.");
    }

    private static GymCrmDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseNpgsql("Host=localhost;Database=gym_crm_model_tests;Username=unused;Password=unused")
            .Options;

        return new GymCrmDbContext(options);
    }
}
