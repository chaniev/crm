# Gym CRM backend

ASP.NET Core API is the source of truth for CRM business behavior: roles,
permissions, access scope, memberships, attendance, audit, validation and
ProblemDetails contracts.

## Structure

- `src/GymCrm.Api` — HTTP, authentication, middleware and health endpoints.
- `src/GymCrm.Application` — use cases and public contracts.
- `src/GymCrm.Domain` — domain entities and rules without HTTP or persistence dependencies.
- `src/GymCrm.Infrastructure` — EF Core, PostgreSQL and external integrations.
- `tests/GymCrm.Tests` — domain, API, persistence and regression tests.

Repository-specific implementation rules live in [`AGENTS.md`](AGENTS.md).

## Local run

The API expects PostgreSQL on `localhost:5432` by default. From the repository
root:

```bash
ASPNETCORE_ENVIRONMENT=Development \
ASPNETCORE_URLS=http://localhost:8080 \
dotnet run --no-launch-profile --project backend/src/GymCrm.Api/GymCrm.Api.csproj
```

For the complete stack use `deploy/docker-compose.yml` as described in the
root [`README.md`](../README.md).

## Quality checks

Run from the repository root:

```bash
dotnet restore backend/GymCrm.slnx
dotnet format backend/GymCrm.slnx --no-restore --verify-no-changes
dotnet build backend/GymCrm.slnx --no-restore -warnaserror
dotnet test backend/GymCrm.slnx --no-build
dotnet list backend/GymCrm.slnx package --vulnerable --include-transitive
```

The shared settings in `Directory.Build.props` enable nullable reference types,
.NET analyzers, warnings-as-errors and NuGet audit for all backend projects.

## Migrations

Restore the local EF tool, then use the API project as startup project:

```bash
cd backend
dotnet tool restore
dotnet dotnet-ef migrations list \
  --project src/GymCrm.Infrastructure/GymCrm.Infrastructure.csproj \
  --startup-project src/GymCrm.Api/GymCrm.Api.csproj
```

Follow the migration policy in [`AGENTS.md`](AGENTS.md) before creating or
changing migrations.

## Runtime configuration

Configuration is supplied through environment variables and ASP.NET Core
configuration. Do not commit secrets. The supported Compose baseline is
documented in [`deploy/.env.example`](../deploy/.env.example), and server
deployment is documented in [`deploy/SERVER_INSTALL.md`](../deploy/SERVER_INSTALL.md).
