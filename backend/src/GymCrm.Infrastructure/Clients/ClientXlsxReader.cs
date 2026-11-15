using System.Globalization;
using System.IO.Compression;
using System.Xml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using GymCrm.Application.Clients;

namespace GymCrm.Infrastructure.Clients;

public sealed class ClientXlsxReader : IClientXlsxReader
{
    public async Task<ClientXlsxReadResult> ReadAsync(Stream stream, CancellationToken cancellationToken = default)
    {
        using var buffer = new MemoryStream();
        var bytes = new byte[8192];
        int read;
        while ((read = await stream.ReadAsync(bytes, cancellationToken)) > 0)
        {
            if (buffer.Length + read > ClientImportLimits.FileBytes) return Failure("file_limit", true);
            buffer.Write(bytes, 0, read);
        }
        try
        {
            buffer.Position = 0;
            using (var archive = new ZipArchive(buffer, ZipArchiveMode.Read, true))
            {
                long expanded = 0;
                foreach (var entry in archive.Entries)
                {
                    using var part = entry.Open();
                    while ((read = await part.ReadAsync(bytes, cancellationToken)) > 0)
                    {
                        expanded += read;
                        if (expanded > ClientImportLimits.ExpandedBytes) return Failure("expanded_limit", true);
                    }
                }
            }
            buffer.Position = 0;
            using var document = SpreadsheetDocument.Open(buffer, false,
                new OpenSettings { MaxCharactersInPart = ClientImportLimits.ExpandedBytes });
            var workbook = document.WorkbookPart;
            var sheets = workbook?.Workbook?.Sheets?.Elements<Sheet>().Where(s => s.Name?.Value == ClientImportText.Sheet).ToArray();
            if (workbook is null || sheets is not { Length: 1 } || sheets[0].Id?.Value is not string id)
                return Failure("sheet_invalid");
            if (workbook.GetPartById(id) is not WorksheetPart worksheet) return Failure("sheet_invalid");
            var strings = workbook.SharedStringTablePart?.SharedStringTable?.Elements<SharedStringItem>().Select(s => s.InnerText).ToArray() ?? [];
            var rows = new List<ClientImportRow>();
            var issues = new List<ClientImportIssue>();
            var numbers = new HashSet<uint>();
            var headerSeen = false;
            foreach (var row in worksheet.Worksheet?.GetFirstChild<SheetData>()?.Elements<Row>() ?? [])
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (row.RowIndex?.Value is not uint number || number is 0 or > 1048576 || !numbers.Add(number)) return Failure("row_invalid");
                var cells = new string[10];
                Array.Fill(cells, string.Empty);
                var columns = new HashSet<int>();
                var nonempty = false;
                foreach (var cell in row.Elements<Cell>())
                {
                    var reference = cell.CellReference?.Value ?? "";
                    var letters = new string(reference.TakeWhile(char.IsAsciiLetterUpper).ToArray());
                    if (!uint.TryParse(reference.AsSpan(letters.Length), out var cellRow) || cellRow != number) return Failure("cell_invalid");
                    var column = letters.Length == 1 ? letters[0] - 'A' : 10;
                    var value = cell.InlineString?.InnerText ?? cell.CellValue?.InnerText ?? "";
                    var type = cell.DataType?.Value;
                    var supported = type is null || type == CellValues.Number || type == CellValues.InlineString || type == CellValues.SharedString;
                    if (type == CellValues.SharedString)
                    {
                        if (!int.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var index) || index < 0 || index >= strings.Length) supported = false;
                        else value = strings[index];
                    }
                    nonempty |= !string.IsNullOrWhiteSpace(value) || cell.CellFormula is not null;
                    if (column is < 0 or > 9)
                    {
                        if (!string.IsNullOrWhiteSpace(value) || cell.CellFormula is not null) issues.Add(Issue((int)number, null, "column_invalid"));
                        continue;
                    }
                    if (!columns.Add(column)) return Failure("cell_invalid");
                    if (cell.CellFormula is not null || !supported ||
                        !string.IsNullOrEmpty(value) && (type is null || type == CellValues.Number) && column != 8)
                        issues.Add(Issue((int)number, ClientImportText.Fields[column], "cell_unsupported"));
                    cells[column] = value;
                }
                if (number == 1)
                {
                    headerSeen = cells.SequenceEqual(ClientImportText.Headers);
                    if (!headerSeen) return Failure("headers_invalid");
                }
                else if (nonempty)
                {
                    rows.Add(new ClientImportRow((int)number, cells));
                    if (rows.Count > ClientImportLimits.Rows) return Failure("row_limit", true);
                }
            }
            if (!headerSeen || rows.Count == 0) return Failure("empty_file");
            return new(rows, issues);
        }
        catch (Exception error) when (error is InvalidDataException or OpenXmlPackageException or XmlException or FormatException or ArgumentException or IOException or InvalidOperationException or KeyNotFoundException)
        {
            return Failure("file_invalid");
        }
    }

    private static ClientImportIssue Issue(int? row, string? field, string code) => new(row, field, code, ClientImportText.InvalidFile);
    private static ClientXlsxReadResult Failure(string code, bool limit = false) => new([], [Issue(null, "file", code)], limit);
}
