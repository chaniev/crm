FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY *.slnx ./
COPY src/GymCrm.Api/GymCrm.Api.csproj src/GymCrm.Api/
COPY src/GymCrm.Application/GymCrm.Application.csproj src/GymCrm.Application/
COPY src/GymCrm.Infrastructure/GymCrm.Infrastructure.csproj src/GymCrm.Infrastructure/
COPY src/GymCrm.Domain/GymCrm.Domain.csproj src/GymCrm.Domain/
RUN dotnet restore src/GymCrm.Api/GymCrm.Api.csproj

COPY . .
RUN dotnet publish src/GymCrm.Api/GymCrm.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/publish .

RUN if ! getent group app > /dev/null; then groupadd --gid 10001 app; fi \
    && if ! id -u app > /dev/null 2>&1; then useradd --uid 10001 --gid app --system --home-dir /app --shell /usr/sbin/nologin app; fi \
    && mkdir -p /app/data/client-photos /app/logs \
    && chown -R app:app /app

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ClientPhoto__StorageRootPath=/app/data/client-photos
ENV ClientPhoto__MaxUploadSizeBytes=10485760

USER app
ENTRYPOINT ["dotnet", "GymCrm.Api.dll"]
