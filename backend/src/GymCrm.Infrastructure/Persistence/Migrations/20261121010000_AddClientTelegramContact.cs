using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace GymCrm.Infrastructure.Persistence.Migrations;

[DbContext(typeof(GymCrmDbContext))]
[Migration("20261121010000_AddClientTelegramContact")]
public sealed class AddClientTelegramContact : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.AddColumn<string>("TelegramContactUsername", "Clients", type: "text", nullable: true);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropColumn("TelegramContactUsername", "Clients");
}
