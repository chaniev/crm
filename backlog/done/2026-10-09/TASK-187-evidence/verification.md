# TASK-187: implementation and rendered evidence

Дата проверки: 08.10.2026 (MSK). Исполнитель: Codex.
Исходная база: `3c99783f2a913f12a0bb1a608bae26e4a375424d` (`origin/main`).
[План](../TASK-187-administrator-coach-creation-scope.plan.md)
прошёл executable readiness preflight до изменений кода.

## Реализованные границы

- Центральная policy разрешает Administrator только Coach: глобальные list/get,
  create и Coach → Coach update; session получает Users, ManageUsers и `[Coach]`.
- Admission мутаций учитывает family endpoint до target lookup и проверки
  полей. Другие staff roles, собственная административная карточка и attendance
  grants остаются закрыты. Отказы не пишут аудит и не меняют аккаунт.
- Backend options/actions управляют frontend; отсутствующий allowedActions
  не разрешает submit, прямой create требует backend option Coach. Типы DTO,
  API mapping и facade совместимы и не требуют изменения формы контракта.
- История назначений, ограничения branch scope, неизменность логина,
  case-insensitive uniqueness, обязательный audit и cookie versioning сохранены.

## Regression evidence

- До изменения policy: 6 ожидаемых падений из 26 targeted tests
  (`UserRoleAuthorizationPolicyTests`, `AuthorizationFlowTests`,
  `Staff_manager_can_create_and_update_coach`): прежний staff 403 и пустая option.
- До frontend fix: missing allowedActions разрешал кнопку сохранения;
  3 direct-create cases без Coach option ошибочно открывали форму.
- Targeted Administrator/relational suite: 17 passed, включая PostgreSQL
  concurrent create, SQLite mandatory audit rollback и реальные HTTP cookies.
- Первый полный canonical baseline: 589 backend tests, 690 frontend tests;
  formatting, Release build, frontend checks/build и dependency audits passed.
- Desktop users + administrator-role-flow после синхронизации старых fixtures
  с backend-owned actions: 13 passed. Group schedule + group registry: 29 passed.
- Target iPhone matrix: 88 passed на `iphone-air-webkit` и
  `iphone-17-pro-max-webkit`, включая новый общий Administrator flow с retry,
  field error, create/edit, фильтром отключённых и restricted Coach.
- Итоговый чистый candidate проверен полным verification contract 09.10.2026;
  HEAD/tree и все результаты сохранены в [final-harness.json](final-harness.json).

## Исправления, обнаруженные runtime-проверкой

1. В карточке группы и assignment preview использовались разные формулы revision.
   Реальный frontend передавал GET revision и получал ложный 409. Сохранена
   существующая формула preview/execute (group ID и упорядоченные назначения),
   GET использует тот же helper. Новый HTTP regression сначала упал на 409;
   после исправления 10 targeted group/token/PostgreSQL concurrency tests passed.
   Алгоритм назначений, revision check и confirmation token не ослаблены.
2. В существующем settings dialog нижняя навигация перекрывала «Сохранить».
   Локальный zIndex `300` использует существующий уровень временных поверхностей
   и оставляет селекты доступными. Обязательный browser role-flow теперь
   завершает создание без force-click. Композиция и поля не менялись.

## UX и визуальная проверка

Контракт — существующие trainer-only list/create/edit TASK-105, зафиксированные
в плане. Новое направление дизайна не выбиралось. До frontend production edits
сняты формы и список с разрешёнными backend facts; после реализации тот же
сценарий выполнен для Administrator. Сравнение: 390×844, 420×912, 440×956 и
1440×1200. Формы create/edit при одинаковых данных совпали побайтно на всех
четырёх ширинах. Разница list PNG ограничена фазой анимации refresh; иерархия,
toolbar, строки, отступы и навигация сохранены.

Сохранённые примеры:

- [Список до](before/list-390.png) / [после](after/list-390.png).
- [Создание до](before/create-390.png) / [после](after/create-390.png).
- [Редактирование до](before/edit-390.png) / [после](after/edit-390.png).
- [Desktop до](before/edit-1440.png) / [после](after/edit-1440.png).
- [Диалог с перекрытием](before/administrator-form.png) / [исправленный](after/administrator-form.png).

| Критерий | Оценка | Наблюдаемое evidence |
|---|---:|---|
| Иерархия задачи | 4/5 | Один create в toolbar, один submit в форме |
| Читаемость списка | 4/5 | Имя и логин, единая строка перехода в карточку |
| Плотность | 4/5 | Controls и длинное имя помещаются на 390px |
| Типографика | 4/5 | Onest и существующие размеры сохранены |
| Отступы | 4/5 | Совпадение before/after формы и единая сетка |
| Визуальный язык | 4/5 | Существующие Mantine surfaces, цвета и кнопки |
| Обратная связь | 4/5 | Field error, retry, сохранение фильтра, restricted state |
| Responsive | 4/5 | Desktop, iPhone WebKit, compact-height и overflow assertions |

Слабейшая оставшаяся часть evidence — взаимодействие с настоящей iOS-клавиатурой
и динамическим viewport Safari. Физические iPhone, iOS Simulator, browser chrome,
software keyboard, реальные safe-area/островок/home indicator и one-handed reach
не проверялись; эмуляция WebKit не выдаётся за проверку устройств.

## Реальный runtime

Изолированный Compose project `crm-task-187`, backend `8187`, frontend `3287`.
`administrator-coaches-runtime.spec.ts` прошёл без route mocks: два филиала,
два администратора, создание Coach через навигацию, reload, глобальное
изменение имени/активности, чтение и включение второй сессией, создание группы
через UI preview/execute, изменение периода назначения через UI, чужой groupId
и assignment preview возвращают branch scope 403, административный transport
остаётся 403. CRUD снимки настоящего runtime сохранены рядом.

Первый Docker build прервался на внешней загрузке Ubuntu package index;
повторная сборка исходного Dockerfile завершилась успешно. Production-файлы
сборки и deployment-конфигурация не менялись. Task bot выключен.

## Итоговая интеграция 09.10.2026

Candidate `3074f71a9d8c4d487dd56c5573ed4ed9f90207f2`, tree `e278da488180bdce3a3b8b71503dd7a79201df71`.
Команда: `python3 scripts/harness/verify_change.py --base origin/main --task-id TASK-187 --report .artifacts/verification/TASK-187.json`.
Все 24 автоматические проверки passed; manual comparison confirmed.
589 backend, 690 frontend, 42 desktop и 88 target-iPhone browser tests passed.
[Чистый managed runtime](final-runtime.json): исходные Dockerfile собраны,
health ready, сценарий двух администраторов/филиалов с PostgreSQL passed;
созданный harness stack остановлен без удаления volumes.

В первом итоговом прогоне два iPhone Air теста завершились timeout: direct audit
уже показывал restricted screen на сохранённом снимке, сохранение Coach оставляло
уведомление поверх фильтра. Direct audit повторно прошёл без правок. Сценарий
Coach теперь явно закрывает подтверждение сохранения перед фильтром;
повторные проверки на обоих WebKit profiles и полный contract прошли.
Production-код из-за этих timeout не менялся.

Локальный fast-forward main выполнен на этот SHA; Git tree совпал. Последующее
закрытие карточки меняет только backlog/requirements и проверяется knowledge
harness отдельно. Backend/frontend/deploy остаются побайтно тем же проверенным
кодом. Исторические пути в JSON-отчётах отражают расположение на момент запуска.
