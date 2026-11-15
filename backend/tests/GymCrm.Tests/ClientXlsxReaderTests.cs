using System.IO.Compression;
using System.Security;
using System.Text;
using GymCrm.Infrastructure.Clients;

namespace GymCrm.Tests;

public class ClientXlsxReaderTests
{
    internal static readonly string[] Headers = ["Имя", "Телефон", "Комментарий к телефону", "Email", "Дата рождения", "Пол", "Адрес", "Статус", "Баланс", "Комментарий"];
    internal static string[] ValidRow() => ["Иванов Иван Иванович", "8 900 000-00-01", "мама", "a@example.test", "01.02.2010", "Мужской", "Адрес", "Активный", "0", "Заметка"];

    [Fact]
    public async Task Reader_preserves_excel_row_numbers_and_all_ten_fields()
    {
        using var file = Workbook([ValidRow(), new string[10], ValidRow()]);
        var result = await new ClientXlsxReader().ReadAsync(file);
        Assert.Empty(result.Issues);
        Assert.Equal([2, 4], result.Rows.Select(row => row.Row));
        Assert.Equal(ValidRow(), result.Rows[0].Cells);
    }

    [Fact]
    public async Task Corrupt_archive_is_a_safe_file_issue()
    {
        using var file = new MemoryStream([1, 2, 3]);
        var result = await new ClientXlsxReader().ReadAsync(file);
        Assert.NotEmpty(result.Issues);
        Assert.Empty(result.Rows);
    }

    [Theory]
    [InlineData(1000, false)]
    [InlineData(1001, true)]
    public async Task Nonempty_row_limit_is_enforced(int count, bool exceeded)
    {
        using var file = Workbook(Enumerable.Range(0, count).Select(_ => ValidRow()).ToArray());
        var result = await new ClientXlsxReader().ReadAsync(file);
        Assert.Equal(exceeded, result.LimitExceeded);
        if (!exceeded) Assert.Equal(count, result.Rows.Count);
    }

    [Theory]
    [InlineData(512 * 1024, false)]
    [InlineData(512 * 1024 + 1, true)]
    public async Task File_size_boundary_counts_actual_bytes(int length, bool exceeded)
    {
        using var original = Workbook([ValidRow()]);
        MemoryStream WithPadding(int padding)
        {
            var result = new MemoryStream();
            result.Write(original.ToArray());
            using (var archive = new ZipArchive(result, ZipArchiveMode.Update, true))
            using (var writer = new StreamWriter(archive.CreateEntry("padding.xml", CompressionLevel.NoCompression).Open()))
                writer.Write("<p>" + new string('x', padding) + "</p>");
            result.Position = 0;
            return result;
        }
        using var minimum = WithPadding(0);
        using var padded = WithPadding(length - (int)minimum.Length);
        Assert.Equal(length, padded.Length);
        var result = await new ClientXlsxReader().ReadAsync(padded);
        Assert.Equal(exceeded, result.LimitExceeded);
        if (!exceeded) Assert.Empty(result.Issues);
    }

    [Theory]
    [InlineData(8 * 1024 * 1024, false)]
    [InlineData(8 * 1024 * 1024 + 1, true)]
    public async Task Archive_limit_counts_decompressed_bytes(int expanded, bool exceeded)
    {
        using var file = Workbook([ValidRow()]);
        using (var archive = new ZipArchive(file, ZipArchiveMode.Update, true))
        {
            var existing = archive.Entries.Sum(entry => entry.Length);
            Add(archive, "padding.xml", "<p>" + new string('x', (int)(expanded - existing - 7)) + "</p>");
        }
        file.Position = 0;
        var result = await new ClientXlsxReader().ReadAsync(file);
        Assert.Equal(exceeded, result.LimitExceeded);
        if (!exceeded) Assert.Empty(result.Issues);
    }

