# TASK-190: runtime comparison

Сравнены утверждённый существующий baseline из
/backlog/done/2026-10-23/TASK-190-existing-settings и текущий React runtime через
Playwright fixtures. Backend persistence/authorization этим не доказываются:
они проверяются отдельно HTTP tests с PostgreSQL.

## Контракт и результат

Порядок вкладок, toolbar, филиалы → выбранный филиал → залы, поля и Mantine Modal
сохранены. У HeadCoach остались прежние controls; у SuperAdministrator доступны
только View/CreateBranch/CreateHall из session. Вновь добавленной композиции нет.
Ошибка архивного parent показана внутри hall dialog, название сохранено,
retry успешен. Кнопки возвращают focus после cancel и успешного create, включая
hall refresh. При compact-height modal расположен выше навигации; отмена и
сохранение достижимы. Отзыв action сохраняет ввод и запрещает submit.

## Rendered evidence

- [390×844 hall form](chromium-hall-form-390x844.png), [360×780](chromium-hall-form-360x780.png).
- [1440×1200](chromium-hall-form-1440x1200.png), [tablet](chromium-hall-form-768x1024.png).
- [iPhone Air error](iphone-air-webkit-hall-error.png), [HeadCoach](iphone-air-webkit-headcoach-panel.png).
- [iPhone 17 Pro Max branch form](iphone-17-pro-max-webkit-branch-form.png).
- [Air compact-height](iphone-air-webkit-hall-form-912x420.png), [Pro Max compact-height](iphone-17-pro-max-webkit-hall-form-956x440.png).

Оба WebKit-профиля: touch, iPhone UA, device scale factor 3, screen 420×912 и
440×956 с уменьшенным viewport. Chromium geometry: 360, 390, 768, 1440.
21 сценарий нового spec прошёл во всех трёх проектах. Screenshots inspected
после завершения transitions; click/focus/retry/overflow проверены assertions.

## Оценка по visual-review

| Критерий | Оценка / 5 | Evidence |
|---|---:|---|
| Иерархия | 4 | Create branch в toolbar, create hall у выбранного филиала |
| Сканируемость | 4 | Список и детали сохраняют baseline, роль не добавляет лишние controls |
| Плотность | 4 | Поля и кнопки не перекрываются на 390, кнопки доступны в landscape |
| Типографика | 4 | Onest, подписи и 16px ввод; длинное имя доступно в input |
| Ритм | 4 | Существующие Stack/ResponsiveButtonGroup сохранены |
| Визуальный язык | 4 | Существующие surfaces, primary green, semantic danger feedback |
| Обратная связь | 5 | Ошибка внутри формы, input/retry/focus подтверждены тестами |
| Адаптивность | 4 | Портрет, desktop и compact-height проверены |

Новых подтверждённых отклонений от согласованного UI-контракта после исправлений
нет. Слабое место: существующее длинное модальное окно в landscape требует
прокрутки; controls доступны, но реальная программная клавиатура отдельно не
проверена. Safari chrome, hardware keyboard/software keyboard, safe-area,
Dynamic Island/home indicator и physical-device acceptance не заявляются.
Simulator/физический iPhone не использованы; booted Simulator devices отсутствовали.
