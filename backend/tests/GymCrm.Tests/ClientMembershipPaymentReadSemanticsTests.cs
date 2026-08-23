using GymCrm.Application.Clients;

namespace GymCrm.Tests;

public sealed class ClientMembershipPaymentReadSemanticsTests
{
    [Fact]
    public void Membership_semantics_public_api_is_status_free()
    {
        var semanticsType = typeof(ClientMembershipSemantics);

        Assert.NotNull(semanticsType.GetMethod("HasActiveMembership"));
        Assert.Null(semanticsType.GetMethod("HasActivePaidMembership"));
        Assert.Null(semanticsType.GetMethod("HasUnpaidCurrentMembership"));
        Assert.DoesNotContain(Enum.GetNames<ClientMembershipIssue>(), name => name == "Unpaid");
    }

    [Fact]
    public void Financial_projection_separates_accounting_and_attribution_dates()
    {
        var source = ReadRepositoryFile(
            "backend/src/GymCrm.Infrastructure/Reports/FinancialReportService.cs");

        Assert.Contains("AccountingDate", source, StringComparison.Ordinal);
        Assert.Contains("AttributionDate", source, StringComparison.Ordinal);
        Assert.Contains("sale.PaymentDate", source, StringComparison.Ordinal);
        Assert.Contains("sale.PurchaseDate", source, StringComparison.Ordinal);
        Assert.Contains("refund.RefundDate", source, StringComparison.Ordinal);
        Assert.DoesNotContain("new FinancialEventProjection(\n                sale.Id,\n                sale.ClientId,\n                sale.PurchaseDate,",
            source,
            StringComparison.Ordinal);
    }

    [Fact]
    public void Removed_payment_actions_and_filters_have_stable_tombstone_problem_types()
    {
        var clientMembershipEndpoints = ReadRepositoryFile("backend/src/GymCrm.Api/Auth/ClientMembershipEndpoints.cs");
        var clientQueryEndpoints = ReadRepositoryFile("backend/src/GymCrm.Api/Auth/ClientQueryEndpoints.cs");
        var botEndpoints = ReadRepositoryFile("backend/src/GymCrm.Api/Auth/BotInternalEndpoints.cs");

        Assert.Contains("membership-payment-filter-removed", clientQueryEndpoints, StringComparison.Ordinal);
        Assert.Contains("membership-payment-action-removed", clientMembershipEndpoints, StringComparison.Ordinal);
        Assert.Contains("membership-payment-action-removed", botEndpoints, StringComparison.Ordinal);
        Assert.Contains("membership-unpaid-list-removed", botEndpoints, StringComparison.Ordinal);
        Assert.Contains(
            "StatusCodes.Status410Gone",
            clientMembershipEndpoints + clientQueryEndpoints + botEndpoints,
            StringComparison.Ordinal);
    }

    [Fact]
    public void Read_contracts_do_not_expose_paid_unpaid_status_fields()
    {
        var responseSources = string.Join(
            "\n",
            new[]
            {
                "backend/src/GymCrm.Api/Auth/ClientMembershipResponse.cs",
                "backend/src/GymCrm.Api/Auth/ClientDetailsResponse.cs",
                "backend/src/GymCrm.Api/Auth/ClientListItemResponse.cs",
                "backend/src/GymCrm.Api/Auth/AttendanceClientResponse.cs",
                "backend/src/GymCrm.Application/Bot/BotApiContracts.cs"
            }.Select(ReadRepositoryFile));

        Assert.DoesNotContain("IsPaid", responseSources, StringComparison.Ordinal);
        Assert.DoesNotContain("PaidAt", responseSources, StringComparison.Ordinal);
        Assert.DoesNotContain("PaidByUser", responseSources, StringComparison.Ordinal);
        Assert.DoesNotContain("HasUnpaidCurrentMembership", responseSources, StringComparison.Ordinal);
        Assert.DoesNotContain("HasActivePaidMembership", responseSources, StringComparison.Ordinal);
        Assert.DoesNotContain("UnpaidMembership", responseSources, StringComparison.Ordinal);
        Assert.Contains("PaymentDate", responseSources, StringComparison.Ordinal);
        Assert.Contains("PaymentRecordedByUserId", responseSources, StringComparison.Ordinal);
        Assert.Contains("PaymentRecordedByUserName", responseSources, StringComparison.Ordinal);
        Assert.Contains("PaymentRecordedAt", responseSources, StringComparison.Ordinal);
        Assert.Contains("HasActiveMembership", responseSources, StringComparison.Ordinal);
    }

    private static string ReadRepositoryFile(string relativePath)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null &&
               !Directory.Exists(Path.Combine(directory.FullName, "backend")) &&
               !Directory.Exists(Path.Combine(directory.FullName, "frontend")))
        {
            directory = directory.Parent;
        }

        Assert.NotNull(directory);
        var path = Path.Combine(directory!.FullName, relativePath);
        Assert.True(File.Exists(path), $"Expected repository file '{relativePath}' at '{path}'.");
        return File.ReadAllText(path);
    }
}
