using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.SeedData;

internal sealed class TestDataSeeder(SeedDataOptions options) : IAsyncDisposable
{
    private const string DefaultPassword = "1";
    private const bool SeedUserMustChangePassword = false;
    private const int RandomSeed = 20260527;

    private static readonly string[] GroupTypeNames =
    [
        "ММА",
        "Вольная борьба",
        "Кикбоксинг",
        "Боевое самбо"
    ];

    private static readonly string[] BranchNames =
    [
        "Филиал Центр",
        "Филиал Север",
        "Филиал Юг",
        "Филиал Запад"
    ];

    private static readonly string[] BranchAddresses =
    [
        "ул. Спортивная, 10",
        "Северный проспект, 22",
        "Южная набережная, 7",
        "Западный бульвар, 15"
    ];

    private static readonly int[] BranchGroupCounts = [12, 8, 6, 4];

    private static readonly int[] Durations = [60, 90, 120];

    private static readonly int[][] WeekdaySets =
    [
        [1, 3, 5],
        [2, 4, 6],
        [1, 4, 6],
        [2, 3, 5],
        [1, 2, 4]
    ];

    private static readonly TimeOnly[] TrainingStartTimes =
    [
        new(8, 0),
        new(10, 0),
        new(12, 30),
        new(16, 0),
        new(18, 30),
        new(20, 0)
    ];

    private readonly GymCrmDbContext dbContext = CreateDbContext(options.ConnectionString);
    private readonly PasswordHasher<User> passwordHasher = new();
    private readonly SeedClientPhotoWriter photoWriter = new(options.PhotoStorageRootPath);

    public async Task<SeedDataSummary> SeedAsync(CancellationToken cancellationToken)
    {
        if (options.ApplyMigrations)
        {
            await dbContext.Database.MigrateAsync(cancellationToken);
        }

        await RemoveSeedDataAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var validFrom = DateOnly.FromDateTime(now.UtcDateTime.Date.AddDays(-30));
        var groupTypeData = await ResolveGroupTypesAsync(now, cancellationToken);
        var branches = CreateBranches(now);
        var halls = CreateHalls(now);
        var administrators = CreateAdministrators(now);
        var coaches = CreateCoaches(now);
        var groups = CreateTrainingGroups(groupTypeData.UsedGroupTypes, branches, halls, now);
        var trainerLinks = CreateTrainerLinks(groups, coaches, administrators[0].Id, validFrom, now);
        var clientData = await CreateClientsAsync(
            groups,
            administrators[0].Id,
            validFrom,
            now,
            cancellationToken);

        dbContext.GroupTypes.AddRange(groupTypeData.CreatedGroupTypes);
        dbContext.Branches.AddRange(branches);
        dbContext.Halls.AddRange(halls);
        dbContext.Users.AddRange(administrators);
        dbContext.Users.AddRange(coaches);
        dbContext.TrainingGroups.AddRange(groups);
        dbContext.GroupTrainers.AddRange(trainerLinks.CurrentLinks);
        dbContext.GroupTrainerAssignments.AddRange(trainerLinks.Assignments);
        dbContext.Clients.AddRange(clientData.Clients);
        dbContext.ClientBranchAssignments.AddRange(clientData.BranchAssignments);
        dbContext.ClientGroups.AddRange(clientData.GroupLinks);
        dbContext.ClientGroupAssignments.AddRange(clientData.GroupAssignments);

        await dbContext.SaveChangesAsync(cancellationToken);

        return new SeedDataSummary(
            groupTypeData.UsedGroupTypes.Count,
            branches.Count,
            halls.Count,
            coaches.Count,
            administrators.Count,
            groups.Count,
            clientData.Clients.Count,
            clientData.Clients.Count(client => !string.IsNullOrWhiteSpace(client.PhotoPath)),
            options.PhotoStorageRootPath,
            DefaultPassword);
    }

    public ValueTask DisposeAsync() => dbContext.DisposeAsync();

