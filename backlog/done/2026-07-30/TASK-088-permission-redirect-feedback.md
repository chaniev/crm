# TASK-088: Заменить silent permission redirects явной обратной связью

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-26 23:56
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-07-30/TASK-088-permission-redirect-feedback.plan.md
- implementation_branch: fix/TASK-088-permission-redirect-feedback
- implementation_state: completed
- implementation_commit: 2ca95efbbffe423f4e06b7586d5e3f2f18a99c5f
- integration_commit: 7c43c04b7358e3f1bd8c8731bd42d95d4b604a64
- stabilization_commit: c69f47b9a91d09363577406052cf8d36633726b3
- delivered_on_main_at: 2026-07-30
- moved_to_done_at: 2026-07-30
- last_status_reviewed_at: 2026-07-30 19:33 MSK
- reviewed_main_commit: c69f47b9a91d09363577406052cf8d36633726b3

## Priority
P1

## Goal
При открытии недоступного route пользователь понимает ограничение и получает валидное следующее действие, а не неожиданно оказывается на другом экране.

## Shared mobile UI contract

- Normative contract:
  [Единый контракт мобильного интерфейса CRM](../../../docs/MOBILE_UI_CONTRACT.md).
- Foundation dependency: `TASK-090`; touch/compact-height sweep: `TASK-084`.
- Эта задача владеет route access resolution и recovery destination, но
  использует общий `RestrictedState`, notification и focus contracts.
- Visual comparison не задаёт отдельную restricted palette: warning/restricted
  meaning остаётся invariant для всех deployment themes.

## User role
Любая ограниченная роль, включая тренера и SuperAdministrator без доступа к Finance.

## Problem
TASK-090 добавил shared `RestrictedState`, но route wiring осталось прежним:
`resolveAccessibleRoutePath` возвращает только fallback path, `App` делает
silent `replace`, причина denial теряется, а `RouteRedirectPlaceholder`
показывает loader без recovery. Coach при прямом открытии `/groups` или
`/users` попадает на `/`, а при `/clients/new` — на `/clients`, без объяснения
причины. Unknown path также нормализуется в `Home`, поэтому not-found нельзя
отличить от permission restriction.

## Scope
- Заменить path-only route resolution typed outcome:
  `allowed | restricted | not-found`, где restricted содержит requested
  destination, generic access reason и session-allowed recovery path.
- Direct URL/deep link/reload к restricted read или write route сохраняет
  requested route context и показывает inline `RestrictedState` с persistent
  reason и recovery action; loader placeholder запрещён.
- Если automatic `replace` необходим после изменения session/access во время
  работы, destination показывает polite notification, называющую недоступный
  раздел/операцию и причину. Notification не заменяет inline state для direct
  URL.
- Valid next action: `На главный экран` или `Открыть доступный раздел`.
- Навигация и доступные operations по-прежнему строятся только из session/backend contract.
- Разделить session loading, unknown route и permission restriction.
- Для SuperAdministrator direct `/finance` показывает явное ограничение и recovery; `Finance` отсутствует в primary navigation и overflow.
- Удалить `RouteRedirectPlaceholder` из permission-denied paths.

## Existing non-regression baseline
- Для SuperAdministrator `Finance` уже отсутствует в navigation/overflow по
  session contract; задача добавляет feedback только для direct denial.
- В staff management HeadCoach и peer SuperAdministrator уже являются
  read-only targets без edit/deactivate/reactivate controls.
- Create role options уже поступают из backend; для SuperAdministrator baseline
  ограничен `Administrator` и `Coach`.
- Эти правила остаются regression coverage, но не реализуются повторно внутри
  route feedback.

## Out of scope
- Изменение role/permission model.
- Workflow запроса доступа.
- Отображение unusable controls.
- Собственные frontend permission semantics.
- Target-specific backend `403` внутри уже разрешённого route: он использует
  существующий ProblemDetails/recovery contract экрана, а не route guard.

## Responsive behavior
- `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`: сообщение и primary recovery action помещаются в одну колонку и доступны без clipping.
- `768 x 1024`, `1440 x 1200`: использовать существующий `PageLayout`/`PageSection`, отдельный modal не требуется.
- `912 x 420`, `956 x 440`: причина и recovery action видимы без бесконечного loader и nested scroll.

