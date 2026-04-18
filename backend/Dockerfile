FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY . .

RUN dotnet restore src/GymCrm.Api/GymCrm.Api.csproj
RUN dotnet publish src/GymCrm.Api/GymCrm.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/publish .

RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --create-home --shell /bin/bash app \
    && mkdir -p /app/uploads \
    && chown -R app:app /app

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ClientPhoto__StorageRootPath=/app/uploads/client-photos
ENV ClientPhoto__MaxUploadSizeBytes=10485760

USER app
ENTRYPOINT ["dotnet", "GymCrm.Api.dll"]
