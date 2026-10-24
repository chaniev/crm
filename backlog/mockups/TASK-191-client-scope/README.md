# TASK-191: согласованный контракт состояний доступа

## Authority and mode

- [Source task](/backlog/implementation/TASK-191-administrator-client-branch-access.md), REQ-USR-001 и REQ-CLI-007.
- Владелец 24.10.2026 ответил «3. согласно рекомендации»: после успешного
  перевода уведомление и возврат в исходный список; по устаревшей ссылке —
  очистка карточки и сообщение о недоступности с возвратом.
- Режим crm-mobile-first-ui: локальная детерминированная коррекция существующих
  error/success/back состояний. Новая композиция и три направления не требуются.
- React/Mantine/Onest, PageLayout/PageSection/Alert и showAppNotification
  сохраняются; роли и филиальный scope определяет backend.

## UX and visual contract

Администратор работает с клиентом своего филиала. Сигнал завершения перевода —
подтверждение backend и success notification; клиент, ушедший из охвата,
не остаётся открытым и не показывается в перезагруженном исходном списке.

| Состояние | Содержимое и действия |
|---|---|
| Доступная карточка | Existing client detail, прежние permitted actions |
| Загрузка | Existing loader; не показывать старый client после смены clientId/утраты scope |
| Подтверждённый client-scoped 403/404 | Заголовок «Детали клиента», существующий Alert с безопасным текстом «Клиент недоступен.», кнопка возврата; отсутствуют ФИО, фото, формы, chat/membership и действия клиента |
| Transfer 204 | Закрыть modal, очистить detail/preview/вложенные данные, отменить старые запросы; existing notification «Клиент переведен» / «Филиал и группа клиента обновлены.» и возврат в исходный список; повторный GET карточки не нужен |
| Transfer 200 с сохранённым доступом | Прежнее обновление разрешённой карточки и уведомление |
| Validation/network failure | Сохранить форму и точный смысл backend error; не выдавать сетевую ошибку за утрату scope |
| Missing nested photo/sale | Сначала подтвердить доступ parent card; отсутствие вложенного ресурса не очищает доступного клиента |
| Telegram stale callback | Безопасное сообщение о недоступности вместо карточки и прежней клавиатуры; не путать client 404 с незарегистрированным Telegram user |

Возврат использует existing origin context: clients/group/attention, его фильтры
и поисковую строку. Список перечитывается; если ранее выбранная строка исчезла,
focus переходит в начало списка/locator вместо отсутствующей строки.
На restricted state focus — на доступной кнопке возврата; после закрытия overlay
не возвращать focus на удалённый control. Late responses не восстанавливают PII.

Мобильная композиция: existing shell → общий title → back action → error Alert.
Desktop сохраняет title/back в одной строке. Primary recovery — возврат;
недоступные действия не показываются disabled-пустышками. Typography, spacing,
цвета и safe-area механика берутся из существующих компонентов без новых tokens.
Notification использует существующий semantic success tone и обычный auto-close;
на снимках auto-close выключен только для фиксации evidence.

## Rendered evidence

Запущен отдельный Vite preview на 127.0.0.1:43191 с текущим frontend; все
`/api/*` requests перехвачены изолированными synthetic fixtures. Backend,
реальные пользователи, БД и Telegram не использовались. Это rendering
существующих компонентов, а не реализованное поведение будущего transfer 204.
Success переход смоделирован нажатием existing back и вызовом existing notification.

- [Доступная карточка до потери доступа, 390](existing-card-390.png).
- Restricted: [390](restricted-390.png), [420](restricted-420.png),
  [440](restricted-440.png), [1440](restricted-1440.png).
- Success + return: [390](transfer-success-390.png), [420](transfer-success-420.png),
  [440](transfer-success-440.png), [1440](transfer-success-1440.png).
- [Machine-readable rendering results](render-evidence.json).

Проверены Chromium 390×844/1440×1200 и WebKit mobile с logical screen
420×912/440×956, iPhone UA/touch/3x и уменьшенным viewport под browser chrome.
Для обеих состояний scrollWidth не превышает innerWidth; pageErrors отсутствуют.
В restricted fixture нет прежнего имени; back возвращает в `/clients`.
Снимки осмотрены: текст и back action видны, клиентские действия отсутствуют,
success notification читается, прежняя карточка не остаётся в списке.
Ожидаемые HTTP 404 в console и отмены запросов React cleanup не являются
необработанными ошибками приложения.

## Implementation acceptance and limits

Реальные 204/403/404 переходы, очистка уже открытого состояния и отмена поздних
ответов ещё должны быть реализованы и проверены regression suite плана.
Device-only проверки Safari chrome/keyboard/safe-area, rotation и physical
reach не выполнялись; этот preview не является device-level acceptance.

Слабое место существующей композиции — временное success notification перекрывает
locator на узком экране. Сохраняется штатное auto-close и доступная кнопка закрытия;
новый постоянный overlay не вводится. В implementation acceptance проверить
закрытие notification и восстановление доступа к поиску после auto-close.
