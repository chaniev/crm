using System.Globalization;
using System.Text.RegularExpressions;

namespace GymCrm.Application.Clients;

public static partial class ClientImportMapping
{
    public static ClientImportMappingResult Map(IReadOnlyList<ClientImportRow> rows)
    {
        var mapped = new List<ClientImportMappedRow>();
        var issues = new List<ClientImportIssue>();
        foreach (var row in rows)
        {
            var cells = row.Cells;
            var before = issues.Count;
            void Invalid(string field, string message) => issues.Add(new(row.Row, field, "invalid_value", message));
            var name = Annotation().Replace(cells[0].Trim(), match => Marker().IsMatch(match.Value) ? match.Value : "");
            var tokens = name.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            var parts = new List<string>();
            var prefix = new List<string>();
            var ambiguous = false;
            foreach (var token in tokens)
            {
                if (Marker().IsMatch(token)) { if (parts.Count == 0) prefix.Add(token); else parts[^1] += " " + token; continue; }
                if (!NameWord().IsMatch(token) || token.Equals(ClientImportText.AmbiguousNameToken, StringComparison.OrdinalIgnoreCase)) ambiguous = true;
                parts.Add(string.Join(' ', prefix.Append(token))); prefix.Clear();
            }
            if (prefix.Count > 0 && parts.Count > 0) parts[^1] += " " + string.Join(' ', prefix);
            if (ambiguous || parts.Count is < 2 or > 3) Invalid("fullName", ClientImportText.InvalidName);
            var phones = cells[1].Split(',').Select(NormalizePhone).ToArray();
            if (phones.Any(phone => phone is null)) Invalid("phone", ClientImportText.InvalidPhone);
            DateOnly? birthDate = null;
            if (!string.IsNullOrWhiteSpace(cells[4]))
            {
                if (DateOnly.TryParseExact(cells[4].Trim(), "dd.MM.yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)) birthDate = parsed;
                else Invalid("birthDate", ClientImportText.InvalidBirthDate);
            }
            if (cells[7].Trim() != ClientImportText.ActiveStatus) Invalid("status", ClientImportText.InvalidStatus);
            var notes = new List<string>();
            void Add(string label, string? value) { if (!string.IsNullOrWhiteSpace(value)) notes.Add(label + ": " + value.Trim()); }
            Add(ClientImportText.AdditionalPhones, phones.Length > 1 ? string.Join(", ", phones.Skip(1)) : null);
            Add(ClientImportText.Headers[2], cells[2]); Add(ClientImportText.Headers[3], cells[3]);
            Add(ClientImportText.Headers[5], cells[5]); Add(ClientImportText.Headers[6], cells[6]);
            Add(ClientImportText.SourceBalance, cells[8]); Add(ClientImportText.Headers[9], cells[9]);
            var note = notes.Count == 0 ? null : string.Join('\n', notes);
            if (parts.Count is >= 2 and <= 3 && phones[0] is not null)
                foreach (var error in ClientCreationValidation.Validate(parts[0], parts[1], parts.Count == 3 ? parts[2] : null, phones[0]!, note))
                    Invalid(error.Key, error.Value[0]);
            if (before == issues.Count) mapped.Add(new(row.Row, parts[0], parts[1], parts.Count == 3 ? parts[2] : null, phones[0]!, birthDate, note));
        }
        return new(mapped, issues);
    }

    private static string? NormalizePhone(string value)
    {
        var clean = string.Concat(value.Where(c => !char.IsWhiteSpace(c) && c != '-'));
        if (clean.StartsWith('+')) clean = clean[1..];
        if (!clean.All(char.IsAsciiDigit)) return null;
        return clean.Length switch
        {
            10 => "+7" + clean,
            11 when clean[0] is '7' or '8' => "+7" + clean[1..],
            _ => null
        };
    }

    [GeneratedRegex(@"\([^()]*\)")]
    private static partial Regex Annotation();
    [GeneratedRegex(@"^(?:V|\u0414|\u0434|\(\u0414\)|\(\u0434\)|\(V\))$")]
    private static partial Regex Marker();
    [GeneratedRegex(@"^\p{L}+(?:[-']\p{L}+)*$")]
    private static partial Regex NameWord();
}