    [Theory]
    [InlineData("formula")]
    [InlineData("error")]
    [InlineData("date-number")]
    [InlineData("headers")]
    [InlineData("sheet")]
    public async Task Unsupported_profile_is_rejected_without_cell_values(string change)
    {
        using var file = Workbook([ValidRow()]);
        Rewrite(file, change == "sheet" ? "xl/workbook.xml" : "xl/worksheets/sheet1.xml", xml => change switch
        {
            "sheet" => xml.Replace("Клиенты", "Other", StringComparison.Ordinal),
            "headers" => xml.Replace("<t>Телефон</t>", "<t>Wrong</t>", StringComparison.Ordinal),
            "formula" => xml.Replace("<c r=\"B2\" t=\"inlineStr\">", "<c r=\"B2\" t=\"inlineStr\"><f>1+1</f>", StringComparison.Ordinal),
            "error" => xml.Replace("<c r=\"B2\" t=\"inlineStr\">", "<c r=\"B2\" t=\"e\">", StringComparison.Ordinal),
            _ => xml.Replace("<c r=\"E2\" t=\"inlineStr\"><is><t>01.02.2010</t></is></c>", "<c r=\"E2\"><v>40000</v></c>", StringComparison.Ordinal)
        });
        var result = await new ClientXlsxReader().ReadAsync(file);
        Assert.NotEmpty(result.Issues);
        Assert.All(result.Issues, issue => Assert.DoesNotContain("900", issue.Message, StringComparison.Ordinal));
    }

    [Fact]
    public async Task Shared_strings_and_numeric_balance_are_supported()
    {
        using var file = Workbook([ValidRow()]);
        Rewrite(file, "xl/_rels/workbook.xml.rels", xml => xml.Replace("</Relationships>", "<Relationship Id=\"strings\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings\" Target=\"sharedStrings.xml\"/></Relationships>", StringComparison.Ordinal));
        Rewrite(file, "[Content_Types].xml", xml => xml.Replace("</Types>", "<Override PartName=\"/xl/sharedStrings.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml\"/></Types>", StringComparison.Ordinal));
        using (var zip = new ZipArchive(file, ZipArchiveMode.Update, true)) Add(zip, "xl/sharedStrings.xml", "<sst xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><si><t>Иванов Иван</t></si></sst>");
        Rewrite(file, "xl/worksheets/sheet1.xml", xml => xml
            .Replace("<c r=\"A2\" t=\"inlineStr\"><is><t>Иванов Иван Иванович</t></is></c>", "<c r=\"A2\" t=\"s\"><v>0</v></c>", StringComparison.Ordinal)
            .Replace("<c r=\"I2\" t=\"inlineStr\"><is><t>0</t></is></c>", "<c r=\"I2\"><v>-18000</v></c>", StringComparison.Ordinal));
        var result = await new ClientXlsxReader().ReadAsync(file);
        Assert.Empty(result.Issues);
        Assert.Equal("Иванов Иван", result.Rows[0].Cells[0]);
        Assert.Equal("-18000", result.Rows[0].Cells[8]);
    }

    private static void Rewrite(MemoryStream file, string path, Func<string, string> update)
    {
        using (var zip = new ZipArchive(file, ZipArchiveMode.Update, true))
        {
            var entry = zip.GetEntry(path)!;
            string contents;
            using (var reader = new StreamReader(entry.Open())) contents = reader.ReadToEnd();
            entry.Delete();
            Add(zip, path, update(contents));
        }
        file.Position = 0;
    }

    internal static MemoryStream Workbook(string[][] rows)
    {
        var stream = new MemoryStream();
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
        {
            Add(zip, "[Content_Types].xml", "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>");
            Add(zip, "_rels/.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            Add(zip, "xl/workbook.xml", "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Клиенты\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
            Add(zip, "xl/_rels/workbook.xml.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>");
            var xml = new StringBuilder("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
            var all = new[] { Headers }.Concat(rows).ToArray();
            for (var r = 0; r < all.Length; r++)
            {
                xml.Append($"<row r=\"{r + 1}\">");
                for (var c = 0; c < all[r].Length; c++)
                    xml.Append($"<c r=\"{(char)('A' + c)}{r + 1}\" t=\"inlineStr\"><is><t>{SecurityElement.Escape(all[r][c] ?? "")}</t></is></c>");
                xml.Append("</row>");
            }
            Add(zip, "xl/worksheets/sheet1.xml", xml.Append("</sheetData></worksheet>").ToString());
        }
        stream.Position = 0;
        return stream;
    }

    private static void Add(ZipArchive archive, string name, string text)
    {
        using var writer = new StreamWriter(archive.CreateEntry(name).Open());
        writer.Write(text);
    }
}
