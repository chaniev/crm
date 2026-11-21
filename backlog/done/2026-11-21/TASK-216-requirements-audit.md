# TASK-216: Сверка требований CRM с локальной main

## Status
done

## Goal
Сверить все 60 принятых требований, привязать принятые макеты и отделить подтверждённые расхождения от непроверенных условий.

## Основание и метод
Запрос владельца от 21.11.2026. Основная сверка выполнена по main `3e72913096c861fb72468f4e1de04fd264c04099`. Проверены точки входа, модели и существующие тесты. Ссылки в таблице обозначают прочитанные свидетельства. Новые прогоны указаны ниже. До завершения проверки в main вошла TASK-021. Итоговая база — `22fdcd3dd98b4333954e55c57049cfaf2316dde5`. Из исполняемых файлов изменились CSS действий карточки и их браузерные проверки. Результат учтён для REQ-CLI-001 и REQ-NFR-001. [Приёмка TASK-021](TASK-021-evidence/acceptance.md).

## Решения владельца от 21.11.2026

- Замещающему тренеру доступна «вся группа и её клиенты на период замещения».
- Для списка бота «включать день +10, как в требовании».
- Для двух истекающих абонементов во «Внимании» — «одна строка клиента со всеми причинами».
- Клиенты с истёкшими абонементами показываются раньше клиентов только с серией пропусков.
- В справочнике типы групп сортируются «по названию, как в текущем справочнике». Стабильный ID используется для адресации.
- Продление первого абонемента, заканчивающегося 10 декабря, начинается 11 декабря, даже если у клиента есть абонемент для другой группы до 20 декабря.

## Сверка по карточкам

