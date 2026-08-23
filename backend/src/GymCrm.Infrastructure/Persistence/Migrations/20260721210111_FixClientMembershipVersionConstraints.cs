using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FixClientMembershipVersionConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ClientMemberships_ClientId",
                table: "ClientMemberships");

            migrationBuilder.DropIndex(
                name: "IX_ClientMemberships_SaleId",
                table: "ClientMemberships");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMemberships_ClientId",
                table: "ClientMemberships",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMemberships_SaleId",
                table: "ClientMemberships",
                column: "SaleId",
                unique: true,
                filter: "\"ValidTo\" IS NULL");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ClientMemberships_ClientId",
                table: "ClientMemberships");

            migrationBuilder.DropIndex(
                name: "IX_ClientMemberships_SaleId",
                table: "ClientMemberships");

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

        }
    }
}
