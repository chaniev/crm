namespace GymCrm.Domain.Clients;

public class ClientContact
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;

    public Client Client { get; set; } = null!;
}