    private async Task RemoveSeedDataAsync(CancellationToken cancellationToken)
    {
        var clientIds = SeedIds.ClientIds;
        var groupIds = SeedIds.TrainingGroupIds;
        var userIds = SeedIds.UserIds;
        var branchIds = SeedIds.BranchIds;
        var hallIds = SeedIds.HallIds;
        var groupTypeIds = SeedIds.GroupTypeIds;

        await dbContext.ClientMessengerReadStates
            .Where(state => clientIds.Contains(state.ClientId) || userIds.Contains(state.UserId))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ClientMessengerMessages
            .Where(message =>
                clientIds.Contains(message.ClientId) ||
                (message.CreatedByUserId.HasValue && userIds.Contains(message.CreatedByUserId.Value)))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ClientMessengerLinkTokens
            .Where(token => clientIds.Contains(token.ClientId) || userIds.Contains(token.CreatedByUserId))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ClientMessengerAccounts
            .Where(account => clientIds.Contains(account.ClientId))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.Attendance
            .Where(attendance =>
                clientIds.Contains(attendance.ClientId) ||
                groupIds.Contains(attendance.GroupId) ||
                userIds.Contains(attendance.MarkedByUserId))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ClientMembershipRefunds
            .Where(refund =>
                clientIds.Contains(refund.ClientId) ||
                userIds.Contains(refund.CreatedByUserId) ||
                (refund.CanceledByUserId.HasValue && userIds.Contains(refund.CanceledByUserId.Value)))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ClientMemberships
            .Where(membership =>
                clientIds.Contains(membership.ClientId) ||
                userIds.Contains(membership.ChangedByUserId) ||
                (membership.PaidByUserId.HasValue && userIds.Contains(membership.PaidByUserId.Value)))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ClientMembershipSales
            .Where(sale => clientIds.Contains(sale.ClientId) || userIds.Contains(sale.CreatedByUserId))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ClientContacts
            .Where(contact => clientIds.Contains(contact.ClientId))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ClientGroupAssignments
            .Where(assignment =>
                clientIds.Contains(assignment.ClientId) ||
                groupIds.Contains(assignment.GroupId) ||
                userIds.Contains(assignment.CreatedByUserId))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ClientGroups
            .Where(clientGroup =>
                clientIds.Contains(clientGroup.ClientId) ||
                groupIds.Contains(clientGroup.GroupId) ||
                branchIds.Contains(clientGroup.BranchId))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.GroupTrainerAssignments
            .Where(assignment =>
                groupIds.Contains(assignment.GroupId) ||
                userIds.Contains(assignment.TrainerId) ||
                userIds.Contains(assignment.CreatedByUserId))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.GroupTrainers
            .Where(groupTrainer =>
                groupIds.Contains(groupTrainer.GroupId) ||
                userIds.Contains(groupTrainer.TrainerId))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ClientBranchAssignments
            .Where(assignment =>
                clientIds.Contains(assignment.ClientId) ||
                branchIds.Contains(assignment.BranchId) ||
                userIds.Contains(assignment.CreatedByUserId))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.AuditLogs
            .Where(auditLog => userIds.Contains(auditLog.UserId))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.Clients
            .Where(client => clientIds.Contains(client.Id))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.TrainingGroups
            .Where(group => groupIds.Contains(group.Id))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.Halls
            .Where(hall => hallIds.Contains(hall.Id))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.Branches
            .Where(branch => branchIds.Contains(branch.Id))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.GroupTypes
            .Where(groupType => groupTypeIds.Contains(groupType.Id))
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.Users
            .Where(user => userIds.Contains(user.Id))
            .ExecuteDeleteAsync(cancellationToken);

        await photoWriter.DeleteSeedPhotosAsync(SeedIds.ClientCount, cancellationToken);
    }

    private static GymCrmDbContext CreateDbContext(string connectionString)
    {
        var optionsBuilder = new DbContextOptionsBuilder<GymCrmDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new GymCrmDbContext(optionsBuilder.Options);
    }

    private async Task<GroupTypeSeedData> ResolveGroupTypesAsync(
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var existingGroupTypes = await dbContext.GroupTypes
            .AsNoTracking()
            .Where(groupType => GroupTypeNames.Contains(groupType.Name))
            .ToDictionaryAsync(groupType => groupType.Name, cancellationToken);

        var usedGroupTypes = new List<GroupType>(GroupTypeNames.Length);
        var createdGroupTypes = new List<GroupType>(GroupTypeNames.Length);

        for (var index = 0; index < GroupTypeNames.Length; index++)
        {
            var name = GroupTypeNames[index];
            if (existingGroupTypes.TryGetValue(name, out var existingGroupType))
            {
                usedGroupTypes.Add(existingGroupType);
                continue;
            }

            var createdGroupType = new GroupType
            {
                Id = SeedIds.GroupType(index + 1),
                Name = name,
                Description = $"Тестовый тип групп: {name}.",
                CreatedAt = now,
                UpdatedAt = now
            };

            usedGroupTypes.Add(createdGroupType);
            createdGroupTypes.Add(createdGroupType);
        }

        return new GroupTypeSeedData(usedGroupTypes, createdGroupTypes);
    }

    private static List<Branch> CreateBranches(DateTimeOffset now) =>
        BranchNames
            .Select((name, index) => new Branch
            {
                Id = SeedIds.Branch(index + 1),
                Name = name,
                Address = BranchAddresses[index],
                Description = "Тестовый филиал для демонстрационного набора данных.",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            })
            .ToList();

