# TASK-036: Добавить возвраты и семантику продажи абонемента

## Status
done

## Goal
Backend хранит возвраты по абонементам и дает однозначный источник данных для будущих финансовых отчетов без двойного учета истории абонементов.

## Context
Задача создана после закрытия уточнений в `TASK-026`.

Для первого релиза отчетов нужно считать:
- продажу абонемента по дате покупки;
- возврат по дате возврата;
- сумму возврата как явно указанное значение;
- нулевые абонементы как отдельные продажи с суммой `0`;
- отмены и заморозки не учитывать.

Текущая модель `ClientMembership` содержит `PurchaseDate`, `PaymentAmount`, `IsPaid`, `ChangeReason`, `ValidFrom` и `ValidTo`, но не содержит отдельной модели возврата. История абонементов хранит технические версии (`Correction`, `PaymentUpdate`, `SingleVisitWriteOff`), поэтому будущий отчет не должен наивно суммировать все строки истории.

## User role
главный тренер / администратор

## Problem
Финансовый отчет требует суммы и даты возврата, но backend пока не хранит возвраты как отдельные финансовые события. Без явной семантики sale/refund будущий отчет может неверно посчитать продажи, возвраты и чистую сумму.

## Planned approach
- Ввести отдельную стабильную сущность финансовой продажи, например `ClientMembershipSale`.
- Минимальные поля продажи: `Id`, `ClientId`, `MembershipType`, `PurchaseDate`, `GrossAmount`, `CreatedByUserId`, `CreatedAt`.
- `ClientMembership` должен получить ссылку на продажу, например `SaleId`.
- `ClientMembership.PaymentAmount` не уменьшается при возврате. Финансовым источником валовой суммы для отчетов становится `ClientMembershipSale.GrossAmount`.
- Хранить возвраты отдельными финансовыми событиями, например `ClientMembershipRefund`.
- Минимальные поля возврата: `Id`, `SaleId`, `ClientId`, `Amount`, `RefundDate`, `CreatedByUserId`, `CreatedAt`, `CanceledAt`, `CanceledByUserId`.
- Опциональное поле возврата: `Comment`, если нужно фиксировать причину или примечание администратора.
- Отмена возврата помечает refund как canceled, не удаляет запись из базы и обязательно аудируется; причина отмены не хранится и не требуется.
- Для отображения информации об абонементе отдавать или уметь строить backend-derived сводку:
  - `GrossAmount`/`PaymentAmount` - исходная валовая сумма продажи из `ClientMembershipSale`;
  - `RefundedAmount` - сумма всех неотмененных возвратов по продаже;
  - `NetAmount` - `GrossAmount - RefundedAmount`;
  - `RefundStatus` - `None`, `Partial`, `Full`;
  - `LastRefundDate`;
  - `Refunds[]` для details/history view, если потребителю нужен список возвратов.
