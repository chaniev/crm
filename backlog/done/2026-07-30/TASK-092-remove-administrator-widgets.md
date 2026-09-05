# TASK-092: Удалить сводные виджеты из раздела администраторов

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-26 23:56
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-07-30/TASK-092-remove-administrator-widgets.plan.md
- implementation_branch: feature/TASK-092-remove-administrator-widgets
- implementation_state: completed
- implementation_commit: 47f4a81
- delivered_on_main_at: 2026-07-30
- moved_to_done_at: 2026-07-30
- last_status_reviewed_at: 2026-07-30
- reviewed_main_commit: 342f5c5

## Goal
Пользователь сразу переходит к списку и операциям с администраторами без занимающих место сводных карточек.

## Context
В разделе настроек `Администраторы` над списком сейчас показаны три `MetricCard`: общее количество администраторов, количество активных и количество пользователей с обязательной сменой пароля. В inbox зафиксировано требование удалить эти виджеты.

## User role
Главный тренер / суперадминистратор.

## Problem
Сводные карточки не поддерживают основную задачу управления администраторами, занимают заметную часть экрана и отодвигают список и primary action.

## Scope
- Удалить из раздела `Администраторы` сводные виджеты `Администраторы`, `Активные` и `Смена пароля`.
- Удалить ставшие неиспользуемыми вычисления, imports и layout-обёртки этого блока.
- Сохранить заголовок раздела, описание, кнопку добавления, обновление, список, loading/error/empty states и формы без функциональных изменений.
- Обновить существующие component tests раздела администраторов.
- Проверить компоновку раздела на mobile, tablet и desktop после удаления блока.

## Out of scope
- Изменение списка, карточек или форм администраторов.
- Изменение ролей, permissions, backend contracts или audit semantics.
- Удаление виджетов в других разделах CRM.
- Перенос или редизайн кнопки добавления; это рассматривается отдельной задачей.

## Constraints
- Не менять загрузку и мутации администраторов.
- Не удалять пользовательские статусы из строк списка.
- Primary action и все operational states должны оставаться доступными.
- Сохранить Mantine и существующие shared UI patterns.

## Acceptance criteria
- [x] В разделе `Администраторы` не отображаются три сводных виджета количества, активности и смены пароля.
- [x] Заголовок, описание, кнопки добавления и обновления расположены перед списком и работают как раньше.
- [x] Loading, error, empty и populated states не регрессируют.
- [x] Создание и редактирование администратора остаются доступными согласно backend permissions.
- [x] После удаления блока нет пустого контейнера, лишнего вертикального отступа или неиспользуемого frontend-кода.
- [x] Раздел не получает горизонтальную прокрутку на 390 x 844, 420 x 912 и 440 x 956.

## Test checklist
- [x] Обновить `SettingsScreen` component tests: метрики отсутствуют, основной список и действия сохранены.
- [x] Вручную проверить loading, error, empty и populated states раздела.
- [x] Проверить mobile layout на 390 x 844, 420 x 912 и 440 x 956.
- [x] Запустить frontend lint.
- [x] Запустить frontend unit tests.
- [x] Запустить frontend build.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: локальное удаление декоративно-информационного frontend-блока без изменения бизнес-логики или контрактов.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/processed/2026-07-26.md`
- Original note: `удалить виджеты в окне работы с администраторами`
- Source file: `backlog/processed/2026-07-27-2.md`
- Original note: `Необходимо проверить все экраны и удалить оставшиеся виджеты. В частности, виджеты ещё присутствуют на экранах раздела «Настройка».`

## Processing notes
- Created at: 2026-07-26 16:28
- Created by skill: codex-backlog-skill
- Duplicate check: активных задач на удаление сводных виджетов раздела администраторов не найдено; client visual-noise TASK-018 и завершённые group summary задачи относятся к другим экранам.
- Updated at: 2026-07-27 01:04
- Duplicate check: часть новой all-screen заметки про administrator settings полностью покрыта этой implementation task; scope не изменён. Остаточные BranchSettings/group-edit widgets вынесены в TASK-101.

## Completion notes
- Три сводных виджета удалены без изменения списка, форм, разрешений и
  operational states раздела администраторов.
- Component и responsive regression-проверки обновлены.
- Изменений схемы хранения данных и миграции БД не потребовалось.