## Operational and interaction states
- Permission restricted: явный title, краткая причина и доступный destination.
- Session loading остаётся отдельным временным состоянием.
- Unknown route использует отдельный not-found/fallback contract.
- Direct denied URL использует `RestrictedState` с `focusOnMount="heading"` и
  корректным document title недоступного destination.
- После automatic redirect destination получает собственный document title, а
  restriction объявляется polite notification.
- При direct URL focus переходит к heading или primary recovery action; обычная навигация не должна получать неожиданный focus theft.
- Browser back/forward не создаёт redirect loop и не повторяет уже
  acknowledged notification без нового denial event.

## Acceptance criteria
- [ ] Restricted route не заканчивается loader или silent fallback без объяснения.
- [ ] Direct URL к restricted section и restricted write route показывает
      inline `RestrictedState`; automatic replace после access change
      показывает polite notification на valid destination.
- [ ] Route access resolution сохраняет typed denial reason/requested
      destination/recovery path, а unknown route остаётся отдельным outcome.
- [ ] Доступные navigation sections продолжают определяться session contract.
- [ ] Permission-restricted controls не появляются как неработающие.
- [ ] Recovery action ведёт на route, реально доступный текущему пользователю.
- [ ] Для SuperAdministrator `Finance` отсутствует в navigation/overflow, а direct `/finance` объясняет backend permission restriction.
- [ ] Existing non-regression: HeadCoach и peer SuperAdministrator отображаются read-only; UI не предлагает запрещённые mutation actions.
- [ ] Existing non-regression: SuperAdministrator не может выбрать
      `SuperAdministrator` в create-role options, если backend не передал эту
      роль.

## Test checklist
- [ ] Unit tests typed route access resolution: allowed, restricted read,
      restricted write, not-found и valid recovery selection.
- [ ] E2E direct `/groups` для Coach, `/clients/new` без manage permission и
      automatic redirect после access/session change.
- [ ] E2E SuperAdministrator: `/finance` restriction, protected staff targets и backend-provided create role options.
- [ ] E2E проверяет destination и видимую/announced feedback.
- [ ] Проверить обязательные responsive/compact-height размеры.
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:unit`

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: frontend navigation/feedback change, которое должно строго отражать существующий backend session contract.

## Related tasks
- `TASK-087`: schedule scope может использовать scoped empty state, но реализуется независимо.

## Source notes
- Source: usability audit of the fully rebuilt and seeded local stand.
- Evidence date: 2026-07-25.

## Visual comparison
- [Сейчас / после](../../mockups/usability-2026-07-25/TASK-088-comparison.png)
- [Описание преимуществ и границ макета](../../mockups/usability-2026-07-25/README.md#task-088-explicit-permission-restricted-feedback)

## Processing notes

- Reviewed at: 2026-07-26 after TASK-090 was merged to `main`.
- Foundation dependency is complete: shared `RestrictedState`, notification
  and focus contracts are available.
- Revalidated against commit `3253b23`: adaptive navigation, absence of
  SuperAdministrator Finance and protected staff/create-role behavior are
  already covered baseline; path-only silent redirect and loader placeholder
  remain.
- Status remains `ready`: core scope is narrowed to typed access resolution,
  deterministic inline/redirect feedback, not-found separation and valid
  recovery destinations.

## Completion notes

- Implementation commit `2ca95efbbffe423f4e06b7586d5e3f2f18a99c5f`
  is integrated by `7c43c04b7358e3f1bd8c8731bd42d95d4b604a64`;
  `c69f47b9a91d09363577406052cf8d36633726b3` aligns downstream access
  regressions with the released feedback contract.
- Typed route outcomes now separate allowed, restricted and not-found states;
  direct denials keep inline context and automatic access loss uses one
  authorized recovery with polite feedback.
- Navigation remains driven by backend session capabilities; protected actions
  are not inferred from frontend role strings.
- Validation on 2026-07-30: frontend lint and build passed; unit tests
  `367/367`; targeted Chromium flows `46/46`; target iPhone WebKit `20/20`.
- Simulator/physical-device evidence remains unverified.