- Возврат сам по себе не меняет `IsPaid`, `ValidTo`, `PaymentAmount`, `SingleVisitUsed` или текущий статус доступа. Если полный возврат должен отменять доступ, это отдельное бизнес-решение вне этой задачи.
- `NewPurchase` и `Renewal` создают новую `ClientMembershipSale` и новую текущую версию `ClientMembership` с этим `SaleId`.
- `Correction`, `PaymentUpdate`, `SingleVisitWriteOff` создают технические версии `ClientMembership` с тем же `SaleId` и не создают новую продажу.
- `Correction` обновляет `ClientMembershipSale.PurchaseDate` и/или `ClientMembershipSale.GrossAmount`, если исправляет дату покупки или сумму продажи. Такое изменение обязательно аудируется с old/new состоянием финансовой продажи.
- По умолчанию поддержать несколько частичных возвратов по одной продаже, но суммарный `RefundedAmount` не должен превышать `ClientMembershipSale.GrossAmount`.
- Для существующей истории не нужен legacy backfill: rollout выполняется только на чистую базу. Схема должна создаваться сразу с `ClientMembershipSale`, обязательным `SaleId` у `ClientMembership` и воспроизводимыми seed/test fixtures.
- Расширить модель исторической атрибуции для будущих отчетов:
  - хранить периоды привязки клиента к филиалу, например `ClientBranchAssignment` с `ClientId`, `BranchId`, `ValidFrom`, `ValidTo`, `CreatedByUserId`, `CreatedAt`;
  - `ValidFrom` и `ValidTo` для period-моделей используют `DateOnly`;
  - period membership проверяется как `ValidFrom <= date && (ValidTo == null || date < ValidTo)`, то есть `ValidFrom` включительно, `ValidTo` исключительно;
  - клиент может быть привязан только к одному филиалу в один момент времени, поэтому периоды филиалов клиента не должны пересекаться;
  - при переводе клиента в другой филиал backend автоматически закрывает предыдущий период филиала и открывает новый;
  - хранить периоды привязки клиента к группам, например `ClientGroupAssignment` с `ClientId`, `GroupId`, `ValidFrom`, `ValidTo`, `CreatedByUserId`, `CreatedAt`;
  - у клиента должна быть минимум одна активная группа; группы являются обязательным параметром при создании/обновлении клиента и при переводе клиента в другой филиал;
  - активные группы клиента должны принадлежать активному филиалу клиента на ту же дату;
  - хранить периоды привязки тренера к группам, например `GroupTrainerAssignment` с `TrainerId`, `GroupId`, `ValidFrom`, `ValidTo`, `CreatedByUserId`, `CreatedAt`;
  - группа принадлежит одному филиалу и не может менять филиал после создания;
  - клиент и тренер могут быть привязаны к нескольким группам в один и тот же период; такие пересечения должны сохраняться для дублирования строк/значений в отчетных breakdowns.

## Scope
- Добавить backend-модель `ClientMembershipSale` или эквивалентный backend-owned financial sale contract.
- Добавить связь `ClientMembership -> ClientMembershipSale`, например через `SaleId`.
- Добавить backend-модель или эквивалентный backend-owned contract для возврата абонемента.
- Зафиксировать обязательные поля возврата: продажа, клиент, сумма возврата, дата возврата, пользователь, дата создания.
- Не мутировать `ClientMembershipSale.GrossAmount` или `ClientMembership.PaymentAmount` при регистрации возврата.
- Добавить backend-derived финансовую сводку абонемента: исходная сумма, сумма возвратов, чистая сумма, статус возврата, последняя дата возврата.
- Добавить список возвратов в details/history contract или отдельный backend contract, если это безопаснее для текущих API.
- Добавить backend API или use case для регистрации возврата.
- Добавить backend API или use case для отмены возврата.
- Валидировать сумму возврата и дату возврата через backend.
- Валидировать накопленную сумму возвратов: несколько частичных возвратов разрешены, но суммарный возврат не может превышать валовую сумму продажи.
- Валидировать дату возврата: она не может быть в будущем, раньше `ClientMembershipSale.PurchaseDate` или раньше даты создания продажи.
- Исключать отмененные возвраты из `RefundedAmount`, `RefundStatus`, `LastRefundDate` и будущих финансовых отчетов.
- Зафиксировать, какие записи истории абонементов считаются продажей для отчетов.
- Создавать новую финансовую продажу для `NewPurchase` и `Renewal`.
- Сохранять тот же `SaleId` для технических версий `Correction`, `PaymentUpdate`, `SingleVisitWriteOff`.
- При `Correction` обновлять финансовую продажу, если исправлены `PurchaseDate` или `PaymentAmount`/`GrossAmount`.
- Исключить из продаж технические изменения: correction/payment update/single-visit write-off.
- Гарантировать, что нулевой абонемент считается продажей с суммой `0`.
- Обновить audit semantics для создания возврата.
- Обновить audit semantics для отмены возврата.
- Обновить audit semantics для изменения финансовой продажи через `Correction`.
- Обновить ProblemDetails для ошибок возврата.
- Добавить или обновить persistence-модели периодной атрибуции для отчетов: период клиента в филиале, период клиента в группе, период тренера в группе.
- Использовать `DateOnly` для `ValidFrom`/`ValidTo` в period-моделях.
- Использовать half-open семантику периодов: `ValidFrom <= date && (ValidTo == null || date < ValidTo)`.
- Жестко запретить пересечение периодов `ClientBranchAssignment` для одного клиента.
- При переводе клиента между филиалами автоматически закрывать предыдущий `ClientBranchAssignment` и создавать новый.
- Зафиксировать, что группа не может менять филиал после создания; периодная история филиала группы не нужна.
- Сделать группы клиента обязательным параметром в backend contract создания/обновления клиента и перевода клиента в другой филиал.
- Валидировать, что у клиента всегда есть минимум одна активная `ClientGroupAssignment`.
- Валидировать, что активные группы клиента принадлежат активному филиалу клиента на соответствующую дату.
- При переводе клиента в другой филиал требовать минимум одну группу целевого филиала и закрывать/открывать period-записи групп согласованно с новым филиальным периодом.
- Разрешить одновременную привязку клиента к нескольким группам и тренера к нескольким группам.
- Зафиксировать, что отчетные breakdowns могут дублировать финансовое событие по нескольким группам/тренерам, если на дату события есть несколько подходящих периодных связей.
- Подготовить persistence migration/schema update для чистой базы; поддержка частично заполненной legacy-базы и backfill существующих строк не требуются.