    private static List<Hall> CreateHalls(DateTimeOffset now)
    {
        var halls = new List<Hall>(SeedIds.HallCount);

        for (var branchNumber = 1; branchNumber <= SeedIds.BranchCount; branchNumber++)
        {
            for (var hallNumber = 1; hallNumber <= 3; hallNumber++)
            {
                halls.Add(new Hall
                {
                    Id = SeedIds.Hall(branchNumber, hallNumber),
                    BranchId = SeedIds.Branch(branchNumber),
                    Name = $"Зал {hallNumber}",
                    Description = $"Тестовый зал {hallNumber} в филиале {branchNumber}.",
                    IsArchived = false,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
        }

        return halls;
    }

    private List<User> CreateAdministrators(DateTimeOffset now)
    {
        var administrators = new List<User>(SeedIds.AdministratorCount);

        for (var number = 1; number <= SeedIds.AdministratorCount; number++)
        {
            var user = new User
            {
                Id = SeedIds.Administrator(number),
                FullName = $"Администратор {number:00}",
                Login = $"seed.admin{number:00}",
                Role = UserRole.Administrator,
                MustChangePassword = SeedUserMustChangePassword,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            user.PasswordHash = passwordHasher.HashPassword(user, DefaultPassword);
            administrators.Add(user);
        }

        return administrators;
    }

    private List<User> CreateCoaches(DateTimeOffset now)
    {
        var coaches = new List<User>(SeedIds.CoachCount);

        for (var number = 1; number <= SeedIds.CoachCount; number++)
        {
            var user = new User
            {
                Id = SeedIds.Coach(number),
                FullName = $"Тренер {number:00}",
                Login = $"seed.coach{number:00}",
                Role = UserRole.Coach,
                MustChangePassword = SeedUserMustChangePassword,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            user.PasswordHash = passwordHasher.HashPassword(user, DefaultPassword);
            coaches.Add(user);
        }

        return coaches;
    }

    private static List<TrainingGroup> CreateTrainingGroups(
        IReadOnlyList<GroupType> groupTypes,
        IReadOnlyList<Branch> branches,
        IReadOnlyList<Hall> halls,
        DateTimeOffset now)
    {
        var groups = new List<TrainingGroup>(SeedIds.TrainingGroupCount);

        for (var branchIndex = 0; branchIndex < branches.Count; branchIndex++)
        {
            var branch = branches[branchIndex];
            var branchHalls = halls.Where(hall => hall.BranchId == branch.Id).ToArray();
            var groupCount = BranchGroupCounts[branchIndex];

            for (var localGroupIndex = 0; localGroupIndex < groupCount; localGroupIndex++)
            {
                var groupNumber = groups.Count + 1;
                var groupType = groupTypes[(groupNumber - 1) % groupTypes.Count];
                var sundayOnlyGroup = groupNumber == 1;

                groups.Add(new TrainingGroup
                {
                    Id = SeedIds.TrainingGroup(groupNumber),
                    BranchId = branch.Id,
                    HallId = branchHalls[localGroupIndex % branchHalls.Length].Id,
                    GroupTypeId = groupType.Id,
                    Name = sundayOnlyGroup
                        ? $"{groupType.Name} воскресенье 10:30"
                        : $"{groupType.Name} группа {groupNumber:00} - {branch.Name}",
                    TrainingStartTime = sundayOnlyGroup
                        ? new TimeOnly(10, 30)
                        : TrainingStartTimes[(groupNumber - 2) % TrainingStartTimes.Length],
                    DurationMinutes = sundayOnlyGroup
                        ? 90
                        : Durations[(groupNumber - 2) % Durations.Length],
                    Weekdays = sundayOnlyGroup
                        ? [7]
                        : WeekdaySets[(groupNumber - 2) % WeekdaySets.Length].ToArray(),
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
        }

        return groups;
    }

    private static (List<GroupTrainer> CurrentLinks, List<GroupTrainerAssignment> Assignments) CreateTrainerLinks(
        IReadOnlyList<TrainingGroup> groups,
        IReadOnlyList<User> coaches,
        Guid actorUserId,
        DateOnly validFrom,
        DateTimeOffset now)
    {
        var currentLinks = new List<GroupTrainer>(groups.Count);
        var assignments = new List<GroupTrainerAssignment>(groups.Count);

        for (var index = 0; index < groups.Count; index++)
        {
            var group = groups[index];
            var coach = coaches[index % coaches.Count];
            var groupNumber = index + 1;

            currentLinks.Add(new GroupTrainer
            {
                GroupId = group.Id,
                TrainerId = coach.Id
            });

            assignments.Add(new GroupTrainerAssignment
            {
                Id = SeedIds.GroupTrainerAssignment(groupNumber),
                GroupId = group.Id,
                TrainerId = coach.Id,
                ValidFrom = validFrom,
                CreatedByUserId = actorUserId,
                CreatedAt = now
            });
        }

        return (currentLinks, assignments);
    }

    private async Task<(
        List<Client> Clients,
        List<ClientBranchAssignment> BranchAssignments,
        List<ClientGroup> GroupLinks,
        List<ClientGroupAssignment> GroupAssignments)> CreateClientsAsync(
            IReadOnlyList<TrainingGroup> groups,
            Guid actorUserId,
            DateOnly validFrom,
            DateTimeOffset now,
            CancellationToken cancellationToken)
    {
        var random = new Random(RandomSeed);
        var initialGroupOrder = Enumerable.Range(0, groups.Count).ToArray();
        Shuffle(initialGroupOrder, random);
        var existingClientUniqueValues = await dbContext.Clients
            .AsNoTracking()
            .Select(client => new
            {
                client.LastName,
                client.FirstName,
                client.MiddleName,
                client.Phone
            })
            .ToListAsync(cancellationToken);
        var usedFullNameKeys = existingClientUniqueValues
            .Select(client => SeedClientIdentityGenerator.CreateFullNameKey(
                client.LastName,
                client.FirstName,
                client.MiddleName))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var usedPhoneKeys = existingClientUniqueValues
            .Select(client => SeedClientIdentityGenerator.CreatePhoneKey(client.Phone))
            .Where(phoneKey => !string.IsNullOrWhiteSpace(phoneKey))
            .ToHashSet(StringComparer.Ordinal);
        var nextFullNameNumber = 1;
        var nextPhoneNumber = 1;

        var clients = new List<Client>(SeedIds.ClientCount);
        var branchAssignments = new List<ClientBranchAssignment>(SeedIds.ClientCount);
        var groupLinks = new List<ClientGroup>(SeedIds.ClientCount);
        var groupAssignments = new List<ClientGroupAssignment>(SeedIds.ClientCount);

        for (var clientNumber = 1; clientNumber <= SeedIds.ClientCount; clientNumber++)
        {
            var groupIndex = clientNumber <= groups.Count
                ? initialGroupOrder[clientNumber - 1]
                : random.Next(groups.Count);
            var group = groups[groupIndex];
            var photo = await photoWriter.WritePhotoAsync(clientNumber, cancellationToken);
            var fullName = SeedClientIdentityGenerator.TakeNextUniqueFullName(
                usedFullNameKeys,
                ref nextFullNameNumber);
            var phone = SeedClientIdentityGenerator.TakeNextUniquePhone(usedPhoneKeys, ref nextPhoneNumber);
            var client = CreateClient(clientNumber, group.BranchId, fullName, phone, photo, now);

            clients.Add(client);
            branchAssignments.Add(new ClientBranchAssignment
            {
                Id = SeedIds.ClientBranchAssignment(clientNumber),
                ClientId = client.Id,
                BranchId = group.BranchId,
                ValidFrom = validFrom,
                CreatedByUserId = actorUserId,
                CreatedAt = now
            });
            groupLinks.Add(new ClientGroup
            {
                ClientId = client.Id,
                GroupId = group.Id,
                BranchId = group.BranchId
            });
            groupAssignments.Add(new ClientGroupAssignment
            {
                Id = SeedIds.ClientGroupAssignment(clientNumber),
                ClientId = client.Id,
                GroupId = group.Id,
                ValidFrom = validFrom,
                CreatedByUserId = actorUserId,
                CreatedAt = now
            });
        }

        return (clients, branchAssignments, groupLinks, groupAssignments);
    }

    private static Client CreateClient(
        int clientNumber,
        Guid branchId,
        (string LastName, string FirstName, string MiddleName) fullName,
        string phone,
        ClientPhotoSeedInfo photo,
        DateTimeOffset now)
    {
        return new Client
        {
            Id = SeedIds.Client(clientNumber),
            BranchId = branchId,
            LastName = fullName.LastName,
            FirstName = fullName.FirstName,
            MiddleName = fullName.MiddleName,
            Phone = phone,
            Notes = $"Тестовый клиент #{clientNumber:000}.",
            PhotoPath = photo.RelativePath,
            PhotoContentType = photo.ContentType,
            PhotoSizeBytes = photo.SizeBytes,
            PhotoUploadedAt = now,
            Status = ClientStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static void Shuffle(int[] values, Random random)
    {
        for (var index = values.Length - 1; index > 0; index--)
        {
            var swapIndex = random.Next(index + 1);
            (values[index], values[swapIndex]) = (values[swapIndex], values[index]);
        }
    }
}