| Требование | Результат и граница проверки | Код, тест или приёмка |
|---|---|---|
| REQ-CLI-001 | Профиль, ввод Telegram, пять вкладок, сохранение групп и возврат к источнику. Ширины и роли проверены при приёмке TASK-019 и TASK-021. | [client-profile-context-navigation.spec](../../../frontend/e2e/client-profile-context-navigation.spec.ts), [TASK-019](TASK-019-evidence/acceptance.md) |
| REQ-CLI-002 | Архив и восстановление входят в сценарий жизненного цикла клиента для управляющих ролей. | [ClientsApiTests](../../../backend/tests/GymCrm.Tests/ClientsApiTests.cs) |
| REQ-CLI-003 | До двух контактов передаются и валидируются с профилем. Добавление контакта при создании проверено в Chromium. | [ClientsApiTests](../../../backend/tests/GymCrm.Tests/ClientsApiTests.cs), [client-profile-context-navigation.spec](../../../frontend/e2e/client-profile-context-navigation.spec.ts) |
| REQ-CLI-004 | Загрузка, замена, HEIC/HEIF, размер и филиальный охват проверяются API. Замещение занятия не открывает фотографии всей группы. | [ClientPhotoService](../../../backend/src/GymCrm.Infrastructure/Clients/ClientPhotoService.cs), [AdministratorClientScopeApiTests](../../../backend/tests/GymCrm.Tests/AdministratorClientScopeApiTests.cs), [GroupTrainerSubstitutionAccessMatrixTests](../../../backend/tests/GymCrm.Tests/GroupTrainerSubstitutionAccessMatrixTests.cs) |
| REQ-CLI-005 | Нормализация, отсутствие повторной записи при неизменной заметке, время и автор принадлежат backend. | [ClientNotesMetadataPolicyTests](../../../backend/tests/GymCrm.Tests/ClientNotesMetadataPolicyTests.cs), [ClientsApiTests](../../../backend/tests/GymCrm.Tests/ClientsApiTests.cs) |
| REQ-CLI-006 | Дата проходит создание, изменение и очистку. Возраст в карточке вычисляется относительно businessDate. | [ClientsApiTests](../../../backend/tests/GymCrm.Tests/ClientsApiTests.cs), [clientBirthDate.test](../../../frontend/src/features/clients/clientBirthDate.test.ts) |
| REQ-CLI-007 | Раздельные операции профиля, назначений и перевода. Повтор после выхода из филиального охвата и конфликт целей покрыты тестами. | [AdministratorClientScopePostgreSqlTests](../../../backend/tests/GymCrm.Tests/AdministratorClientScopePostgreSqlTests.cs), [ClientMembershipTargetPostgreSqlBarrierTests](../../../backend/tests/GymCrm.Tests/ClientMembershipTargetPostgreSqlBarrierTests.cs) |
| REQ-CLI-008 | Параметры формы доходят до фильтров API. Поиск многословного ФИО, ограничения телефона и филиала проверены на PostgreSQL. | [clientListFilters](../../../frontend/src/features/clients/list/clientListFilters.ts), [ClientQueryEndpoints](../../../backend/src/GymCrm.Api/Auth/ClientQueryEndpoints.cs), [ClientFullNameSearchPostgreSqlTests](../../../backend/tests/GymCrm.Tests/ClientFullNameSearchPostgreSqlTests.cs) |
| REQ-CLI-009 | Карточка тренера ограничивает поля. Доступ ко всем клиентам группы по временному замещению отсутствует. | [GroupTrainerSubstitutionAccessMatrixTests](../../../backend/tests/GymCrm.Tests/GroupTrainerSubstitutionAccessMatrixTests.cs), [InternalBotApiTests](../../../backend/tests/GymCrm.Tests/InternalBotApiTests.cs) |
| REQ-CLI-010 | Вкладка импорта, ролевой выбор филиала, подстановка телефона, перенос полей, валидация всего файла и атомарность записи. | [ClientImportMappingTests](../../../backend/tests/GymCrm.Tests/ClientImportMappingTests.cs), [ClientImportPostgreSqlTests](../../../backend/tests/GymCrm.Tests/ClientImportPostgreSqlTests.cs), [settings-client-import.spec](../../../frontend/e2e/settings-client-import.spec.ts) |
| REQ-GRP-001 | Идентификация группы и зал проверяются при создании. Из карточки открывается редактор расписания с возвратом к группе. | [GroupsApiTests](../../../backend/tests/GymCrm.Tests/GroupsApiTests.cs), [group-schedule-workflow.spec](../../../frontend/e2e/group-schedule-workflow.spec.ts) |
| REQ-GRP-002 | Назначения нескольких тренеров и клиентов, окончание периода включительно, блокировка архивации целевым абонементом. | [GroupsApiTests](../../../backend/tests/GymCrm.Tests/GroupsApiTests.cs), [EffectiveGroupAssignmentServiceTests](../../../backend/tests/GymCrm.Tests/EffectiveGroupAssignmentServiceTests.cs), [AdministratorClientScopeApiTests](../../../backend/tests/GymCrm.Tests/AdministratorClientScopeApiTests.cs) |
| REQ-GRP-003 | Время задаётся для каждого выбранного дня. При ошибке субботнего времени форма сохраняет ввод и допускает повтор. | [GroupsApiTests](../../../backend/tests/GymCrm.Tests/GroupsApiTests.cs), [group-schedule-workflow.spec](../../../frontend/e2e/group-schedule-workflow.spec.ts) |
| REQ-GRP-004 | Серии, разовые занятия, конфликт при отмене с отметками, восстановление и конкурентные изменения проверяются по идентификатору занятия. | [ScheduleLessonsApiTests](../../../backend/tests/GymCrm.Tests/ScheduleLessonsApiTests.cs), [GroupSchedulePostgreSqlConcurrencyTests](../../../backend/tests/GymCrm.Tests/GroupSchedulePostgreSqlConcurrencyTests.cs) |
| REQ-GRP-005 | Режимы, календарь, фильтры и операции по правам работают. Временный доступ тренера ограничен конкретным занятием. | [ScheduleLessonsApiTests](../../../backend/tests/GymCrm.Tests/ScheduleLessonsApiTests.cs), [group-schedule.spec](../../../frontend/e2e/group-schedule.spec.ts) |
| REQ-GRP-006 | Есть назначение и отмена замены на занятии. Нет группового доступа на весь период. Проверены старые маршруты и новый календарь. | [GroupTrainerSubstitutionsApiTests](../../../backend/tests/GymCrm.Tests/GroupTrainerSubstitutionsApiTests.cs), [ScheduleLessonTrainerSubstitutionEndpoints](../../../backend/src/GymCrm.Api/Auth/ScheduleLessonTrainerSubstitutionEndpoints.cs), [ScheduleLessonsApiTests](../../../backend/tests/GymCrm.Tests/ScheduleLessonsApiTests.cs) |
| REQ-GRP-007 | Идентичность занятия, интервал, действия, дата и возврат в расписание проверяются браузерными сценариями. | [group-schedule.spec](../../../frontend/e2e/group-schedule.spec.ts), [iphone-target-devices.spec](../../../frontend/e2e/iphone-target-devices.spec.ts) |
| REQ-GRP-008 | Одно создание, валидация без потери данных, уход с черновиком и восстановление после неподтверждённого результата. | [group-schedule-workflow.spec](../../../frontend/e2e/group-schedule-workflow.spec.ts), [README](../2026-11-19/TASK-203-evidence/README.md) |
| REQ-SUB-001 | Доступные варианты филиала, неизменная цена и глобальный Professional подтверждены доменом и API каталога. | [MembershipCatalogDomainTests](../../../backend/tests/GymCrm.Tests/MembershipCatalogDomainTests.cs), [BranchesApiTests](../../../backend/tests/GymCrm.Tests/BranchesApiTests.cs) |
| REQ-SUB-002 | Три режима суммы и отдельные продажи подтверждены. Продление адресует выбранную продажу, но берёт максимальное окончание по клиенту. См. [расчёт дат](../../../backend/src/GymCrm.Infrastructure/Clients/ClientMembershipSaleLifecycleService.cs). | [ClientMembershipCreationPricingApiTests](../../../backend/tests/GymCrm.Tests/ClientMembershipCreationPricingApiTests.cs), [ClientMembershipWriteRegressionApiTests](../../../backend/tests/GymCrm.Tests/ClientMembershipWriteRegressionApiTests.cs) |
| REQ-SUB-003 | Оплата принадлежит продаже. Дата обязательна, будущая отклоняется. Отдельные операции оплаты выведены из обращения. | [ClientMembershipPaymentReadSemanticsTests](../../../backend/tests/GymCrm.Tests/ClientMembershipPaymentReadSemanticsTests.cs), [ClientMembershipWriteRegressionApiTests](../../../backend/tests/GymCrm.Tests/ClientMembershipWriteRegressionApiTests.cs) |
| REQ-SUB-004 | Суммы, даты возвратов и отмена проверяются отдельно от исправлений продажи. | [ClientMembershipRefundService](../../../backend/src/GymCrm.Infrastructure/Clients/ClientMembershipRefundService.cs), [FinancialReportsApiTests](../../../backend/tests/GymCrm.Tests/FinancialReportsApiTests.cs), [ClientsApiTests](../../../backend/tests/GymCrm.Tests/ClientsApiTests.cs) |
| REQ-SUB-005 | Term имеет индивидуальный период. Проверены ручные даты, сохранение длительности при продлении и расчёт месячного окончания. Отдельный сценарий автоматического годового расчёта через форму не подтверждён. | [ClientMembershipSemantics](../../../backend/src/GymCrm.Application/Clients/ClientMembershipSemantics.cs), [ClientMembershipCreationPricingApiTests](../../../backend/tests/GymCrm.Tests/ClientMembershipCreationPricingApiTests.cs) |
| REQ-SUB-006 | Непересекающиеся цели, конфликт общей группы, глобальное исключение Professional и восстановление SingleVisit. | [ClientMembershipTargetPolicyTests](../../../backend/tests/GymCrm.Tests/ClientMembershipTargetPolicyTests.cs), [ClientMembershipTargetPostgreSqlBarrierTests](../../../backend/tests/GymCrm.Tests/ClientMembershipTargetPostgreSqlBarrierTests.cs), [AttendanceApiTests](../../../backend/tests/GymCrm.Tests/AttendanceApiTests.cs) |
| REQ-SUB-007 | Профессиональный вариант один на клуб, с нулевой ценой. Назначение имеет комментарий и индивидуальный период. Проверены привилегии на занятии. | [MembershipCatalogDomainTests](../../../backend/tests/GymCrm.Tests/MembershipCatalogDomainTests.cs), [ClientMembershipMutationRules](../../../backend/src/GymCrm.Infrastructure/Clients/ClientMembershipMutationRules.cs), [AttendanceApiTests](../../../backend/tests/GymCrm.Tests/AttendanceApiTests.cs) |
| REQ-SUB-008 | Предупреждение не блокирует отметку. Списание и возврат привязаны к конкретной разовой продаже. | [AttendanceApiTests](../../../backend/tests/GymCrm.Tests/AttendanceApiTests.cs), [ClientMembershipVisitService](../../../backend/src/GymCrm.Infrastructure/Clients/ClientMembershipVisitService.cs) |
| REQ-SUB-009 | Комментарий адресует продажу, хранит автора и время, неизменный текст сохраняет метаданные. | [ClientMembershipCommentPolicyTests](../../../backend/tests/GymCrm.Tests/ClientMembershipCommentPolicyTests.cs), [ClientMembershipWriteRegressionApiTests](../../../backend/tests/GymCrm.Tests/ClientMembershipWriteRegressionApiTests.cs) |
| REQ-SUB-010 | Период определяется датой оплаты, историческая атрибуция — датой покупки. Возврат учитывается по своей дате. Проверены разбивки и предупреждение. | [FinancialReportsApiTests](../../../backend/tests/GymCrm.Tests/FinancialReportsApiTests.cs), [finance-reports.spec](../../../frontend/e2e/finance-reports.spec.ts) |
| REQ-SUB-011 | Одна открытая версия на SaleId обеспечена фильтрованным уникальным индексом. Проверены исправление и адресное продление. | [ClientMembershipConfiguration](../../../backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientMembershipConfiguration.cs), [ClientMembershipWriteRegressionApiTests](../../../backend/tests/GymCrm.Tests/ClientMembershipWriteRegressionApiTests.cs) |
| REQ-ATT-001 | При смешанном составе занятия переключатель недоступен. В старом сценарии выбора группы есть оба режима. | [AttendanceScreen](../../../frontend/src/features/attendance/AttendanceScreen.tsx), [attendance.spec](../../../frontend/e2e/attendance.spec.ts), [attendance-today-worklist.spec](../../../frontend/e2e/attendance-today-worklist.spec.ts) |
| REQ-ATT-002 | Связь с материализованным занятием сохранена. История клиента, порядок серии пропусков и отметка «Связались» читают время группы. | [ClientResponseMapper](../../../backend/src/GymCrm.Api/Auth/ClientResponseMapper.cs), [ClientAttentionEndpoints](../../../backend/src/GymCrm.Api/Auth/ClientAttentionEndpoints.cs), [Attendance](../../../backend/src/GymCrm.Domain/Attendance/Attendance.cs) |
| REQ-ATT-003 | Есть явные разрешения администраторов и ограничения по дате для всех ролей. Периодное замещение не предоставляет весь групповой охват. | [AttendanceDatePolicyTests](../../../backend/tests/GymCrm.Tests/AttendanceDatePolicyTests.cs), [AdministratorAttendanceGrantApiTests](../../../backend/tests/GymCrm.Tests/AdministratorAttendanceGrantApiTests.cs), [GroupTrainerSubstitutionAccessMatrixTests](../../../backend/tests/GymCrm.Tests/GroupTrainerSubstitutionAccessMatrixTests.cs) |
| REQ-ATT-004 | Состояния Scheduled и Cancelled, конфликт отмены с отметками, раздельный аудит отмены и отметок. | [ScheduleLessonsApiTests](../../../backend/tests/GymCrm.Tests/ScheduleLessonsApiTests.cs), [AttendanceApiTests](../../../backend/tests/GymCrm.Tests/AttendanceApiTests.cs) |
| REQ-ATT-005 | В отметке хранятся клиент, занятие, автор, дата и действие. Ролевая история и частичная загрузка проверяются в карточке. | [Attendance](../../../backend/src/GymCrm.Domain/Attendance/Attendance.cs), [ClientResponseMapper](../../../backend/src/GymCrm.Api/Auth/ClientResponseMapper.cs), [ClientsApiTests](../../../backend/tests/GymCrm.Tests/ClientsApiTests.cs) |
| REQ-ATT-006 | Список сегодня и возврат к исходной строке проверены в Chromium. Счётчик и разрешения приходят с backend. | [attendance-today-worklist.spec](../../../frontend/e2e/attendance-today-worklist.spec.ts), [AttendanceTodayLessonsResponse](../../../backend/src/GymCrm.Api/Auth/AttendanceTodayLessonsResponse.cs) |
| REQ-USR-001 | Матрица ролей, импорт, доступ к филиалам, управление тренерами и групповые разрешения проверяются независимо. Влияние всех комбинаций смены роли на действующие сессии в этой сверке не воспроизводилось. | [UserRoleAuthorizationPolicy](../../../backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs), [UsersApiTests.AdministratorCoaches](../../../backend/tests/GymCrm.Tests/UsersApiTests.AdministratorCoaches.cs), [AdministratorAttendanceGrantApiTests](../../../backend/tests/GymCrm.Tests/AdministratorAttendanceGrantApiTests.cs) |
| REQ-USR-002 | API проверяет уникальность логина и Telegram ID, неизменность логина, управление тренером вне филиала администратора. Филиал в диалоге и строке принят в TASK-206. Полный ручной проход всех полей и ролей не повторялся. | [UsersApiTests](../../../backend/tests/GymCrm.Tests/UsersApiTests.cs), [CaseInsensitiveLoginPostgreSqlTests](../../../backend/tests/GymCrm.Tests/CaseInsensitiveLoginPostgreSqlTests.cs), [TASK-206](TASK-206-evidence/acceptance.md) |
| REQ-USR-003 | Bootstrap, обязательная смена, повторный запуск и канонический регистр логина проверены. Вход и изменение пароля используют cookie и CSRF. | [BootstrapUserStartupExtensions](../../../backend/src/GymCrm.Api/Startup/BootstrapUserStartupExtensions.cs), [StartupLoggingSmokeTests](../../../backend/tests/GymCrm.Tests/StartupLoggingSmokeTests.cs), [AuthFlowTests](../../../backend/tests/GymCrm.Tests/AuthFlowTests.cs) |
| REQ-USR-004 | Создание и поиск Coach без групп и в чужом филиале, фильтры и сохранение доступа после изменений. | [UsersApiTests.AdministratorCoaches](../../../backend/tests/GymCrm.Tests/UsersApiTests.AdministratorCoaches.cs), [administrator-coaches-runtime.spec](../../../frontend/e2e/administrator-coaches-runtime.spec.ts), [users.spec](../../../frontend/e2e/users.spec.ts) |
| REQ-AUD-001 | Чтение и варианты фильтров ограничены двумя ролями. Проверены отказ действующей сессии и атомарность записи аудита при изменениях. | [AuditLogApiTests](../../../backend/tests/GymCrm.Tests/AuditLogApiTests.cs), [MutationAuditAtomicityPostgreSqlTests](../../../backend/tests/GymCrm.Tests/MutationAuditAtomicityPostgreSqlTests.cs), [audit-access-scenarios](../../../frontend/e2e/audit-access-scenarios.ts) |
| REQ-AUD-002 | В строке видны время, описание и автор, в деталях — значения. В Chromium проверены фильтр, страница и восстановление. | [AuditLogScreen](../../../frontend/src/features/audit/AuditLogScreen.tsx), [stage12.spec](../../../frontend/e2e/stage12.spec.ts), [TASK-208](TASK-208-evidence/acceptance.md) |
| REQ-AUD-003 | Отдельный файловый журнал, ротация 20 МБ и очистка по давности 10 дней. Фильтрация чувствительных полей покрыта smoke-тестом. | [TechnicalLoggingOptions](../../../backend/src/GymCrm.Api/Startup/TechnicalLoggingOptions.cs), [TechnicalLoggingStartupExtensions](../../../backend/src/GymCrm.Api/Startup/TechnicalLoggingStartupExtensions.cs), [StartupLoggingSmokeTests](../../../backend/tests/GymCrm.Tests/StartupLoggingSmokeTests.cs) |
| REQ-BOT-001 | Личные чаты, нормализация событий, Telegram-адаптеры и вызов Internal Bot API. База бота хранит состояние обработки. | [factory](../../../bot/src/gym_crm_bot/telegram/factory.py), [middleware](../../../bot/src/gym_crm_bot/telegram/middleware.py), [app](../../../bot/src/gym_crm_bot/app.py) |
| REQ-BOT-002 | Разрешение Telegram ID выполняется на backend. Меню и чтение зависят от текущей роли, активности и обязательной смены пароля. | [InternalBotApiTests](../../../backend/tests/GymCrm.Tests/InternalBotApiTests.cs), [test_bot_service](../../../bot/tests/test_bot_service.py) |
| REQ-BOT-003 | Поиск, посещения и фактическое расписание обслуживаются API. Выборка истекающих исключает день +10. Отдельная отметка оплаты отменена. | [BotApiService](../../../backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs), [InternalBotApiTests](../../../backend/tests/GymCrm.Tests/InternalBotApiTests.cs), [ScheduleLessonsBotApiTests](../../../backend/tests/GymCrm.Tests/ScheduleLessonsBotApiTests.cs), [test_callbacks_and_menu](../../../bot/tests/test_callbacks_and_menu.py) |
| REQ-BOT-004 | Срок состояния, резервирование update, ключ записи посещения, ошибки API и health endpoints прослежены в обработчиках и тестах. | [test_storage](../../../bot/tests/test_storage.py), [test_dialog_state](../../../bot/tests/test_dialog_state.py), [test_attendance_flow](../../../bot/tests/test_attendance_flow.py), [app](../../../bot/src/gym_crm_bot/app.py) |
| REQ-BOT-005 | В точке запуска и меню отсутствуют планировщик и настройка рассылок сотрудникам. Планирование ведётся в TASK-012. | [app](../../../bot/src/gym_crm_bot/app.py), [service](../../../bot/src/gym_crm_bot/core/service.py) |
| REQ-BOT-006 | В сценарии карточки сотрудника нет загрузки или замены фотографии через бот. Web-загрузка существует. Открыта TASK-011. | [client_flow](../../../bot/src/gym_crm_bot/core/client_flow.py), [normalization](../../../bot/src/gym_crm_bot/telegram/normalization.py), [ClientPhotoEndpoints](../../../backend/src/GymCrm.Api/Auth/ClientPhotoEndpoints.cs) |
| REQ-BOT-007 | Private-chat guard и дедупликация есть. Ограничителя частоты для последовательности разных команд в обоих входных адаптерах не найдено. | [middleware](../../../bot/src/gym_crm_bot/telegram/middleware.py), [mtproto_adapter](../../../bot/src/gym_crm_bot/telegram/mtproto_adapter.py), [service](../../../bot/src/gym_crm_bot/core/service.py) |
| REQ-NFR-001 | Подтверждены отдельные ширины, переносы, действия с клавиатуры и возврат фокуса. Общая визуальная и аппаратная приёмка всех экранов не выполнялась. | [iphone-target-devices.spec](../../../frontend/e2e/iphone-target-devices.spec.ts), [touch-target-inventory.spec](../../../frontend/e2e/touch-target-inventory.spec.ts), [reduced-motion.spec](../../../frontend/e2e/reduced-motion.spec.ts) |
| REQ-NFR-002 | Есть пагинация клиентов, групп и истории; Staff API собирает состав занятия целиком. Нагрузочный прогон на целевом объёме не выполнялся. | [ClientQueryEndpoints](../../../backend/src/GymCrm.Api/Auth/ClientQueryEndpoints.cs), [GroupsApiTests](../../../backend/tests/GymCrm.Tests/GroupsApiTests.cs), [AttendanceEndpoints](../../../backend/src/GymCrm.Api/Auth/AttendanceEndpoints.cs) |
| REQ-NFR-003 | Хеширование, cookie, CSRF и серверная проверка ролей подтверждены контрактами. Отдельный аудит безопасности в этот проход не входил. | [AuthFlowTests](../../../backend/tests/GymCrm.Tests/AuthFlowTests.cs), [CsrfProtectionTests](../../../backend/tests/GymCrm.Tests/CsrfProtectionTests.cs), [AuthorizationFlowTests](../../../backend/tests/GymCrm.Tests/AuthorizationFlowTests.cs) |
| REQ-NFR-004 | Версии платформ и образы заданы проектами и Compose. Развёртывание на удалённом стенде не выполнялось. | [docker-compose](../../../deploy/docker-compose.yml), [GymCrm.Api](../../../backend/src/GymCrm.Api/GymCrm.Api.csproj), [package](../../../frontend/package.json), [pyproject](../../../bot/pyproject.toml) |
| REQ-NFR-005 | Публичная конфигурация отдаёт профиль оформления. Полный набор индивидуальных цветов, логотип, favicon и редактирование после деплоя остаются предметом TASK-155/156. | [AppConfigApiTests](../../../backend/tests/GymCrm.Tests/AppConfigApiTests.cs), [SettingsScreen](../../../frontend/src/features/settings/SettingsScreen.tsx) |
| REQ-NFR-006 | Обновление после сохранения проверяется на сценариях групп, списка клиентов, назначений и посещений. Все CRUD-комбинации повторно не воспроизводились. | [stage12.spec](../../../frontend/e2e/stage12.spec.ts), [client-profile-context-navigation.spec](../../../frontend/e2e/client-profile-context-navigation.spec.ts), [attendance-today-worklist.spec](../../../frontend/e2e/attendance-today-worklist.spec.ts) |
| REQ-NFR-007 | Правило ресурсов контролируется сканерами и тестами трёх слоёв. Новая ручная инвентаризация всех текстов не проводилась. | [UserFacingTextScannerTests](../../../backend/tests/GymCrm.Tests/UserFacingTextScannerTests.cs), [test_user_facing_text_scanner](../../../bot/tests/test_user_facing_text_scanner.py), [USER_FACING_TEXT_RESOURCES](../../../docs/USER_FACING_TEXT_RESOURCES.md) |
| REQ-BRN-001 | Проверка ссылки на зал при архивации ограничена основной группой. Слот или разовое занятие могут ссылаться на другой зал. | [BranchEndpoints](../../../backend/src/GymCrm.Api/Auth/BranchEndpoints.cs), [LessonOccurrenceConfiguration](../../../backend/src/GymCrm.Infrastructure/Persistence/Configurations/LessonOccurrenceConfiguration.cs), [LessonScheduleSlotConfiguration](../../../backend/src/GymCrm.Infrastructure/Persistence/Configurations/LessonScheduleSlotConfiguration.cs) |
| REQ-BRN-002 | Общий справочник типов доступен по правам. Список API сортируется по названию. Импорт и действия панели филиалов проверяются раздельно. | [GroupTypeEndpoints](../../../backend/src/GymCrm.Api/Auth/GroupTypeEndpoints.cs), [BranchSettingsActionPolicyTests](../../../backend/tests/GymCrm.Tests/BranchSettingsActionPolicyTests.cs), [SettingsScreen.test](../../../frontend/src/features/settings/SettingsScreen.test.tsx) |
| REQ-ATTN-001 | API и UI различают записи по абонементу. Два абонемента одного клиента дают две строки. Первыми API ставит клиентов с серией пропусков, хотя карточка предписывает приоритет истёкшего абонемента. | [ClientAttentionEndpoints](../../../backend/src/GymCrm.Api/Auth/ClientAttentionEndpoints.cs), [ClientsApiTests](../../../backend/tests/GymCrm.Tests/ClientsApiTests.cs), [AttentionPanel](../../../frontend/src/features/attention/AttentionPanel.tsx) |
| REQ-CHAT-001 | Отдельная привязка Telegram, права и идемпотентность сообщений проверены в API. Вкладка загружает переписку и отмечает прочтение только при открытии. | [ClientMessengerApiTests](../../../backend/tests/GymCrm.Tests/ClientMessengerApiTests.cs), [TASK-019](TASK-019-evidence/acceptance.md) |

