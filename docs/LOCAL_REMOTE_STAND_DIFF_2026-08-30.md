# Различия локального и удалённого стендов на 2026-08-30

## Область сравнения

- Удалённый стенд: `84.54.59.17`, `/home/user/gym-crm`.
- Фактически запущенная версия до обновления: application images с tag
  `390b21c-20260829-amd64`, baseline commit
  `390b21c0c4ad9f27f1391d615297e58e0aa805b4`.
- Локальная целевая версия: `origin/main`, commit
  `b813da70d9dec1f45a54221ce175f27a71aab58f`.
- Требования релизной операции: `none` — операция переносит уже принятые
  frontend-изменения и не меняет backend-owned CRM rules, API contracts или
  схему данных.

Сравнение выполнено по Git diff, production-коду, активным Docker images,
истории EF migrations, наличию compatibility-таблиц, агрегированным счётчикам
данных и health endpoints. Персональные данные не извлекались.

## Краткий итог

1. Полный Git diff содержит 240 файлов (`+13965/-922`), включая production-код,
   тесты, backlog, screenshots, требования, skills и инженерную документацию.
2. Runtime-изменения относятся только к frontend: 68 файлов под
   `frontend/src` (`+5837/-450`). Backend, bot, Staff/Internal Bot API,
   permissions, domain semantics, Compose wiring и новые EF migrations в этом
   интервале отсутствуют.
3. Основные изменения: единая дизайн-система, более плотная мобильная
   типографика и списки, улучшенные расписание, раздел «Внимание», реестр групп,
   формы, уведомления, доступность и reduced-motion behavior.
4. Новый data migration script не требуется. Существующий
   `deploy/migrations/2026-08-29-retained-membership-transition.sql` уже был
   применён при предыдущем релизе и повторно не запускался.
5. Обновлён только frontend image. Backend, bot, PostgreSQL и все named volumes
   не пересоздавались; `down -v` не выполнялся.

## Функциональные и интерфейсные изменения

### Единая визуальная система

- Введены централизованные шкалы типографики, отступов, радиусов, высот,
  теней и слоёв.
- Унифицированы Mantine-рецепты для кнопок, полей, меню, drawer, modal,
  notification и других общих элементов.
- Добавлены семантические тона состояний и проверяемая контрастная матрица для
  normal, hover, active, focus и disabled states.
- Укреплена схема theme profiles и deterministic fallback для некорректного
  deployment-профиля.
- Добавлен reduced-motion contract для системной настройки уменьшения анимации.

### Мобильная работа

- Заголовки и вертикальные интервалы стали плотнее без уменьшения touch targets.
- Поля ввода и основные элементы управления имеют мобильную высоту не менее
  44 px; текст ввода не вызывает нежелательный zoom в мобильном Safari.
- Drawer на узких экранах открывается снизу.
- В формах создания и редактирования клиентов, групп, тренеров и занятий
  основное действие закреплено с учётом safe area.
- Уведомления показываются сверху по центру и меньше перекрывают рабочую область.

### Расписание

- Строки занятий сгруппированы по времени и занимают меньше вертикального места.
- В строке видны группа, филиал, зал, тренер и нейтральный статус посещаемости.
- Переход к посещаемости сохранён в одно нажатие; редактирование на телефоне
  перенесено в меню дополнительных действий.
- Дата, количество занятий и фильтры стали компактнее; desktop-layout сохранён.

### «Внимание», группы и реестры

- Список «Внимание» стал компактнее, сохранив причины, статусы и контакты,
  полученные от backend.
- В карточках выделено одно основное действие, дополнительные вынесены в меню;
  возврат фокуса больше не вызывает скачок прокрутки.
- В реестре групп убран дублирующий подзаголовок, счётчики перенесены в панель
  управления, строки стали компактнее без горизонтальной прокрутки.
- Реестры тренеров и аудит переведены на более плоские list-row surfaces.

### Надёжность и доступность

- Унифицированы loading, error, empty, disabled и recovery states.
- Улучшены keyboard focus, live-region behavior, контраст и длинные русские
  подписи.
- В production bundle не попадает внутренний design-system catalog.

## Решение по миграции данных

До обновления на сервере подтверждены все 7 ожидаемых EF migrations; последняя:

`20260823173644_AddLessonOccurrenceTrainerSubstitutions`.

Также подтверждено наличие compatibility-таблиц membership/attendance transition.
Между baseline и target отсутствуют изменения backend model, migration files и
database contract. Поэтому:

- новый SQL/data migration script не создавался;
- старый compatibility script повторно не запускался;
- backend не перезапускался и startup migrations не выполнялись;
- история migrations после обновления осталась неизменной.

## Сохранность данных

Перед переключением создан backup:

`/home/user/gym-crm/backups/pre-update-20260830-1625`.

Он содержит PostgreSQL custom dump с проверенным restore-list, исходные `.env`
и server Compose, список активных images, архив client photos и архив bot data.

| Сущность | До | После |
|---|---:|---:|
| Пользователи | 13 | 13 |
| Филиалы | 1 | 1 |
| Залы | 5 | 5 |
| Типы групп | 5 | 5 |
| Группы | 14 | 14 |
| Клиенты | 4 | 4 |
| Абонементы | 1 | 1 |
| Посещения | 1 | 1 |
| Записи аудита | 79 | 79 |

Прикладные данные не удалялись и не изменялись релизной операцией.

## Сборка и обновление стенда

- Чистый isolated checkout: branch `main`, commit `b813da7`.
- Frontend validation: locked install, dependency audit без уязвимостей, lint,
  typecheck, raw-color и raw-spacing checks, 647/647 unit tests, production build.
- Собран image `gym-crm/frontend:b813da7-20260830-amd64` для `linux/amd64`.
- Release archive: 22 MiB, SHA-256
  `2fc9c028f017a3c8c35c331aec8c637267c0f37e42b9365bd19b93015b600f01`.
- Архив сохранён на сервере в
  `/home/user/gym-crm/releases/b813da7-20260830-amd64` и проверен после передачи.
- Обновлён только service `frontend` через `up -d --no-deps frontend`.
- Предыдущий frontend tag сохранён как rollback point:
  `gym-crm/frontend:390b21c-20260829-amd64`.

## Результат проверки после обновления

- Frontend image ID: `05991ba44426`, architecture `amd64`.
- Backend и bot остались на tag `390b21c-20260829-amd64`.
- Backend, frontend, bot и PostgreSQL: `healthy`, restart count `0`.
- Внутренние и внешние `/healthz` и `/api/health/ready`: успешно.
- История БД: 7 migrations, latest
  `20260823173644_AddLessonOccurrenceTrainerSubstitutions`.
- Агрегированные счётчики данных до и после совпадают.

