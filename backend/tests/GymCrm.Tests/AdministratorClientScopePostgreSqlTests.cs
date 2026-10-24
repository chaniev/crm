using System.Data.Common;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Clients;
using GymCrm.Application.Messenger;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Messenger;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public sealed class AdministratorClientScopePostgreSqlTests
{
    [Fact]
    public async Task Real_http_staff_and_bot_isolate_two_branches_and_transfer_without_sale()
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString(), botServiceToken: "isolated-runtime-token");
        factory.UseKestrel(0);
        await factory.SeedAsync();
        factory.ClientOptions.BaseAddress = new Uri(factory.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single());
        var (clientId, actorId) = await SeedClientAsync(factory);
        var foreignId = Guid.NewGuid();
        using (var seed = factory.Services.CreateScope())
        {
            var db = seed.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var adminA = await db.Users.SingleAsync(user => user.Id == actorId);
            adminA.MessengerPlatform = MessengerPlatform.Telegram;
            adminA.MessengerPlatformUserId = "runtime-admin-a";
            db.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                Login = "runtime-admin-b",
                LoginNormalized = "RUNTIME-ADMIN-B",
                FullName = "Administrator B",
                PasswordHash = adminA.PasswordHash,
                Role = UserRole.Administrator,
                BranchId = factory.ForeignBranchId,
                MessengerPlatform = MessengerPlatform.Telegram,
                MessengerPlatformUserId = "runtime-admin-b"
            });
            db.Clients.Add(new Client { Id = foreignId, BranchId = factory.ForeignBranchId, FirstName = "Foreign", LastName = "Runtime", Phone = "+79990000002" });
            await db.SaveChangesAsync();
        }
        var (admin, csrf) = await factory.LoginAsync(UserRole.Administrator);
        using (admin)
        using (var adminB = factory.CreateClient())
        using (var bot = factory.CreateClient())
        {
            Assert.NotEqual(80, admin.BaseAddress!.Port);
            using var ready = await admin.GetAsync("/health/ready");
            ready.EnsureSuccessStatusCode();
            var sessionB = await adminB.GetFromJsonAsync<JsonElement>("/auth/session");
            using var loginB = await BranchSettingsAppFactory.SendAsync(adminB, HttpMethod.Post, "/auth/login",
                new { login = "runtime-admin-b", password = BranchSettingsAppFactory.Password }, sessionB.GetProperty("csrfToken").GetString());
            loginB.EnsureSuccessStatusCode();
            var ownList = await admin.GetFromJsonAsync<JsonElement>("/clients?skip=0&take=20");
            Assert.Equal(clientId, Assert.Single(ownList.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());
            var foreignList = await adminB.GetFromJsonAsync<JsonElement>("/clients?skip=0&take=20");
            Assert.Equal(foreignId, Assert.Single(foreignList.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());
            using var denied = await admin.GetAsync($"/clients/{foreignId}");
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
            Assert.Empty(await denied.Content.ReadAsStringAsync());
            bot.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "isolated-runtime-token");
            foreach (var (identity, expected) in new[] { ("runtime-admin-a", clientId), ("runtime-admin-b", foreignId) })
            {
                var result = await bot.GetFromJsonAsync<JsonElement>($"/internal/bot/clients?platform=Telegram&platformUserId={identity}&take=10");
                Assert.Equal(expected, Assert.Single(result.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());
            }
            using var transferred = await TransferAsync(admin, csrf, clientId, factory.ForeignBranchId, "runtime-transfer");
            Assert.Equal(HttpStatusCode.NoContent, transferred.StatusCode);
            Assert.Empty(await transferred.Content.ReadAsStringAsync());
            using var replay = await TransferAsync(admin, csrf, clientId, factory.ForeignBranchId, "runtime-transfer");
            Assert.Equal(HttpStatusCode.NoContent, replay.StatusCode);
            using var newKey = await TransferAsync(admin, csrf, clientId, factory.ForeignBranchId, "runtime-new-key");
            Assert.Equal(HttpStatusCode.NotFound, newKey.StatusCode);
            using var oldBotCard = await bot.GetAsync($"/internal/bot/clients/{clientId}?platform=Telegram&platformUserId=runtime-admin-a");
            Assert.Equal(HttpStatusCode.NotFound, oldBotCard.StatusCode);
            using var newCard = await adminB.GetAsync($"/clients/{clientId}");
            Assert.Equal(HttpStatusCode.OK, newCard.StatusCode);
        }
        using var verification = factory.Services.CreateScope();
        var context = verification.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Empty(await context.ClientMembershipSales.ToArrayAsync());
        Assert.Empty(await context.ClientMembershipRefunds.ToArrayAsync());
        Assert.Equal(1, await context.AuditLogs.CountAsync(log => log.ActionType == "ClientTransferred"));
    }

    [Fact]
    public async Task Reassignment_before_group_deactivation_cannot_disclose_former_branch_blockers()
    {
        var barrier = new BeforeGroupReadBarrier();
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString(), barrier);
        await factory.SeedAsync();
        var (clientId, actorId) = await SeedClientAsync(factory);
        var groupId = Guid.NewGuid();
        var typeId = Guid.NewGuid();
        using (var seed = factory.Services.CreateScope())
        {
            var db = seed.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            db.GroupTypes.Add(new GroupType { Id = typeId, Name = "Scope regression" });
            db.TrainingGroups.Add(new TrainingGroup
            {
                Id = groupId,
                BranchId = factory.OwnBranchId,
                HallId = factory.OwnHallId,
                GroupTypeId = typeId,
                Name = "Protected group",
                DurationMinutes = 60,
                Weekdays = [1],
                TrainingStartTime = new TimeOnly(12, 0)
            });
            var sale = new ClientMembershipSale
            {
                Id = Guid.NewGuid(),
                ClientId = clientId,
                BehaviorKind = MembershipBehaviorKind.Term,
                CreatedByUserId = actorId,
                PricingMode = ClientMembershipSalePricingMode.AmountOnly,
                GrossAmount = 1000
            };
            var membership = new ClientMembership
            {
                Id = Guid.NewGuid(),
                ClientId = clientId,
                SaleId = sale.Id,
                BehaviorKind = MembershipBehaviorKind.Term,
                ChangedByUserId = actorId,
                IndividualValidFrom = seed.ServiceProvider.GetRequiredService<IBusinessDateProvider>().Today,
                IndividualValidTo = seed.ServiceProvider.GetRequiredService<IBusinessDateProvider>().Today.AddDays(30)
            };
            membership.TargetGroups.Add(new ClientMembershipTargetGroup
            {
                ClientMembershipId = membership.Id,
                GroupId = groupId,
                BranchId = factory.OwnBranchId,
                Position = 1
            });
            db.ClientMembershipSales.Add(sale);
            db.ClientMemberships.Add(membership);
            await db.SaveChangesAsync();
        }
        var (admin, csrf) = await factory.LoginAsync(UserRole.Administrator);
        using (admin)
        {
            barrier.Arm();
            var pending = BranchSettingsAppFactory.SendAsync(admin, HttpMethod.Put, $"/groups/{groupId}",
                new { name = "Protected group", branchId = factory.OwnBranchId, groupTypeId = typeId, isActive = false }, csrf);
            await barrier.Entered.Task.WaitAsync(TimeSpan.FromSeconds(15));
            try { await ReassignAsync(postgres.GetConnectionString(), actorId, factory.ForeignBranchId); }
            finally { barrier.Release.TrySetResult(); }
            using var denied = await pending.WaitAsync(TimeSpan.FromSeconds(15));
            Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
            var body = await denied.Content.ReadAsStringAsync();
            Assert.DoesNotContain(clientId.ToString(), body);
            Assert.DoesNotContain("PostgreSQL scope", body);
        }
        using var verification = factory.Services.CreateScope();
        var context = verification.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.True((await context.TrainingGroups.SingleAsync(group => group.Id == groupId)).IsActive);
        Assert.Empty(await context.AuditLogs.Where(log => log.ActionType == "TrainingGroupUpdated").ToArrayAsync());
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public async Task Messenger_lease_preserves_durable_sending_and_blocks_scope_changes_until_dispatch_finishes(bool reassignActor, bool cancelSend)
    {
        var transport = new PausedTransport();
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString(), configureServices: services =>
        {
            services.RemoveAll<IClientTelegramTransport>();
            services.AddSingleton<IClientTelegramTransport>(transport);
        });
        await factory.SeedAsync();
        var (clientId, actorId) = await SeedClientAsync(factory);
        await SeedMessengerAccountAsync(factory, clientId);
        var (admin, token) = await factory.LoginAsync(UserRole.Administrator);
        var (manager, managerToken) = await factory.LoginAsync(UserRole.HeadCoach);
        using (admin)
        using (manager)
        using (var cancellation = new CancellationTokenSource())
        {
            var sending = SendMessageAsync(admin, token, clientId, "leased-send", cancellation.Token);
            await transport.Entered.Task.WaitAsync(TimeSpan.FromSeconds(15));
            using (var secondConnection = factory.Services.CreateScope())
            {
                var message = Assert.Single(await secondConnection.ServiceProvider.GetRequiredService<GymCrmDbContext>().ClientMessengerMessages.AsNoTracking().ToArrayAsync());
                Assert.Equal(ClientMessengerMessageStatus.Sending, message.Status);
            }
            Task scopeChange;
            if (reassignActor)
            {
                scopeChange = ReassignAsync(postgres.GetConnectionString(), actorId, factory.ForeignBranchId);
            }
            else
            {
                scopeChange = TransferWhileSendingAsync();
            }
            async Task TransferWhileSendingAsync()
            {
                using var result = await TransferAsync(manager, managerToken, clientId, factory.ForeignBranchId, "after-send");
                Assert.Equal(HttpStatusCode.OK, result.StatusCode);
            }
            try
            {
                await AssertDatabaseLockWaitAsync(postgres.GetConnectionString(), reassignActor ? "Users" : "Clients");
                Assert.False(scopeChange.IsCompleted);
                if (cancelSend) cancellation.Cancel();
                else transport.Release.TrySetResult();
                if (cancelSend) await Assert.ThrowsAnyAsync<OperationCanceledException>(async () => { using var ignored = await sending; });
                else { using var sent = await sending.WaitAsync(TimeSpan.FromSeconds(15)); Assert.Equal(HttpStatusCode.OK, sent.StatusCode); }
                await scopeChange.WaitAsync(TimeSpan.FromSeconds(15));
            }
            finally { transport.Release.TrySetResult(); }
            using var replay = await SendMessageAsync(admin, token, clientId, "leased-send", CancellationToken.None);
            Assert.Equal(HttpStatusCode.NotFound, replay.StatusCode);
            Assert.DoesNotContain("private message", await replay.Content.ReadAsStringAsync());
        }
        Assert.Equal(1, transport.SendCount);
        using var verification = factory.Services.CreateScope();
        var stored = Assert.Single(await verification.ServiceProvider.GetRequiredService<GymCrmDbContext>().ClientMessengerMessages.ToArrayAsync());
        Assert.Equal(cancelSend ? ClientMessengerMessageStatus.Sending : ClientMessengerMessageStatus.SentToTelegram, stored.Status);
    }

    [Fact]
    public async Task Simultaneous_message_keys_dispatch_only_the_database_winner()
    {
        var transport = new PausedTransport();
        var arrivals = new TwoMessageInsertBarrier();
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString(), arrivals, configureServices: services =>
        {
            services.RemoveAll<IClientTelegramTransport>();
            services.AddSingleton<IClientTelegramTransport>(transport);
        });
        await factory.SeedAsync();
        var (clientId, _) = await SeedClientAsync(factory);
        await SeedMessengerAccountAsync(factory, clientId);
        var (admin, token) = await factory.LoginAsync(UserRole.Administrator);
        using (admin)
        {
            var first = SendMessageAsync(admin, token, clientId, "same-key", CancellationToken.None);
            var second = SendMessageAsync(admin, token, clientId, "same-key", CancellationToken.None);
            await transport.Entered.Task.WaitAsync(TimeSpan.FromSeconds(15));
            transport.Release.TrySetResult();
            var results = await Task.WhenAll(first, second).WaitAsync(TimeSpan.FromSeconds(15));
            foreach (var result in results) { using (result) Assert.Equal(HttpStatusCode.OK, result.StatusCode); }
        }
        Assert.Equal(2, arrivals.Arrived);
        Assert.Equal(1, transport.SendCount);
        using var verification = factory.Services.CreateScope();
        Assert.Single(await verification.ServiceProvider.GetRequiredService<GymCrmDbContext>().ClientMessengerMessages.ToArrayAsync());
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public async Task Winning_transfer_or_actor_reassignment_prevents_waiting_client_write(bool reassignActor, bool attention)
    {
        var barrier = new BeforeLockBarrier(reassignActor ? "Branches" : "Clients");
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString(), barrier);
        await factory.SeedAsync();
        var (clientId, actorId) = await SeedClientAsync(factory);
        var (admin, token) = await factory.LoginAsync(UserRole.Administrator);
        var (manager, managerToken) = await factory.LoginAsync(UserRole.HeadCoach);
        using (admin)
        using (manager)
        {
            barrier.Arm();
            var waitingWrite = BranchSettingsAppFactory.SendAsync(admin, attention ? HttpMethod.Post : HttpMethod.Put,
                attention ? $"/clients/{clientId}/attention/missed-training/contacted" : $"/clients/{clientId}/archive", null, token);
            await barrier.Entered.Task.WaitAsync(TimeSpan.FromSeconds(15));
            try
            {
                if (reassignActor)
                {
                    await using var connection = new NpgsqlConnection(postgres.GetConnectionString());
                    await connection.OpenAsync();
                    await using var command = new NpgsqlCommand("UPDATE \"Users\" SET \"BranchId\" = @branch WHERE \"Id\" = @actor", connection);
                    command.Parameters.AddWithValue("branch", factory.ForeignBranchId);
                    command.Parameters.AddWithValue("actor", actorId);
                    Assert.Equal(1, await command.ExecuteNonQueryAsync());
                }
                else
                {
                    using var transfer = await TransferAsync(manager, managerToken, clientId, factory.ForeignBranchId, "winning-transfer");
                    Assert.Equal(HttpStatusCode.OK, transfer.StatusCode);
                }
            }
            finally { barrier.Release.TrySetResult(); }
            using var denied = await waitingWrite.WaitAsync(TimeSpan.FromSeconds(15));
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
            Assert.Empty(await denied.Content.ReadAsStringAsync());
        }
        using var verification = factory.Services.CreateScope();
        var db = verification.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(ClientStatus.Active, (await db.Clients.SingleAsync(client => client.Id == clientId)).Status);
        Assert.False(await db.AuditLogs.AnyAsync(log => log.ActionType == "ClientArchived" || log.ActionType == "ClientMissedTrainingContacted"));
        Assert.Empty(await db.ClientMissedTrainingAcknowledgements.ToArrayAsync());
        Assert.False(await db.ClientMembershipIdempotencyRecords.AnyAsync(record => record.Status == "Pending"));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Reassigned_actor_cannot_clean_expired_refund_reservation(bool cancel)
    {
        var barrier = new BeforeLockBarrier("Users");
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString(), barrier);
        await factory.SeedAsync();
        var (clientId, actorId) = await SeedClientAsync(factory);
        var recordId = Guid.NewGuid();
        using (var seed = factory.Services.CreateScope())
        {
            var db = seed.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            db.ClientMembershipIdempotencyRecords.Add(new ClientMembershipIdempotencyRecord
            {
                Id = recordId,
                ActorUserId = actorId,
                ClientId = clientId,
                IdempotencyKey = "expired-refund",
                ActionType = "MembershipRefundCreated",
                PayloadHash = "original",
                Status = "Completed",
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-9),
                UpdatedAt = DateTimeOffset.UtcNow.AddDays(-9),
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(-2)
            });
            await db.SaveChangesAsync();
        }
        var (admin, token) = await factory.LoginAsync(UserRole.Administrator);
        using (admin)
        {
            admin.DefaultRequestHeaders.Add("Idempotency-Key", "expired-refund");
            barrier.Arm();
            var resourceId = Guid.NewGuid();
            var waiting = BranchSettingsAppFactory.SendAsync(admin, HttpMethod.Post,
                cancel ? $"/clients/{clientId}/membership/refunds/{resourceId}/cancel" : $"/clients/{clientId}/membership/sales/{resourceId}/refunds",
                cancel ? null : new { refundDate = "2026-10-24", amount = 100, comment = "valid request" }, token);
            await barrier.Entered.Task.WaitAsync(TimeSpan.FromSeconds(15));
            try { await ReassignAsync(postgres.GetConnectionString(), actorId, factory.ForeignBranchId); }
            finally { barrier.Release.TrySetResult(); }
            using var denied = await waiting.WaitAsync(TimeSpan.FromSeconds(15));
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
            Assert.Empty(await denied.Content.ReadAsStringAsync());
        }
        using var verification = factory.Services.CreateScope();
        var context = verification.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var record = Assert.Single(await context.ClientMembershipIdempotencyRecords.AsNoTracking().ToArrayAsync());
        Assert.Equal(recordId, record.Id);
        Assert.Equal("Completed", record.Status);
        Assert.Equal("original", record.PayloadHash);
        Assert.Empty(await context.ClientMembershipRefunds.ToArrayAsync());
    }

    [Theory]
    [InlineData("ClientArchived")]
    [InlineData("ClientTransferred")]
    public async Task Audit_failure_rolls_back_mutation_assignments_and_reservation(string action)
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString(), new AuditFailure(action));
        await factory.SeedAsync();
        var (clientId, _) = await SeedClientAsync(factory);
        var (admin, token) = await factory.LoginAsync(UserRole.Administrator);
        using (admin)
        using (var result = action == "ClientTransferred"
                   ? await TransferAsync(admin, token, clientId, factory.ForeignBranchId, "failed-transfer")
                   : await BranchSettingsAppFactory.SendAsync(admin, HttpMethod.Put, $"/clients/{clientId}/archive", null, token))
        {
            Assert.Equal(HttpStatusCode.InternalServerError, result.StatusCode);
        }
        using var verification = factory.Services.CreateScope();
        var db = verification.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var client = await db.Clients.SingleAsync(candidate => candidate.Id == clientId);
        Assert.Equal(factory.OwnBranchId, client.BranchId);
        Assert.Equal(ClientStatus.Active, client.Status);
        Assert.Null(Assert.Single(await db.ClientBranchAssignments.ToArrayAsync()).ValidTo);
        Assert.False(await db.AuditLogs.AnyAsync(log => log.ActionType == action));
        Assert.Empty(await db.ClientMembershipIdempotencyRecords.ToArrayAsync());
    }

    [Fact]
    public async Task Transfer_and_completed_replay_are_empty_and_keep_one_assignment_transition_without_sales()
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString());
        await factory.SeedAsync();
        var (clientId, _) = await SeedClientAsync(factory);
        var (admin, token) = await factory.LoginAsync(UserRole.Administrator);
        using (admin)
        {
            foreach (var key in new[] { "completed-transfer", "completed-transfer", "new-transfer" })
            {
                using var response = await TransferAsync(admin, token, clientId, factory.ForeignBranchId, key);
                Assert.Equal(key == "new-transfer" ? HttpStatusCode.NotFound : HttpStatusCode.NoContent, response.StatusCode);
                Assert.Empty(await response.Content.ReadAsStringAsync());
            }
        }
        using var verification = factory.Services.CreateScope();
        var db = verification.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(2, await db.ClientBranchAssignments.CountAsync());
        Assert.Equal(1, await db.ClientBranchAssignments.CountAsync(assignment => assignment.ValidTo == null));
        Assert.Equal(1, await db.AuditLogs.CountAsync(log => log.ActionType == "ClientTransferred"));
        Assert.Equal("Completed", Assert.Single(await db.ClientMembershipIdempotencyRecords.ToArrayAsync()).Status);
        Assert.Empty(await db.ClientMembershipSales.ToArrayAsync());
        Assert.Empty(await db.ClientMembershipRefunds.ToArrayAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Photo_rollback_removes_new_file_but_lost_commit_acknowledgement_preserves_persisted_file(bool commitSucceeded)
    {
        var fault = new CommitFault(commitSucceeded);
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString(), fault);
        await factory.SeedAsync();
        var (clientId, _) = await SeedClientAsync(factory);
        var (admin, token) = await factory.LoginAsync(UserRole.Administrator);
        string oldPath;
        using (admin)
        {
            using var original = await UploadAsync(admin, token, clientId, 1);
            Assert.Equal(HttpStatusCode.OK, original.StatusCode);
            oldPath = Directory.GetFiles(factory.PhotoStorageRootPath).Single();
            fault.Armed = true;
            using var failed = await UploadAsync(admin, token, clientId, 2);
            Assert.Equal(HttpStatusCode.InternalServerError, failed.StatusCode);
        }
        using var verification = factory.Services.CreateScope();
        var db = verification.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var metadata = await db.Clients.SingleAsync(client => client.Id == clientId);
        var currentPath = Path.Combine(factory.PhotoStorageRootPath, metadata.PhotoPath!);
        Assert.True(File.Exists(currentPath));
        if (commitSucceeded)
        {
            Assert.NotEqual(oldPath, currentPath);
            Assert.Equal((byte)2, (await File.ReadAllBytesAsync(currentPath))[^1]);
        }
        else
        {
            Assert.Equal(oldPath, currentPath);
            Assert.Single(Directory.GetFiles(factory.PhotoStorageRootPath));
        }
    }

    [Fact]
    public async Task Admitted_photo_is_an_independent_snapshot_after_replacement_and_transfer()
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString());
        await factory.SeedAsync();
        var (clientId, actorId) = await SeedClientAsync(factory);
        var (admin, token) = await factory.LoginAsync(UserRole.Administrator);
        using (admin)
        using (var original = await UploadAsync(admin, token, clientId, 1))
        using (var scope = factory.Services.CreateScope())
        {
            Assert.Equal(HttpStatusCode.OK, original.StatusCode);
            var service = scope.ServiceProvider.GetRequiredService<IClientPhotoService>();
            var snapshot = await service.OpenReadAsync(clientId, new ClientPhotoReadCommand(actorId), CancellationToken.None);
            Assert.True(snapshot.Succeeded);
            using var replacement = await UploadAsync(admin, token, clientId, 2);
            Assert.Equal(HttpStatusCode.OK, replacement.StatusCode);
            using var transfer = await TransferAsync(admin, token, clientId, factory.ForeignBranchId, "photo-transfer");
            Assert.Equal(HttpStatusCode.NoContent, transfer.StatusCode);
            using var denied = await admin.GetAsync($"/clients/{clientId}/photo");
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
            await using var contents = snapshot.Photo!.Content;
            using var bytes = new MemoryStream();
            await contents.CopyToAsync(bytes);
            Assert.Equal((byte)1, bytes.ToArray()[^1]);
            Assert.Single(Directory.GetFiles(factory.PhotoStorageRootPath));
        }
    }

    private static async Task<(Guid ClientId, Guid ActorId)> SeedClientAsync(BranchSettingsAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var actor = await db.Users.SingleAsync(user => user.Role == UserRole.Administrator);
        var today = scope.ServiceProvider.GetRequiredService<IBusinessDateProvider>().Today;
        var client = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = factory.OwnBranchId,
            FirstName = "Client",
            LastName = "PostgreSQL scope",
            Phone = "+79990000001",
            Status = ClientStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Clients.Add(client);
        db.ClientBranchAssignments.Add(new ClientBranchAssignment
        {
            Id = Guid.NewGuid(),
            ClientId = client.Id,
            BranchId = factory.OwnBranchId,
            ValidFrom = today.AddDays(-1),
            CreatedByUserId = actor.Id,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        return (client.Id, actor.Id);
    }

    private static Task<HttpResponseMessage> TransferAsync(HttpClient http, string csrf, Guid clientId, Guid branchId, string key)
    {
        http.DefaultRequestHeaders.Remove("Idempotency-Key");
        http.DefaultRequestHeaders.Add("Idempotency-Key", key);
        return BranchSettingsAppFactory.SendAsync(http, HttpMethod.Post, $"/clients/{clientId}/transfer",
            new { targetBranchId = branchId, targetGroupIds = Array.Empty<Guid>() }, csrf);
    }

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient http, string csrf, Guid clientId, byte marker)
    {
        using var form = new MultipartFormDataContent();
        var bytes = new ByteArrayContent([137, 80, 78, 71, 13, 10, 26, 10, marker]);
        bytes.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(bytes, "photo", "scope.png");
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/clients/{clientId}/photo") { Content = form };
        request.Headers.Add("X-CSRF-TOKEN", csrf);
        return await http.SendAsync(request);
    }

    private static async Task SeedMessengerAccountAsync(BranchSettingsAppFactory factory, Guid clientId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        db.ClientMessengerAccounts.Add(new ClientMessengerAccount
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            Platform = MessengerPlatform.Telegram,
            PlatformUserId = "19100001",
            PlatformUserIdHash = new string('a', 64),
            LinkedAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
    }

    private static async Task<HttpResponseMessage> SendMessageAsync(HttpClient http, string csrf, Guid clientId, string key, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/clients/{clientId}/messenger/telegram/messages")
        { Content = JsonContent.Create(new { text = "private message" }) };
        request.Headers.Add("X-CSRF-TOKEN", csrf);
        request.Headers.Add("Idempotency-Key", key);
        return await http.SendAsync(request, cancellationToken);
    }

    private static async Task ReassignAsync(string connectionString, Guid actorId, Guid branchId)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("UPDATE \"Users\" SET \"BranchId\" = @branch WHERE \"Id\" = @actor", connection);
        command.Parameters.AddWithValue("branch", branchId);
        command.Parameters.AddWithValue("actor", actorId);
        Assert.Equal(1, await command.ExecuteNonQueryAsync());
    }

    private static async Task AssertDatabaseLockWaitAsync(string connectionString, string table)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(timeout.Token);
        await using var command = new NpgsqlCommand("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE @query)", connection);
        command.Parameters.AddWithValue("query", $"%\"{table}\"%");
        while (!(bool)(await command.ExecuteScalarAsync(timeout.Token))!)
            await Task.Delay(20, timeout.Token);
    }

    private sealed class PausedTransport : IClientTelegramTransport
    {
        private int sendCount;
        public int SendCount => Volatile.Read(ref sendCount);
        public bool IsConfigured => true;
        public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public Task<ClientTelegramBotIdentity?> GetBotIdentityAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<ClientTelegramBotIdentity?>(new ClientTelegramBotIdentity("task191_test_bot"));
        public Task<IReadOnlyList<ClientTelegramIncomingUpdate>> GetUpdatesAsync(long? offset, int limit, TimeSpan timeout, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ClientTelegramIncomingUpdate>>([]);
        public async Task<ClientTelegramSendMessageResult> SendTextMessageAsync(string telegramUserId, string text, CancellationToken cancellationToken = default)
        {
            Interlocked.Increment(ref sendCount);
            Entered.TrySetResult();
            await Release.Task.WaitAsync(cancellationToken);
            return new ClientTelegramSendMessageResult(true, 191, telegramUserId);
        }
    }

    private sealed class TwoMessageInsertBarrier : SaveChangesInterceptor
    {
        private int arrived;
        public int Arrived => Volatile.Read(ref arrived);
        private readonly TaskCompletionSource bothArrived = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (eventData.Context!.ChangeTracker.Entries<ClientMessengerMessage>().Any(entry => entry.State == EntityState.Added))
            {
                if (Interlocked.Increment(ref arrived) == 2) bothArrived.TrySetResult();
                await bothArrived.Task.WaitAsync(TimeSpan.FromSeconds(15), cancellationToken);
            }
            return result;
        }
    }

    private sealed class BeforeGroupReadBarrier : DbCommandInterceptor
    {
        private int armed;
        public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public void Arm() => Interlocked.Exchange(ref armed, 1);
        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
            CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("FROM \"TrainingGroups\"", StringComparison.Ordinal) && Interlocked.Exchange(ref armed, 0) == 1)
            {
                Entered.TrySetResult();
                await Release.Task.WaitAsync(TimeSpan.FromSeconds(15), cancellationToken);
            }
            return result;
        }
    }

    private sealed class BeforeLockBarrier(string table) : DbCommandInterceptor
    {
        private int armed;
        public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public void Arm() => Interlocked.Exchange(ref armed, 1);
        public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command,
            CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains($"FROM \"{table}\"", StringComparison.Ordinal) &&
                command.CommandText.Contains("FOR ", StringComparison.Ordinal) && Interlocked.Exchange(ref armed, 0) == 1)
            {
                Entered.TrySetResult();
                await Release.Task.WaitAsync(TimeSpan.FromSeconds(15), cancellationToken);
            }
            return result;
        }
    }

    private sealed class AuditFailure(string action) : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (eventData.Context!.ChangeTracker.Entries<AuditLog>().Any(entry => entry.State == EntityState.Added && entry.Entity.ActionType == action))
                throw new InvalidOperationException("Injected audit failure.");
            return ValueTask.FromResult(result);
        }
    }

    private sealed class CommitFault(bool afterCommit) : DbTransactionInterceptor
    {
        public bool Armed { get; set; }
        public override ValueTask<InterceptionResult> TransactionCommittingAsync(DbTransaction transaction,
            TransactionEventData eventData, InterceptionResult result, CancellationToken cancellationToken = default)
        {
            if (Armed && !afterCommit) { Armed = false; throw new InvalidOperationException("Injected before commit."); }
            return ValueTask.FromResult(result);
        }
        public override Task TransactionCommittedAsync(DbTransaction transaction, TransactionEndEventData eventData,
            CancellationToken cancellationToken = default)
        {
            if (Armed && afterCommit) { Armed = false; throw new InvalidOperationException("Injected lost commit acknowledgement."); }
            return Task.CompletedTask;
        }
    }
}