## Out of scope
- Агрегированный API финансовых отчетов.
- Frontend вкладка `Финансы`.
- Legacy/backfill миграция для частично заполненной базы.
- Полная реализация агрегированного report API поверх периодной атрибуции.
- Учет отмен и заморозок.
- Интеграция с внешними платежными провайдерами.
- Полная финансовая сверка или бухгалтерский учет.

## Constraints
- Backend владеет financial report semantics, validation semantics и audit semantics.
- `ClientMembershipSale.GrossAmount` является источником валовой суммы продажи для финансовых отчетов.
- `ClientMembership.PaymentAmount` не уменьшается возвратами.
- Возврат считается по дате возврата, не по дате покупки.
- Дата возврата не может быть в будущем, раньше `ClientMembershipSale.PurchaseDate` или раньше даты создания продажи.
- Возврат не должен уменьшать валовую сумму продаж; он влияет только на сумму возвратов и чистую сумму.
- Возврат не должен автоматически закрывать абонемент, менять оплату, дату действия или использоваться как отмена.
- Суммарный возврат по продаже не должен превышать валовую сумму продажи, включая сценарий нескольких частичных возвратов.
- Отмененный возврат не учитывается в сумме возвратов и чистой сумме, но остается в истории и аудите.
- Аудит отмены возврата фиксирует пользователя и время отмены; причина отмены не требуется.
- Возврат нельзя отменить повторно.
- `Correction` не создает новую продажу, но может исправить `ClientMembershipSale.PurchaseDate` и/или `ClientMembershipSale.GrossAmount`.
- `Correction` не может уменьшить `ClientMembershipSale.GrossAmount` ниже суммы неотмененных возвратов по продаже.
- `Correction` не может сдвинуть `ClientMembershipSale.PurchaseDate` позже самой ранней даты неотмененного возврата по продаже.
- Любое изменение финансовой продажи через `Correction` должно аудироваться.
- Развертывание выполняется только на чистую базу; `SaleId` можно делать обязательным сразу, без nullable-stage и legacy backfill.
- Историческая атрибуция отчетов должна опираться на периодные связи, а не на текущее состояние клиента, группы или тренера.
- `ValidFrom`/`ValidTo` периодных моделей являются `DateOnly`.
- `ValidFrom` включается в период, `ValidTo` исключается из периода.
- Дата считается попадающей в период только по правилу `ValidFrom <= date && (ValidTo == null || date < ValidTo)`.
- Клиент не может иметь две активные или исторически пересекающиеся филиальные привязки на одну дату.
- Перевод клиента в другой филиал закрывает предыдущий период автоматически.
- Группа не может менять филиал после создания.
- У клиента всегда должна быть минимум одна активная группа.
- Активные группы клиента должны относиться к активному филиалу клиента.
- Клиент и тренер могут иметь несколько групповых привязок на одну дату; это не ошибка данных.
- Дублирование в отчетах по нескольким группам/тренерам является ожидаемым поведением, а не double-count bug.
- Нельзя дублировать финансовые формулы во frontend.
- Не ломать существующие membership flows: покупка, продление, корректировка, подтверждение оплаты, списание разового посещения.