## Браузерная проверка
Chromium с тестовыми ответами Staff API, 10 сценариев. Проверены краткая и полная карточки клиента, создание, журнал, расписание группы, два состояния мобильного списка «Внимание», возврат в список занятий и смешанный состав. В последнем сценарии у тренера по прямой ссылке на конкретное занятие при 390 × 844 были два клиента, один с «Был», один с «Не отмечено». Видна строка второго; переключатель «Все» и кнопка «Показать всех» отсутствуют. Сравнение с принятыми размерами, ролями и более широкими сценариями дополнено сохранёнными приёмками задач. Реальный Telegram, физические телефоны и полный нагрузочный профиль в этой проверке не использовались.

## Дополнительная проверка на итоговой базе
На `22fdcd3d` прошли шесть выбранных тестов xUnit. Они проверили исключение дня +10, узкий доступ к замещаемому занятию, раздельные строки «Внимания», пересечения целевых групп, даты финансовой атрибуции и отсутствие статуса неоплаты. Три первых результата воспроизводят расхождения с решениями владельца. Дополнительно прошли четыре сценария Chromium для профиля и «Внимания», а также проверка формы импорта с тестовым сервером на шести размерах окна.

## Согласованные макеты
Семь HTML-макетов открыты в Chromium, ссылки на снимки проверены декодированием изображений. В карточке клиента выполнены переходы на вкладки групп и сообщений. Проверена пересборка автономных HTML для TASK-019, TASK-205 и TASK-208 с исходниками frontend принятых версий.

