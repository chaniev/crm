using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddClientProfessionalStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsProfessional",
                table: "Clients",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ProfessionalComment",
                table: "Clients",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Clients_IsProfessional",
                table: "Clients",
                column: "IsProfessional");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Clients_IsProfessional",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "IsProfessional",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "ProfessionalComment",
                table: "Clients");
        }
    }
}
