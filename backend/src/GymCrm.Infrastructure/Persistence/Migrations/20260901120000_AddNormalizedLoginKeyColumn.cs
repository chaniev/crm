using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymCrm.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Prepares the login identity upgrade: adds the nullable normalized key
    /// column. The key values themselves are backfilled by the application
    /// startup persistence flow (see <c>LoginIdentityBackfill</c>), which uses
    /// the same domain <c>LoginIdentity</c> contract as the application, and the
    /// following migration turns the column into the case-insensitive unique
    /// barrier after the backfill has been verified.
    /// </summary>
    [DbContext(typeof(GymCrmDbContext))]
    [Migration("20260901120000_AddNormalizedLoginKeyColumn")]
    public partial class AddNormalizedLoginKeyColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LoginNormalized",
                table: "Users",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LoginNormalized",
                table: "Users");
        }
    }
}