## Acceptance criteria
- [ ] В backend есть стабильная финансовая сущность/contract продажи абонемента, например `ClientMembershipSale`.
- [ ] `ClientMembership` версии связаны с финансовой продажей через `SaleId` или эквивалентный backend-owned identity.
- [ ] В backend есть явная модель или contract для возврата с суммой и датой возврата.
- [ ] Возврат хранится отдельно от `ClientMembership.PaymentAmount`; валовая сумма продажи не мутируется при возврате.
- [ ] Возврат ссылается на финансовую продажу, а не на случайную техническую версию `ClientMembership`.
- [ ] Backend позволяет отменить возврат без удаления записи и аудирует отмену.
- [ ] Backend поддерживает несколько частичных возвратов по одной продаже и отклоняет превышение `ClientMembershipSale.GrossAmount` суммарными возвратами.
- [ ] Backend валидирует сумму возврата и дату возврата.
- [ ] Backend отклоняет дату возврата в будущем, раньше даты покупки или раньше даты создания продажи.
- [ ] В backend есть derived-сводка по абонементу: исходная сумма, сумма неотмененных возвратов, чистая сумма, статус возврата и последняя дата неотмененного возврата.
- [ ] Возврат аудируется.
- [ ] Отмененный возврат не учитывается в derived-сводке и будущих отчетах.
- [ ] Sale semantics документированы в коде или тестах: продажа считается по `ClientMembershipSale.PurchaseDate`, `NewPurchase` и `Renewal` создают продажи, технические версии не дают двойной учет.
- [ ] `Correction` сохраняет `SaleId` и обновляет `ClientMembershipSale.PurchaseDate`/`GrossAmount`, если исправляет дату или сумму покупки.
- [ ] Backend отклоняет `Correction`, если новый `GrossAmount` меньше суммы неотмененных возвратов по продаже.
- [ ] Backend отклоняет `Correction`, если новая `PurchaseDate` позже самой ранней даты неотмененного возврата по продаже.
- [ ] Изменение финансовой продажи через `Correction` аудируется с old/new состоянием.
- [ ] Нулевой абонемент учитывается как продажа с суммой `0`.
- [ ] В backend есть периодная модель привязки клиента к филиалу, и клиент не может быть в двух филиалах на одну дату.
- [ ] В backend есть периодная модель привязки клиента к группам.
- [ ] В backend есть периодная модель привязки тренера к группам.
- [ ] Period-модели используют `DateOnly` для `ValidFrom` и `ValidTo`.
- [ ] Period matching использует half-open правило `ValidFrom <= date && (ValidTo == null || date < ValidTo)`.
- [ ] Пересечения `ClientBranchAssignment` для одного клиента жестко запрещены.
- [ ] Перевод клиента в другой филиал автоматически закрывает предыдущий период филиала.
- [ ] Группа не может менять филиал после создания.
- [ ] Backend contracts создания/обновления клиента и перевода клиента требуют минимум одну группу.
- [ ] Backend не позволяет оставить клиента без активной группы.
- [ ] Backend валидирует, что активные группы клиента принадлежат активному филиалу клиента.
- [ ] Модель допускает несколько групп клиента и несколько групп тренера на одну дату.
- [ ] Семантика дублирования отчетных breakdowns по нескольким группам/тренерам зафиксирована в коде или тестах.
- [ ] Backend tests покрывают возвраты, нулевые абонементы и отсутствие двойного учета history rows.
- [ ] Migration/schema update воспроизводимы на чистой базе, без требований к legacy backfill частично заполненных баз.