Комплекты сгруппированы в одноимённых каталогах требований. Источники выбора указаны в описании каждого комплекта. Для групп из TASK-188/189 сохранились выбранные снимки A/A и бриф; временный HTML был удалён при исходном согласовании. Для списка групп TASK-065 решение о двух счётчиках зафиксировано в [плане](../2026-07-15/TASK-065-groups-overview-compact.plan.md), исходное изображение в карточке отмечено как недоступное. В разделах финансов, сотрудников, технических логов и сценариев бота отдельный принятый комплект для всей текущей редакции при сверке не установлен. Общие концепции и снимки работающего интерфейса не использовались как подтверждение выбора владельца.

## Открытые расхождения

- [TASK-217 · Групповой охват замещения](../../risky/TASK-217-substitute-group-period-access.md)
- [TASK-218 · День +10 в списке бота](../../tasks-ready/TASK-218-bot-expiration-window.md)
- [TASK-219 · Переключение смешанного состава](../../tasks-ready/TASK-219-lesson-mixed-roster.md)
- [TASK-220 · Историческое время в истории и «Внимании»](../../risky/TASK-220-attendance-historical-time.md)
- [TASK-221 · Одна строка клиента и приоритет истёкшего абонемента](../../tasks-ready/TASK-221-attention-one-row-per-client.md)
- [TASK-222 · Частота команд бота](../../needs-clarification/TASK-222-bot-command-rate.md)
- [TASK-223 · Архивация и удаление зала со ссылками из расписания](../../risky/TASK-223-hall-schedule-archive-guard.md)
- [TASK-224 · Размер выборки состава](../../needs-clarification/TASK-224-attendance-roster-size.md)
- [TASK-225 · Дата начала адресного продления](../../risky/TASK-225-renewal-selected-membership-end.md)

