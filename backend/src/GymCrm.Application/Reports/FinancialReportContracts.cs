namespace GymCrm.Application.Reports;

public sealed record FinancialReportQuery(
    DateOnly From,
    DateOnly To,
    Guid? BranchId,
    Guid? TrainerId);

public sealed record FinancialReportResult(
    FinancialReportTotals Totals,
    IReadOnlyList<FinancialReportBranchBreakdownRow> BranchBreakdown,
    IReadOnlyList<FinancialReportGroupBreakdownRow> GroupBreakdown,
    IReadOnlyList<FinancialReportTrainerBreakdownRow> TrainerBreakdown);

public sealed record FinancialReportTotals(
    int SoldMembershipCount,
    decimal GrossSales,
    decimal RefundTotal,
    decimal NetTotal,
    int NewClientsCount);

public sealed record FinancialReportBranchBreakdownRow(
    Guid BranchId,
    string BranchName,
    int SoldMembershipCount,
    decimal GrossSales,
    decimal RefundTotal,
    decimal NetTotal,
    int NewClientsCount);

public sealed record FinancialReportGroupBreakdownRow(
    Guid GroupId,
    string GroupName,
    Guid BranchId,
    string BranchName,
    int SoldMembershipCount,
    decimal GrossSales,
    decimal RefundTotal,
    decimal NetTotal,
    int NewClientsCount);

public sealed record FinancialReportTrainerBreakdownRow(
    Guid TrainerId,
    string TrainerName,
    int SoldMembershipCount,
    decimal GrossSales,
    decimal RefundTotal,
    decimal NetTotal,
    int NewClientsCount);
