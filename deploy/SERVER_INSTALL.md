# Установка на сервер из готовых Docker-образов

Этот сценарий нужен для чистой выкладки на сервер: на сервер передаются готовые Docker-образы, image-only compose-файл и `.env`. Исходники приложения на сервере не нужны.

## 1. Собрать образы на build-машине

Команды выполняются из корня репозитория.

```bash
IMAGE_TAG=2026-05-15 ./deploy/build-images.sh
IMAGE_TAG=2026-05-15 ./deploy/export-images.sh
```

Если сервер работает на `linux/amd64`, а build-машина на другой архитектуре, задайте платформу явно:

```bash
IMAGE_PLATFORM=linux/amd64 IMAGE_TAG=2026-05-15 ./deploy/build-images.sh
IMAGE_PLATFORM=linux/amd64 IMAGE_TAG=2026-05-15 ./deploy/export-images.sh
```

Результат появится в `deploy/dist/`:

- `gym-crm-images-2026-05-15.tar` - архив с образами `postgres`, `backend`, `frontend`, `bot`;
- `gym-crm-images-2026-05-15.env` - точные image-переменные для серверного `.env`;
- `gym-crm-images-2026-05-15.tar.sha256` - checksum архива.

Если образы нужно тегировать под registry, задайте префикс:

```bash
IMAGE_PREFIX=registry.example.com/gym-crm IMAGE_TAG=2026-05-15 ./deploy/build-images.sh
```

После этого можно либо экспортировать tar-архив тем же `IMAGE_PREFIX`, либо выполнить `docker push` для `backend`, `frontend` и `bot` из сгенерированного `.env`.

## 2. Передать файлы на сервер

Минимальный набор:

- `deploy/docker-compose.server.yml`;
- `deploy/load-images.sh`;
- `deploy/.env.example`;
- `deploy/dist/gym-crm-images-2026-05-15.tar`;
- `deploy/dist/gym-crm-images-2026-05-15.env`;
- `deploy/dist/gym-crm-images-2026-05-15.tar.sha256`.

Рекомендуемая директория на сервере:

```bash
/opt/gym-crm/
  .env
  deploy/
    docker-compose.server.yml
    load-images.sh
    .env.example
  images/
    gym-crm-images-2026-05-15.tar
    gym-crm-images-2026-05-15.env
    gym-crm-images-2026-05-15.tar.sha256
```

## 3. Подготовить `.env` на сервере

```bash
cd /opt/gym-crm
cp deploy/.env.example .env
cat images/gym-crm-images-2026-05-15.env >> .env
```

Обязательно замените значения:

- `POSTGRES_PASSWORD`;
- `BOT_TELEGRAM_TOKEN`, если бот включен;
- `CRM_BOT_API_TOKEN` и `BOT_INTERNAL_API_TOKEN` - одно и то же значение service token;
- `BACKEND_AUTH_COOKIE_SECURE_POLICY=Always` для HTTPS-деплоя.

PostgreSQL наружу не публикуется. Данные приложения хранятся в named volumes из compose-файла.

## 4. Загрузить образы и запустить стек

```bash
cd /opt/gym-crm
(cd images && sha256sum -c gym-crm-images-2026-05-15.tar.sha256)
./deploy/load-images.sh images/gym-crm-images-2026-05-15.tar
docker compose --project-directory . --env-file .env -f deploy/docker-compose.server.yml config --quiet
docker compose --project-directory . --env-file .env -f deploy/docker-compose.server.yml up -d
```

Если `load-images.sh` не передавался на сервер, можно выполнить напрямую:

```bash
docker load -i images/gym-crm-images-2026-05-15.tar
```

## 5. Проверить запуск

```bash
docker compose --project-directory . --env-file .env -f deploy/docker-compose.server.yml ps
curl -fsS http://localhost:8080/health/ready
curl -fsS http://localhost:3000/healthz
curl -fsS http://localhost:3000/api/health/ready
```

При первом старте backend применяет миграции и создаёт bootstrap `HeadCoach`, если база пустая. Стартовый логин по умолчанию: `headcoach`, пароль: `12345678`; после первого входа система попросит сменить пароль.

## Остановка и обновление

Остановить без удаления данных:

```bash
docker compose --project-directory . --env-file .env -f deploy/docker-compose.server.yml down
```

Удаление с данными:

```bash
docker compose --project-directory . --env-file .env -f deploy/docker-compose.server.yml down -v
```

Для обновления загрузите новый архив образов, добавьте новые image-переменные в `.env` вместо старых и выполните `up -d` повторно.
