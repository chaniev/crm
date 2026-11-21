---
status: processed
processed_at: 2026-11-20 19:43
generated_tasks:
  - TASK-204-client-full-name-search.md
  - TASK-205-attendance-lesson-context.md
  - TASK-206-administrator-branch-display-consistency.md
  - TASK-207-attention-mobile-client-identity.md
  - TASK-208-audit-list-technical-metadata.md
  - TASK-209-mobile-navigation-clients-slot.md
  - TASK-210-attention-search-information-priority.md
updated_existing_tasks:
  - TASK-016-client-card-quick-actions.md
  - TASK-018-client-detail-visual-noise.md
  - TASK-019-client-card-tabs.md
  - TASK-020-client-empty-states-action-reasons.md
  - TASK-021-client-detail-responsive-regression.md
  - TASK-175-user-visible-date-format.md
  - TASK-176-russian-accessibility-and-validation-focus.md
  - TASK-179-professional-catalog-seed-presentation.md
  - TASK-181-native-navigation-links.md
  - TASK-182-schedule-weekday-calendar-date.md
  - TASK-184-finance-duplicate-warning-once.md
  - TASK-185-ui-copy-and-unit-consistency.md
---
# Сопоставление с существующим бэклогом

20.11.2026. Это карта пересечений, не перевод задач между статусами и не полный status-audit бэклога. Исходники, текущий экран, принятые требования и существующие карточки использованы как источники; готовность всех планов повторно не проверялась.

| Карточка | Расположение | Тема | Как использовать результат |
|---|---|---|---|
| [TASK-016](../../risky/TASK-016-client-card-quick-actions.md) | risky | Быстрые действия карточки | PRE-01: наблюдение для существующей рискованной задачи; не создавать дубль. |
| [TASK-018](../../done/2026-11-21/TASK-018-client-detail-visual-noise.md) | tasks-ready | Шум полной карточки и формы | DET-01/02, NEW-01/02 напрямую пересекаются с действующим scope. |
| [TASK-019](../../tasks-ready/TASK-019-client-card-tabs.md) | tasks-ready | Вкладки карточки клиента | Выбор структуры полной/краткой карточки; ещё не принято решение этим аудитом. |
| [TASK-020](../../risky/TASK-020-client-empty-states-action-reasons.md) | risky | Пустые состояния и причины действий | Пустые контакты, Telegram, фото; важные причины не прятать. |
| [TASK-021](../../tasks-ready/TASK-021-client-detail-responsive-regression.md) | tasks-ready | Адаптивность карточки | Использовать новые снимки как входящие доказательства, не как пройденную приёмку. |
| [TASK-174](../../implementation/TASK-174-secondary-text-contrast-regression.md) | tasks-ready | Контраст вторичных текстов | Визуально слабые подписи отмечать для измерения; этот аудит контраст не измерял. |
| [TASK-175](../../needs-clarification/TASK-175-user-visible-date-format.md) | needs-clarification | Формат дат | ISO в посещениях и каталоге; вопрос не решён здесь. |
| [TASK-176](../../tasks-ready/TASK-176-russian-accessibility-and-validation-focus.md) | tasks-ready | Локализованные доступные имена | Toggle password visibility воспроизведён; ошибки и перевод фокуса форм отдельно. |
| [TASK-177](../../implementation/TASK-177-group-weekday-touch-targets.md) | tasks-ready | Сенсорные цели дней недели | Создание группы проверено визуально; размеры целей отдельно не измерялись. |
| [TASK-179](../../needs-clarification/TASK-179-professional-catalog-seed-presentation.md) | needs-clarification | Профессиональный тариф в каталоге | Не удалять Professional и тестовые названия по одному визуальному впечатлению. |
| [TASK-181](../../tasks-ready/TASK-181-native-navigation-links.md) | tasks-ready | Нативные ссылки навигации | NAV-02 уже покрывается существующей карточкой. |
| [TASK-182](../../tasks-ready/TASK-182-schedule-weekday-calendar-date.md) | tasks-ready | Дата и день недели расписания | SCH-03 не требует новой дублирующей карточки. |
| [TASK-184](../../tasks-ready/TASK-184-finance-duplicate-warning-once.md) | tasks-ready | Одно финансовое предупреждение | FIN-01 воспроизведён; принятый текст требования уже требует убрать дубль. |
| [TASK-185](../../needs-clarification/TASK-185-ui-copy-and-unit-consistency.md) | needs-clarification | Тексты и единицы | Active, технические слова и форматы денежных значений; область уточнять при triage. |
| [TASK-107](../../done/2026-08-22/TASK-107-audit-log-mobile-density-focus.md) | done | Мобильный журнал и фокус | Историческая done: текущие технические строки сохраняются; Escape/возврат фокуса проверены положительно. |
| [TASK-157](../../done/2026-08-30/TASK-157-schedule-mobile-density.md) | done | Плотность расписания | Историческая done; новое предложение не объявляет прошлую работу невыполненной. |
| [TASK-163](../../done/2026-08-30/TASK-163-attention-density.md) | done | Плотность внимания | Историческая done; новые снимки показывают компромисс с обрезкой имени/причины. |
| [TASK-164](../../done/2026-08-30/TASK-164-groups-vertical-budget.md) | done | Вертикальный бюджет групп | Историческая done; добавление времени и удаление счётчика требуют отдельного сопоставления. |
| [TASK-168](../../done/2026-09-02/TASK-168-attendance-today-worklist.md) | done | Список занятий сегодня | Историческая done; контекст состава занятия анализировать отдельно от списка. |
| [TASK-196](../../done/2026-11-16/TASK-196-xlsx-client-import.md) | done | Импорт XLSX | Историческая done; предупреждение о дублях и ролевой доступ намеренны. |
| [TASK-203](../../done/2026-11-19/TASK-203-group-create-single-action.md) | done | Создание группы одним действием | Историческая done; не возвращать обязательную дополнительную фазу создания. |

## Новые отдельные наблюдения для triage

- Поиск по отображаемому сочетанию фамилии и имени (CLI-01): сначала найти причину и проверить пересечение с задачами поиска, не подменять исправление поиском только по одной фамилии.
- Отсутствие группы/времени на занятии (ROS-01): сохранить связь с REQ-ATT-001/002 и существующей моделью занятия.
- Противоречие филиала администратора (ADM-01): сопоставить ответы списка и диалога, проверить потребителей, не исправлять клиентским угадыванием филиала.
- Потеря различимости клиента в мобильном «Внимание» (ATN-01): сравнить с выполненной TASK-163 и текущими требованиями идентификации.
- Тексты и информация в режиме настройки группы (GED-01/03): исторические данные не удалять; убрать сырой статус и сообщения о будущей разработке из рабочего пути.

Новые TASK-ID здесь намеренно не создавались. Сначала выбрать границы и решения, затем обновить существующие карточки либо создать недублирующие задачи. Предложения, меняющие поведение, получают принятое требование и проверенный прототип до реализации.

[Общий отчёт](README.md)

## Результат разбора 20.11.2026

Исходный текст выше сохранён как история аудита. Текущая классификация, связанные задачи и отложенные предложения — в [результате разбора](TRIAGE.md). Статус «обработано» относится к источнику и не означает выполнения найденных доработок.
