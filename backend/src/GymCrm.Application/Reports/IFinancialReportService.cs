namespace GymCrm.Application.Reports;

public interface IFinancialReportService
{
    Task<FinancialReportResult> GetFinancialReportAsync(
        FinancialReportQuery query,
        CancellationToken cancellationToken);
}