Для TASK-222 предстоит определить допустимую частоту команд. Для TASK-224 предстоит уточнить профиль нагрузки и взаимодействие с большим составом. Эти решения потребуются для подготовки планов.

## Requirements
- REQ-CLI-001 — verifies
- REQ-CLI-002 — verifies
- REQ-CLI-003 — verifies
- REQ-CLI-004 — verifies
- REQ-CLI-005 — verifies
- REQ-CLI-006 — verifies
- REQ-CLI-007 — verifies
- REQ-CLI-008 — verifies
- REQ-CLI-009 — verifies
- REQ-CLI-010 — verifies
- REQ-GRP-001 — verifies
- REQ-GRP-002 — verifies
- REQ-GRP-003 — verifies
- REQ-GRP-004 — verifies
- REQ-GRP-005 — verifies
- REQ-GRP-006 — verifies
- REQ-GRP-007 — verifies
- REQ-GRP-008 — verifies
- REQ-SUB-001 — verifies
- REQ-SUB-002 — verifies
- REQ-SUB-003 — verifies
- REQ-SUB-004 — verifies
- REQ-SUB-005 — verifies
- REQ-SUB-006 — verifies
- REQ-SUB-007 — verifies
- REQ-SUB-008 — verifies
- REQ-SUB-009 — verifies
- REQ-SUB-010 — verifies
- REQ-SUB-011 — verifies
- REQ-ATT-001 — verifies
- REQ-ATT-002 — verifies
- REQ-ATT-003 — verifies
- REQ-ATT-004 — verifies
- REQ-ATT-005 — verifies
- REQ-ATT-006 — verifies
- REQ-USR-001 — verifies
- REQ-USR-002 — verifies
- REQ-USR-003 — verifies
- REQ-USR-004 — verifies
- REQ-AUD-001 — verifies
- REQ-AUD-002 — verifies
- REQ-AUD-003 — verifies
- REQ-BOT-001 — verifies
- REQ-BOT-002 — verifies
- REQ-BOT-003 — verifies
- REQ-BOT-004 — verifies
- REQ-BOT-005 — verifies
- REQ-BOT-006 — verifies
- REQ-BOT-007 — verifies
- REQ-NFR-001 — verifies
- REQ-NFR-002 — verifies
- REQ-NFR-003 — verifies
- REQ-NFR-004 — verifies
- REQ-NFR-005 — verifies
- REQ-NFR-006 — verifies
- REQ-NFR-007 — verifies
- REQ-BRN-001 — verifies
- REQ-BRN-002 — changes
- REQ-ATTN-001 — verifies
- REQ-CHAT-001 — verifies
