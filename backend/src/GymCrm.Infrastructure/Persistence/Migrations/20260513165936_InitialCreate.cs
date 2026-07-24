using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BotIdempotencyRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Platform = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PlatformUserIdHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    IdempotencyKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ActionType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PayloadHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ResponseJson = table.Column<string>(type: "jsonb", nullable: true),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BotIdempotencyRecords", x => x.Id);
                    table.CheckConstraint("CK_BotIdempotencyRecords_RequiredValues", "btrim(\"Platform\") <> '' AND btrim(\"PlatformUserIdHash\") <> '' AND btrim(\"IdempotencyKey\") <> '' AND btrim(\"ActionType\") <> '' AND btrim(\"PayloadHash\") <> '' AND btrim(\"Status\") <> ''");
                });

            migrationBuilder.CreateTable(
                name: "Branches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Address = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Branches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ClientMembershipIdempotencyRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    IdempotencyKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ActionType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PayloadHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResultMembershipId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResultSaleId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientMembershipIdempotencyRecords", x => x.Id);
                    table.CheckConstraint("CK_ClientMembershipIdempotencyRecords_RequiredValues", "btrim(\"IdempotencyKey\") <> '' AND btrim(\"ActionType\") <> '' AND btrim(\"PayloadHash\") <> '' AND btrim(\"Status\") <> ''");
                });

            migrationBuilder.CreateTable(
                name: "GroupTypes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MembershipCatalogItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Price = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    BehaviorKind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    AvailableFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    AvailableTo = table.Column<DateOnly>(type: "date", nullable: true),
                    IsSystemOwned = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MembershipCatalogItems", x => x.Id);
                    table.CheckConstraint("CK_MembershipCatalogItems_Availability", "\"AvailableTo\" IS NULL OR \"AvailableTo\" >= \"AvailableFrom\"");
                    table.CheckConstraint("CK_MembershipCatalogItems_Name_NotBlank", "btrim(\"Name\") <> '' AND btrim(\"NormalizedName\") <> ''");
                    table.CheckConstraint("CK_MembershipCatalogItems_Ownership", "(\"BehaviorKind\" = 'Professional' AND \"BranchId\" IS NULL AND \"IsSystemOwned\") OR (\"BehaviorKind\" IN ('SingleVisit', 'Term') AND \"BranchId\" IS NOT NULL AND NOT \"IsSystemOwned\")");
                    table.CheckConstraint("CK_MembershipCatalogItems_Price", "(\"BehaviorKind\" = 'Professional' AND CAST(\"Price\" AS NUMERIC) = 0) OR (\"BehaviorKind\" IN ('SingleVisit', 'Term') AND CAST(\"Price\" AS NUMERIC) > 0)");
                    table.CheckConstraint("CK_MembershipCatalogItems_Price_WholeRub", "\"Price\" = trunc(\"Price\")");
                    table.ForeignKey(name: "FK_MembershipCatalogItems_Branches_BranchId", column: x => x.BranchId, principalTable: "Branches", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: true),
                    FullName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Login = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PasswordHash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Role = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    MessengerPlatform = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    MessengerPlatformUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    MustChangePassword = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.CheckConstraint("CK_Users_AdministratorBranch", "(\"Role\" = 'Administrator' AND \"BranchId\" IS NOT NULL) OR (\"Role\" <> 'Administrator' AND \"BranchId\" IS NULL)");
                    table.CheckConstraint("CK_Users_MessengerIdentity_Consistency", "(\"MessengerPlatform\" IS NULL AND (\"MessengerPlatformUserId\" IS NULL OR btrim(\"MessengerPlatformUserId\") = '')) OR (\"MessengerPlatform\" = 'Telegram' AND \"MessengerPlatformUserId\" IS NOT NULL AND btrim(\"MessengerPlatformUserId\") <> '')");
                    table.ForeignKey(name: "FK_Users_Branches_BranchId", column: x => x.BranchId, principalTable: "Branches", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Clients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    LastName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    FirstName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    MiddleName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    Phone = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    BirthDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    NotesChangedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    NotesChangedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    PhotoPath = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    PhotoContentType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    PhotoSizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    PhotoUploadedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Clients", x => x.Id);
                    table.CheckConstraint("CK_Clients_PhotoSizeBytes_NonNegative", "\"PhotoSizeBytes\" IS NULL OR \"PhotoSizeBytes\" >= 0");
                    table.ForeignKey(
                        name: "FK_Clients_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Clients_Users_NotesChangedByUserId",
                        column: x => x.NotesChangedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Halls",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Halls", x => x.Id);
                    table.UniqueConstraint("AK_Halls_Id_BranchId", x => new { x.Id, x.BranchId });
                    table.ForeignKey(
                        name: "FK_Halls_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActionType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    EntityId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "Web"),
                    MessengerPlatform = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    MessengerPlatformUserIdHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    OldValueJson = table.Column<string>(type: "jsonb", nullable: true),
                    NewValueJson = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClientContacts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FullName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Phone = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientContacts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientContacts_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClientMessengerAccounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Platform = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PlatformUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PlatformUserIdHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Username = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    DisplayName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    LinkedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UnlinkedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientMessengerAccounts", x => x.Id);
                    table.CheckConstraint("CK_ClientMessengerAccounts_RequiredValues", "btrim(\"PlatformUserId\") <> '' AND btrim(\"PlatformUserIdHash\") <> ''");
                    table.ForeignKey(
                        name: "FK_ClientMessengerAccounts_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClientMessengerLinkTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Platform = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UsedByPlatformUserIdHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientMessengerLinkTokens", x => x.Id);
                    table.CheckConstraint("CK_ClientMessengerLinkTokens_RequiredValues", "btrim(\"TokenHash\") <> ''");
                    table.ForeignKey(
                        name: "FK_ClientMessengerLinkTokens_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientMessengerLinkTokens_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClientMessengerReadStates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Platform = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LastReadAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientMessengerReadStates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientMessengerReadStates_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientMessengerReadStates_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClientTelegramPollStates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BotName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    NextUpdateOffset = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientTelegramPollStates", x => x.Id);
                    table.CheckConstraint("CK_ClientTelegramPollStates_BotName_Required", "btrim(\"BotName\") <> ''");
                });

            migrationBuilder.CreateTable(
                name: "ClientMessengerMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    Platform = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Direction = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Text = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    TelegramUpdateId = table.Column<long>(type: "bigint", nullable: true),
                    TelegramMessageId = table.Column<long>(type: "bigint", nullable: true),
                    TelegramChatId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    TelegramUserIdHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    IdempotencyKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    IdempotencyPayloadHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    FailureReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SentAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    FailedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientMessengerMessages", x => x.Id);
                    table.CheckConstraint("CK_ClientMessengerMessages_Text_Required", "btrim(\"Text\") <> ''");
                    table.ForeignKey(
                        name: "FK_ClientMessengerMessages_ClientMessengerAccounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "ClientMessengerAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ClientMessengerMessages_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientMessengerMessages_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClientBranchAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    ValidFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    ValidTo = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientBranchAssignments", x => x.Id);
                    table.CheckConstraint("CK_ClientBranchAssignments_Period_NonEmpty", "\"ValidTo\" IS NULL OR \"ValidTo\" > \"ValidFrom\"");
                    table.ForeignKey(
                        name: "FK_ClientBranchAssignments_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClientBranchAssignments_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientBranchAssignments_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClientMembershipSales",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    MembershipCatalogItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    BehaviorKind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PricingMode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PurchaseDate = table.Column<DateOnly>(type: "date", nullable: false),
                    PaymentDate = table.Column<DateOnly>(type: "date", nullable: false),
                    GrossAmount = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CommentChangedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CommentChangedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientMembershipSales", x => x.Id);
                    table.CheckConstraint("CK_ClientMembershipSales_Behavior_Pricing", "(\"BehaviorKind\" = 'Professional' AND \"PricingMode\" = 'Catalog' AND CAST(\"GrossAmount\" AS NUMERIC) = 0) OR (\"BehaviorKind\" = 'SingleVisit' AND \"PricingMode\" IN ('Catalog', 'CatalogOverride') AND CAST(\"GrossAmount\" AS NUMERIC) > 0) OR (\"BehaviorKind\" = 'Term' AND \"PricingMode\" IN ('Catalog', 'CatalogOverride', 'AmountOnly') AND CAST(\"GrossAmount\" AS NUMERIC) > 0)");
                    table.CheckConstraint("CK_ClientMembershipSales_GrossAmount_NonNegative", "\"GrossAmount\" >= 0");
                    table.CheckConstraint("CK_ClientMembershipSales_GrossAmount_WholeRub", "\"GrossAmount\" = trunc(\"GrossAmount\")");
                    table.CheckConstraint("CK_ClientMembershipSales_PricingMode_Catalog", "(\"PricingMode\" IN ('Catalog', 'CatalogOverride') AND \"MembershipCatalogItemId\" IS NOT NULL) OR (\"PricingMode\" = 'AmountOnly' AND \"MembershipCatalogItemId\" IS NULL)");
                    table.ForeignKey(
                        name: "FK_ClientMembershipSales_Users_CommentChangedByUserId",
                        column: x => x.CommentChangedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClientMembershipSales_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientMembershipSales_MembershipCatalogItems_MembershipCatalogItemId",
                        column: x => x.MembershipCatalogItemId,
                        principalTable: "MembershipCatalogItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClientMembershipSales_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClientMemberships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    SaleId = table.Column<Guid>(type: "uuid", nullable: false),
                    BehaviorKind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    IndividualValidFrom = table.Column<DateOnly>(type: "date", nullable: true),
                    IndividualValidTo = table.Column<DateOnly>(type: "date", nullable: true),
                    ProfessionalComment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    SingleVisitUsed = table.Column<bool>(type: "boolean", nullable: false),
                    ValidFrom = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ValidTo = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ChangeReason = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ChangedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientMemberships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientMemberships_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientMemberships_ClientMembershipSales_SaleId",
                        column: x => x.SaleId,
                        principalTable: "ClientMembershipSales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClientMemberships_Users_ChangedByUserId",
                        column: x => x.ChangedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClientMembershipRefunds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SaleId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    RefundDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CanceledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CanceledByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientMembershipRefunds", x => x.Id);
                    table.CheckConstraint("CK_ClientMembershipRefunds_Amount_Positive", "\"Amount\" > 0");
                    table.CheckConstraint("CK_ClientMembershipRefunds_Amount_WholeRub", "\"Amount\" = trunc(\"Amount\")");
                    table.ForeignKey(
                        name: "FK_ClientMembershipRefunds_ClientMembershipSales_SaleId",
                        column: x => x.SaleId,
                        principalTable: "ClientMembershipSales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientMembershipRefunds_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClientMembershipRefunds_Users_CanceledByUserId",
                        column: x => x.CanceledByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClientMembershipRefunds_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TrainingGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    HallId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    TrainingStartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    Weekdays = table.Column<int[]>(type: "integer[]", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainingGroups", x => x.Id);
                    table.UniqueConstraint("AK_TrainingGroups_Id_BranchId", x => new { x.Id, x.BranchId });
                    table.CheckConstraint("CK_TrainingGroups_DurationMinutes_Range", "\"DurationMinutes\" >= 1 AND \"DurationMinutes\" <= 180");
                    table.CheckConstraint("CK_TrainingGroups_Weekdays_NotEmpty", "cardinality(\"Weekdays\") >= 1");
                    table.ForeignKey(
                        name: "FK_TrainingGroups_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TrainingGroups_GroupTypes_GroupTypeId",
                        column: x => x.GroupTypeId,
                        principalTable: "GroupTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TrainingGroups_Halls_HallId_BranchId",
                        columns: x => new { x.HallId, x.BranchId },
                        principalTable: "Halls",
                        principalColumns: new[] { "Id", "BranchId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Attendance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    TrainingDate = table.Column<DateOnly>(type: "date", nullable: false),
                    IsPresent = table.Column<bool>(type: "boolean", nullable: false),
                    SingleVisitMembershipSaleId = table.Column<Guid>(type: "uuid", nullable: true),
                    SingleVisitWriteOffMembershipId = table.Column<Guid>(type: "uuid", nullable: true),
                    MarkedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    MarkedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Attendance", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Attendance_ClientMembershipSales_SingleVisitMembershipSaleId",
                        column: x => x.SingleVisitMembershipSaleId,
                        principalTable: "ClientMembershipSales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Attendance_ClientMemberships_SingleVisitWriteOffMembershipId",
                        column: x => x.SingleVisitWriteOffMembershipId,
                        principalTable: "ClientMemberships",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Attendance_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Attendance_TrainingGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "TrainingGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Attendance_Users_MarkedByUserId",
                        column: x => x.MarkedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClientGroups",
                columns: table => new
                {
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientGroups", x => new { x.ClientId, x.GroupId });
                    table.ForeignKey(
                        name: "FK_ClientGroups_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientGroups_TrainingGroups_GroupId_BranchId",
                        columns: x => new { x.GroupId, x.BranchId },
                        principalTable: "TrainingGroups",
                        principalColumns: new[] { "Id", "BranchId" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClientMissedTrainingAcknowledgements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    LastAttendanceId = table.Column<Guid>(type: "uuid", nullable: false),
                    LastTrainingDate = table.Column<DateOnly>(type: "date", nullable: false),
                    LastTrainingStartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    AcknowledgedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AcknowledgedByUserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientMissedTrainingAcknowledgements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientMissedTrainingAcknowledgements_Attendance_LastAttenda~",
                        column: x => x.LastAttendanceId,
                        principalTable: "Attendance",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClientMissedTrainingAcknowledgements_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientMissedTrainingAcknowledgements_Users_AcknowledgedByUs~",
                        column: x => x.AcknowledgedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClientGroupAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    ValidFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    ValidTo = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientGroupAssignments", x => x.Id);
                    table.CheckConstraint("CK_ClientGroupAssignments_Period_NonEmpty", "\"ValidTo\" IS NULL OR \"ValidTo\" > \"ValidFrom\"");
                    table.ForeignKey(
                        name: "FK_ClientGroupAssignments_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientGroupAssignments_TrainingGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "TrainingGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientGroupAssignments_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "GroupTrainers",
                columns: table => new
                {
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    TrainerId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupTrainers", x => new { x.GroupId, x.TrainerId });
                    table.ForeignKey(
                        name: "FK_GroupTrainers_TrainingGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "TrainingGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GroupTrainers_Users_TrainerId",
                        column: x => x.TrainerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "GroupTrainerAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TrainerId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    ValidFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    ValidTo = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupTrainerAssignments", x => x.Id);
                    table.CheckConstraint("CK_GroupTrainerAssignments_Period_NonEmpty", "\"ValidTo\" IS NULL OR \"ValidTo\" > \"ValidFrom\"");
                    table.ForeignKey(
                        name: "FK_GroupTrainerAssignments_TrainingGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "TrainingGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GroupTrainerAssignments_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GroupTrainerAssignments_Users_TrainerId",
                        column: x => x.TrainerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Attendance_ClientId_GroupId_TrainingDate",
                table: "Attendance",
                columns: new[] { "ClientId", "GroupId", "TrainingDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Attendance_GroupId_TrainingDate",
                table: "Attendance",
                columns: new[] { "GroupId", "TrainingDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Attendance_MarkedByUserId",
                table: "Attendance",
                column: "MarkedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Attendance_SingleVisitMembershipSaleId",
                table: "Attendance",
                column: "SingleVisitMembershipSaleId");

            migrationBuilder.CreateIndex(
                name: "IX_Attendance_SingleVisitWriteOffMembershipId",
                table: "Attendance",
                column: "SingleVisitWriteOffMembershipId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMissedTrainingAcknowledgements_AcknowledgedByUserId",
                table: "ClientMissedTrainingAcknowledgements",
                column: "AcknowledgedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMissedTrainingAcknowledgements_ClientId",
                table: "ClientMissedTrainingAcknowledgements",
                column: "ClientId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClientMissedTrainingAcknowledgements_LastAttendanceId",
                table: "ClientMissedTrainingAcknowledgements",
                column: "LastAttendanceId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_ActionType",
                table: "AuditLogs",
                column: "ActionType");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_CreatedAt",
                table: "AuditLogs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_EntityType",
                table: "AuditLogs",
                column: "EntityType");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_MessengerPlatform",
                table: "AuditLogs",
                column: "MessengerPlatform");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Source",
                table: "AuditLogs",
                column: "Source");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_UserId",
                table: "AuditLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_BotIdempotencyRecords_ExpiresAt",
                table: "BotIdempotencyRecords",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_BotIdempotencyRecords_Platform_PlatformUserIdHash_Idempoten~",
                table: "BotIdempotencyRecords",
                columns: new[] { "Platform", "PlatformUserIdHash", "IdempotencyKey", "ActionType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Branches_IsArchived",
                table: "Branches",
                column: "IsArchived");

            migrationBuilder.CreateIndex(
                name: "IX_Branches_Name",
                table: "Branches",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_ClientContacts_ClientId",
                table: "ClientContacts",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "UX_ClientMembershipIdempotency_Actor_Key",
                table: "ClientMembershipIdempotencyRecords",
                columns: new[] { "ActorUserId", "IdempotencyKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClientMembershipIdempotencyRecords_ExpiresAt",
                table: "ClientMembershipIdempotencyRecords",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerAccounts_ClientId_Platform",
                table: "ClientMessengerAccounts",
                columns: new[] { "ClientId", "Platform" },
                unique: true,
                filter: "\"UnlinkedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerAccounts_Platform_PlatformUserId",
                table: "ClientMessengerAccounts",
                columns: new[] { "Platform", "PlatformUserId" },
                unique: true,
                filter: "\"UnlinkedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerAccounts_PlatformUserIdHash",
                table: "ClientMessengerAccounts",
                column: "PlatformUserIdHash");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerLinkTokens_ClientId_Platform_ExpiresAt",
                table: "ClientMessengerLinkTokens",
                columns: new[] { "ClientId", "Platform", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerLinkTokens_CreatedByUserId",
                table: "ClientMessengerLinkTokens",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerLinkTokens_Platform_UsedAt",
                table: "ClientMessengerLinkTokens",
                columns: new[] { "Platform", "UsedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerLinkTokens_TokenHash",
                table: "ClientMessengerLinkTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerMessages_AccountId",
                table: "ClientMessengerMessages",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerMessages_ClientId_Platform_CreatedAt",
                table: "ClientMessengerMessages",
                columns: new[] { "ClientId", "Platform", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerMessages_ClientId_Platform_Direction_Cr~",
                table: "ClientMessengerMessages",
                columns: new[] { "ClientId", "Platform", "Direction", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerMessages_ClientId_Platform_IdempotencyKey",
                table: "ClientMessengerMessages",
                columns: new[] { "ClientId", "Platform", "IdempotencyKey" },
                unique: true,
                filter: "\"IdempotencyKey\" IS NOT NULL AND btrim(\"IdempotencyKey\") <> ''");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerMessages_CreatedByUserId",
                table: "ClientMessengerMessages",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerMessages_Platform_TelegramChatId_Telegra~",
                table: "ClientMessengerMessages",
                columns: new[] { "Platform", "TelegramChatId", "TelegramMessageId" },
                unique: true,
                filter: "\"TelegramMessageId\" IS NOT NULL AND \"TelegramChatId\" IS NOT NULL AND btrim(\"TelegramChatId\") <> ''");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerMessages_Platform_TelegramUpdateId",
                table: "ClientMessengerMessages",
                columns: new[] { "Platform", "TelegramUpdateId" },
                unique: true,
                filter: "\"TelegramUpdateId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerReadStates_ClientId_Platform_UserId",
                table: "ClientMessengerReadStates",
                columns: new[] { "ClientId", "Platform", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClientMessengerReadStates_UserId",
                table: "ClientMessengerReadStates",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientTelegramPollStates_BotName",
                table: "ClientTelegramPollStates",
                column: "BotName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClientBranchAssignments_BranchId",
                table: "ClientBranchAssignments",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientBranchAssignments_ClientId",
                table: "ClientBranchAssignments",
                column: "ClientId",
                unique: true,
                filter: "\"ValidTo\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ClientBranchAssignments_ClientId_ValidFrom_ValidTo",
                table: "ClientBranchAssignments",
                columns: new[] { "ClientId", "ValidFrom", "ValidTo" });

            migrationBuilder.CreateIndex(
                name: "IX_ClientBranchAssignments_CreatedByUserId",
                table: "ClientBranchAssignments",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientGroupAssignments_ClientId",
                table: "ClientGroupAssignments",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientGroupAssignments_ClientId_GroupId",
                table: "ClientGroupAssignments",
                columns: new[] { "ClientId", "GroupId" },
                unique: true,
                filter: "\"ValidTo\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ClientGroupAssignments_ClientId_GroupId_ValidFrom_ValidTo",
                table: "ClientGroupAssignments",
                columns: new[] { "ClientId", "GroupId", "ValidFrom", "ValidTo" });

            migrationBuilder.CreateIndex(
                name: "IX_ClientGroupAssignments_CreatedByUserId",
                table: "ClientGroupAssignments",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientGroupAssignments_GroupId",
                table: "ClientGroupAssignments",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientGroups_BranchId",
                table: "ClientGroups",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientGroups_GroupId_BranchId",
                table: "ClientGroups",
                columns: new[] { "GroupId", "BranchId" });

            migrationBuilder.CreateIndex(
                name: "IX_ClientMemberships_ChangedByUserId",
                table: "ClientMemberships",
                column: "ChangedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMemberships_ClientId",
                table: "ClientMemberships",
                column: "ClientId",
                unique: true,
                filter: "\"ValidTo\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMemberships_SaleId",
                table: "ClientMemberships",
                column: "SaleId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMemberships_ValidTo",
                table: "ClientMemberships",
                column: "ValidTo");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMembershipRefunds_CanceledAt",
                table: "ClientMembershipRefunds",
                column: "CanceledAt");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMembershipRefunds_CanceledByUserId",
                table: "ClientMembershipRefunds",
                column: "CanceledByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMembershipRefunds_ClientId",
                table: "ClientMembershipRefunds",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMembershipRefunds_CreatedByUserId",
                table: "ClientMembershipRefunds",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMembershipRefunds_RefundDate",
                table: "ClientMembershipRefunds",
                column: "RefundDate");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMembershipRefunds_SaleId",
                table: "ClientMembershipRefunds",
                column: "SaleId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMembershipSales_ClientId",
                table: "ClientMembershipSales",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMembershipSales_CreatedByUserId",
                table: "ClientMembershipSales",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMembershipSales_CommentChangedByUserId",
                table: "ClientMembershipSales",
                column: "CommentChangedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMembershipSales_PurchaseDate",
                table: "ClientMembershipSales",
                column: "PurchaseDate");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMembershipSales_PaymentDate",
                table: "ClientMembershipSales",
                column: "PaymentDate");

            migrationBuilder.CreateIndex(name: "IX_ClientMembershipSales_MembershipCatalogItemId", table: "ClientMembershipSales", column: "MembershipCatalogItemId");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_BranchId",
                table: "Clients",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_FirstName",
                table: "Clients",
                column: "FirstName");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_LastName",
                table: "Clients",
                column: "LastName");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_NotesChangedByUserId",
                table: "Clients",
                column: "NotesChangedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_Phone",
                table: "Clients",
                column: "Phone");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_Status",
                table: "Clients",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_GroupTrainers_TrainerId",
                table: "GroupTrainers",
                column: "TrainerId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupTrainerAssignments_CreatedByUserId",
                table: "GroupTrainerAssignments",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupTrainerAssignments_GroupId",
                table: "GroupTrainerAssignments",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupTrainerAssignments_TrainerId",
                table: "GroupTrainerAssignments",
                column: "TrainerId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupTrainerAssignments_TrainerId_GroupId",
                table: "GroupTrainerAssignments",
                columns: new[] { "TrainerId", "GroupId" },
                unique: true,
                filter: "\"ValidTo\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_GroupTrainerAssignments_TrainerId_GroupId_ValidFrom_ValidTo",
                table: "GroupTrainerAssignments",
                columns: new[] { "TrainerId", "GroupId", "ValidFrom", "ValidTo" });

            migrationBuilder.CreateIndex(
                name: "IX_GroupTypes_Name",
                table: "GroupTypes",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Halls_BranchId",
                table: "Halls",
                column: "BranchId");

            migrationBuilder.CreateIndex(name: "IX_MembershipCatalogItems_BehaviorKind", table: "MembershipCatalogItems", column: "BehaviorKind", unique: true, filter: "\"BehaviorKind\" = 'Professional'");
            migrationBuilder.CreateIndex(name: "IX_MembershipCatalogItems_BranchId", table: "MembershipCatalogItems", column: "BranchId");
            migrationBuilder.CreateIndex(name: "IX_MembershipCatalogItems_BranchId_NormalizedName_Price", table: "MembershipCatalogItems", columns: new[] { "BranchId", "NormalizedName", "Price" });

            migrationBuilder.CreateIndex(
                name: "IX_Halls_IsArchived",
                table: "Halls",
                column: "IsArchived");

            migrationBuilder.CreateIndex(
                name: "IX_Halls_Name",
                table: "Halls",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingGroups_BranchId",
                table: "TrainingGroups",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingGroups_GroupTypeId",
                table: "TrainingGroups",
                column: "GroupTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingGroups_HallId",
                table: "TrainingGroups",
                column: "HallId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingGroups_HallId_BranchId",
                table: "TrainingGroups",
                columns: new[] { "HallId", "BranchId" });

            migrationBuilder.CreateIndex(
                name: "IX_TrainingGroups_Name",
                table: "TrainingGroups",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Login",
                table: "Users",
                column: "Login",
                unique: true);

            migrationBuilder.CreateIndex(name: "IX_Users_BranchId", table: "Users", column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_MessengerPlatform_MessengerPlatformUserId",
                table: "Users",
                columns: new[] { "MessengerPlatform", "MessengerPlatformUserId" },
                unique: true,
                filter: "\"MessengerPlatform\" IS NOT NULL AND \"MessengerPlatformUserId\" IS NOT NULL AND btrim(\"MessengerPlatformUserId\") <> ''");

            migrationBuilder.InsertData(
                table: "MembershipCatalogItems",
                columns: new[] { "Id", "AvailableFrom", "AvailableTo", "BehaviorKind", "BranchId", "CreatedAt", "IsSystemOwned", "Name", "NormalizedName", "Price", "UpdatedAt" },
                values: new object[] { new Guid("11111111-1111-4111-8111-111111111070"), new DateOnly(2020, 1, 1), null, "Professional", null, new DateTimeOffset(new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Unspecified), TimeSpan.Zero), true, "Профессиональный", "ПРОФЕССИОНАЛЬНЫЙ", 0m, new DateTimeOffset(new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Unspecified), TimeSpan.Zero) });

            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS btree_gist;");
            migrationBuilder.Sql("""
                ALTER TABLE "MembershipCatalogItems"
                ADD CONSTRAINT "EX_MembershipCatalogItems_BranchNamePrice_Availability_NoOverlap"
                EXCLUDE USING gist (
                    "BranchId" WITH =,
                    "NormalizedName" WITH =,
                    "Price" WITH =,
                    daterange("AvailableFrom", COALESCE("AvailableTo", 'infinity'::date), '[]') WITH &&
                ) WHERE ("BehaviorKind" IN ('SingleVisit', 'Term'));
                """);
            migrationBuilder.Sql("""
                ALTER TABLE "ClientMemberships"
                ADD CONSTRAINT "EX_ClientMemberships_ClientId_Period_NoOverlap"
                EXCLUDE USING gist (
                    "ClientId" WITH =,
                    daterange("IndividualValidFrom", COALESCE("IndividualValidTo", 'infinity'::date), '[]') WITH &&
                ) WHERE ("BehaviorKind" IN ('Term', 'Professional'));
                """);
            migrationBuilder.Sql("""
                ALTER TABLE "ClientBranchAssignments"
                ADD CONSTRAINT "EX_ClientBranchAssignments_ClientId_Period_NoOverlap"
                EXCLUDE USING gist (
                    "ClientId" WITH =,
                    daterange("ValidFrom", COALESCE("ValidTo", 'infinity'::date), '[)') WITH &&
                );
                """);
            migrationBuilder.Sql("""
                ALTER TABLE "ClientGroupAssignments"
                ADD CONSTRAINT "EX_ClientGroupAssignments_ClientGroup_Period_NoOverlap"
                EXCLUDE USING gist (
                    "ClientId" WITH =,
                    "GroupId" WITH =,
                    daterange("ValidFrom", COALESCE("ValidTo", 'infinity'::date), '[)') WITH &&
                );
                """);
            migrationBuilder.Sql("""
                ALTER TABLE "GroupTrainerAssignments"
                ADD CONSTRAINT "EX_GroupTrainerAssignments_TrainerGroup_Period_NoOverlap"
                EXCLUDE USING gist (
                    "TrainerId" WITH =,
                    "GroupId" WITH =,
                    daterange("ValidFrom", COALESCE("ValidTo", 'infinity'::date), '[)') WITH &&
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClientMissedTrainingAcknowledgements");

            migrationBuilder.DropTable(
                name: "Attendance");

            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "BotIdempotencyRecords");

            migrationBuilder.DropTable(
                name: "ClientMembershipIdempotencyRecords");

            migrationBuilder.DropTable(
                name: "ClientContacts");

            migrationBuilder.DropTable(
                name: "ClientMessengerLinkTokens");

            migrationBuilder.DropTable(
                name: "ClientMessengerMessages");

            migrationBuilder.DropTable(
                name: "ClientMessengerReadStates");

            migrationBuilder.DropTable(
                name: "ClientTelegramPollStates");

            migrationBuilder.DropTable(
                name: "ClientGroups");

            migrationBuilder.DropTable(
                name: "ClientGroupAssignments");

            migrationBuilder.DropTable(
                name: "ClientMembershipRefunds");

            migrationBuilder.DropTable(
                name: "ClientMemberships");

            migrationBuilder.DropTable(
                name: "GroupTrainerAssignments");

            migrationBuilder.DropTable(
                name: "GroupTrainers");

            migrationBuilder.DropTable(
                name: "ClientBranchAssignments");

            migrationBuilder.DropTable(
                name: "ClientMembershipSales");

            migrationBuilder.DropTable(
                name: "ClientMessengerAccounts");

            migrationBuilder.DropTable(
                name: "Clients");

            migrationBuilder.DropTable(
                name: "MembershipCatalogItems");

            migrationBuilder.DropTable(
                name: "TrainingGroups");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "GroupTypes");

            migrationBuilder.DropTable(
                name: "Halls");

            migrationBuilder.DropTable(
                name: "Branches");
        }
    }
}
