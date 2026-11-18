using GymCrm.Application.Clients;

namespace GymCrm.Tests;

public class ClientImportMappingTests
{
    [Theory]
    [InlineData(48, 0, 48)]
    [InlineData(66, 4, 62)]
    public async Task All_source_profiles_are_synthetic_and_fixable(int count, int invalid, int valid)
    {
        foreach (var corrected in new[] { false, true })
        {
            using var file = ClientXlsxReaderTests.Workbook(SyntheticImportProfiles.Rows(count, corrected));
            var read = await new GymCrm.Infrastructure.Clients.ClientXlsxReader().ReadAsync(file);
            Assert.Empty(read.Issues);
            var mapped = ClientImportMapping.Map(read.Rows);
            Assert.Equal(corrected ? count : valid, mapped.Rows.Count);
            Assert.Equal(corrected ? 0 : invalid, mapped.Issues.Select(issue => issue.Row).Distinct().Count());
            if (!corrected)
            {
                Assert.Equal(count == 48 ? [] : new[] { 6, 32, 37, 46 }, mapped.Issues.Select(issue => issue.Row!.Value).Distinct());
                Assert.All(mapped.Issues, issue => Assert.Equal("fullName", issue.Field));
                Assert.Equal(count == 48 ? 1 : 5, mapped.Rows.Count(row => row.Phone == "+79111111111"));
            }
        }
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t")]
    [InlineData("\u00a0")]
    public void Blank_phone_gets_default_without_changing_notes(string phone)
    {
        var cells = ClientXlsxReaderTests.ValidRow();
        var original = Assert.Single(ClientImportMapping.Map([new(2, cells)]).Rows);
        cells[1] = phone;

        var result = ClientImportMapping.Map([new(2, cells)]);

        Assert.Empty(result.Issues);
        var row = Assert.Single(result.Rows);
        Assert.Equal("+79111111111", row.Phone);
        Assert.Equal(original.Notes, row.Notes);
    }

    [Theory]
    [InlineData("-")]
    [InlineData("+")]
    [InlineData("123")]
    [InlineData(",")]
    [InlineData("+79000000001,")]
    [InlineData(",+79000000001")]
    [InlineData("+79000000001, ,+79000000002")]
    public void Nonblank_invalid_phone_is_never_replaced(string phone)
    {
        var cells = ClientXlsxReaderTests.ValidRow();
        cells[1] = phone;

        var result = ClientImportMapping.Map([new(12, cells)]);

        Assert.Empty(result.Rows);
        var issue = Assert.Single(result.Issues);
        Assert.Equal(12, issue.Row);
        Assert.Equal("phone", issue.Field);
        Assert.Equal("invalid_value", issue.Code);
    }

    [Theory]
    [InlineData("8 900 000-00-01", "+79000000001")]
    [InlineData("79000000001", "+79000000001")]
    [InlineData("+79000000001", "+79000000001")]
    [InlineData("8000000003", "+78000000003")]
    public void Filled_phone_keeps_existing_normalization(string phone, string expected)
    {
        var cells = ClientXlsxReaderTests.ValidRow();
        cells[1] = phone;

        var result = ClientImportMapping.Map([new(2, cells)]);

        Assert.Empty(result.Issues);
        Assert.Equal(expected, Assert.Single(result.Rows).Phone);
    }

    [Fact]
    public void Blank_phone_does_not_hide_an_invalid_birth_date()
    {
        var cells = ClientXlsxReaderTests.ValidRow();
        cells[1] = "";
        cells[4] = "31.02.2010";

        var result = ClientImportMapping.Map([new(25, cells)]);

        Assert.Empty(result.Rows);
        var issue = Assert.Single(result.Issues);
        Assert.Equal(25, issue.Row);
        Assert.Equal("birthDate", issue.Field);
    }

    [Theory]
    [InlineData("V Иванов Иван (Д)", "V Иванов", "Иван (Д)", null)]
    [InlineData("Иванов (д) Иван Иванович", "Иванов (д)", "Иван", "Иванович")]
    [InlineData("Иванов Иван (пометка)", "Иванов", "Иван", null)]
    public void Names_preserve_markers_and_remove_other_annotations(string name, string last, string first, string? middle)
    {
        var cells = ClientXlsxReaderTests.ValidRow(); cells[0] = name;
        var result = ClientImportMapping.Map([new(2, cells)]);
        Assert.Empty(result.Issues);
        var row = Assert.Single(result.Rows);
        Assert.Equal(last, row.LastName); Assert.Equal(first, row.FirstName); Assert.Equal(middle, row.MiddleName);
    }

    [Theory]
    [InlineData("Иванов 8 Иван")]
    [InlineData("Иванов год Иван")]
    public void Ambiguous_names_require_source_correction(string name)
    {
        var cells = ClientXlsxReaderTests.ValidRow(); cells[0] = name;
        Assert.Contains(ClientImportMapping.Map([new(32, cells)]).Issues, issue => issue.Row == 32 && issue.Field == "fullName");
    }

    [Fact]
    public void Every_source_field_is_mapped_without_financial_or_contact_records()
    {
        var cells = ClientXlsxReaderTests.ValidRow();
        cells[1] = "8 900 000-00-01, +7 900 000-00-02, 8000000003";
        cells[8] = "-18000";
        var result = ClientImportMapping.Map([new(62, cells)]);
        Assert.Empty(result.Issues);
        var row = Assert.Single(result.Rows);
        Assert.Equal("+79000000001", row.Phone);
        Assert.Equal(new DateOnly(2010, 2, 1), row.BirthDate);
        Assert.Equal("Дополнительные телефоны: +79000000002, +78000000003\nКомментарий к телефону: мама\nEmail: a@example.test\nПол: Мужской\nАдрес: Адрес\nБаланс из исходного файла: -18000\nКомментарий: Заметка", row.Notes);
    }

    [Theory]
    [InlineData(2000, false)]
    [InlineData(2001, true)]
    public void Notes_limit_never_truncates(int length, bool invalid)
    {
        var cells = ClientXlsxReaderTests.ValidRow();
        foreach (var index in new[] { 2, 3, 5, 6, 8 }) cells[index] = "";
        cells[9] = new string('я', length - "Комментарий: ".Length);
        var result = ClientImportMapping.Map([new(2, cells)]);
        Assert.Equal(invalid, result.Issues.Any(issue => issue.Field == "notes"));
        if (!invalid) Assert.Equal(length, Assert.Single(result.Rows).Notes!.Length);
    }

    [Fact]
    public void All_errors_are_returned_with_excel_rows()
    {
        var rows = new[] { 2, 25, 67 }.Select(number =>
        {
            var cells = ClientXlsxReaderTests.ValidRow(); cells[1] = "123"; cells[4] = "31.02.2010";
            return new ClientImportRow(number, cells);
        }).ToArray();
        var result = ClientImportMapping.Map(rows);
        Assert.Equal(6, result.Issues.Count);
        Assert.Equal([2, 25, 67], result.Issues.Select(issue => issue.Row).Distinct());
    }
}