## Test checklist
- [ ] Запустить `dotnet test backend/GymCrm.slnx`.
- [ ] Проверить регистрацию возврата с валидной суммой и датой.
- [ ] Проверить отклонение отрицательной суммы, будущей даты возврата, даты раньше покупки и даты раньше создания продажи.
- [ ] Проверить несколько частичных возвратов по одной финансовой продаже.
- [ ] Проверить отклонение возврата, если суммарная сумма возвратов превысит `ClientMembershipSale.GrossAmount`.
- [ ] Проверить отмену возврата, запрет повторной отмены и audit entry для отмены с пользователем и временем без причины.
- [ ] Проверить, что отмененный возврат не входит в `RefundedAmount`, `RefundStatus`, `LastRefundDate` и future report totals.
- [ ] Проверить, что возврат не меняет `PaymentAmount`, `IsPaid`, `ValidTo` и current membership state.
- [ ] Проверить derived-сводку: `RefundedAmount`, `NetAmount`, `RefundStatus`, `LastRefundDate`.
- [ ] Проверить, что `NewPurchase` и `Renewal` создают новые финансовые продажи.
- [ ] Проверить, что correction/payment update/single-visit write-off сохраняют тот же `SaleId` и не создают дополнительные продажи для будущих отчетов.
- [ ] Проверить, что correction даты/суммы покупки обновляет `ClientMembershipSale.PurchaseDate`/`GrossAmount` и аудируется.
- [ ] Проверить отклонение correction, если новый `GrossAmount` ниже суммы неотмененных возвратов.
- [ ] Проверить отклонение correction, если новая `PurchaseDate` позже самой ранней даты неотмененного возврата.
- [ ] Проверить audit entry для возврата.
- [ ] Проверить периодные связи: `DateOnly` periods, half-open `ValidTo`, клиент-филиал без пересечений, автоматическое закрытие филиала при переводе, обязательная минимум одна клиент-группа, клиент-группа с несколькими группами, тренер-группа с несколькими группами.
- [ ] Проверить отклонение создания/обновления/перевода клиента без группы или с группой из другого филиала.
- [ ] Проверить, что группа не может сменить филиал.
- [ ] Проверить чистую миграцию/schema setup: `ClientMembershipSale`, required `SaleId`, refund cancellation fields without cancel reason, attribution period tables, FK/indexes и seed/test fixtures.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача меняет финансовую семантику, persistence и audit behavior.

## Clarification questions
Не требуется перед планированием. Перед реализацией остановиться, если полный возврат должен автоматически отменять доступ, если нужно разрешить возврат больше суммы продажи, если отмена возврата должна физически удалять запись вместо cancel-state, если причина отмены возврата станет обязательной, если `Correction` не должна менять финансовую продажу, или если multi-group breakdowns должны дедуплицироваться вместо дублирования.

## Source notes
- Derived from: `backlog/done/TASK-026-statistics-and-financial-reports.md`
- Enables: `backlog/done/TASK-037-financial-reports-backend-api.md`

## Processing notes
- Created at: 2026-05-13 20:54
- Created by decomposing `TASK-026`.
- Updated at: 2026-05-13 to choose explicit `ClientMembershipSale` identity and correction-updates-sale semantics.
- Updated at: 2026-05-13 to clarify clean-database rollout, refund date validation and refund cancellation semantics.
- Updated at: 2026-05-13 to add historical client branch, client group and trainer group attribution periods for reports.
- Updated at: 2026-05-13 to use `DateOnly` attribution periods, strict client branch non-overlap, automatic branch period closing, immutable group branch and refund-cancel audit without reason.
- Updated at: 2026-05-13 to reject correction that would reduce gross amount below non-canceled refunds.
- Updated at: 2026-05-13 to define half-open period matching: `ValidFrom <= date && (ValidTo == null || date < ValidTo)`.
- Updated at: 2026-05-13 to reject correction that would move purchase date after an existing non-canceled refund date.
- Updated at: 2026-05-13 to require at least one active client group and keep client groups in the active client branch.
- Moved to done by 2026-05-14 status audit after merge of `feature/TASK-036-membership-refunds-sale-semantics`.
