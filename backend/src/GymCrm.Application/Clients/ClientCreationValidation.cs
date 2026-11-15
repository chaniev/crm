using GymCrm.Domain.Clients;

namespace GymCrm.Application.Clients;

public static class ClientCreationValidation
{
    public static Dictionary<string, string[]> Validate(string? lastName, string? firstName, string? middleName, string phone, string? notes)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(phone)) errors["phone"] = [ClientImportText.PhoneRequired];
        else if (phone.Length > 32) errors["phone"] = [ClientImportText.PhoneTooLong];
        if (notes?.Length > Client.NotesMaxLength) errors["notes"] = [ClientImportText.NotesTooLong];
        if (lastName?.Length > 128) errors["lastName"] = [ClientImportText.LastNameTooLong];
        if (firstName?.Length > 128) errors["firstName"] = [ClientImportText.FirstNameTooLong];
        if (middleName?.Length > 128) errors["middleName"] = [ClientImportText.MiddleNameTooLong];
        if (string.IsNullOrWhiteSpace(lastName) && string.IsNullOrWhiteSpace(firstName) && string.IsNullOrWhiteSpace(middleName)) errors["fullName"] = [ClientImportText.FullNameRequired];
        return errors;
    }
}
