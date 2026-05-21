namespace GymCrm.Domain.Messenger;

public enum ClientMessengerMessageStatus
{
    Received = 1,
    Queued = 2,
    Sending = 3,
    SentToTelegram = 4,
    Failed = 5
}
