# TASK-104 attendance workbench visual prompt

Mode: built-in `image_gen`

Reference images:
- `/backlog/processed/assets/2026-08-02-usability-audit/mobile-attendance-390x844.png`
- `/backlog/processed/assets/2026-08-02-usability-audit/mobile-attendance-landscape-912x420.png`

## Final prompt

```text
Use case: ui-mockup
Asset type: implementation-ready CRM responsive screen concept board for TASK-104
Input images: Image 1 is the current 390×844 portrait screen style reference; Image 2 is the current 912×420 landscape screen style reference. Preserve their K-4PRO visual system, Onest-like typography, warm off-white page, white cards, dark charcoal text, muted green active accents, thin gray borders, rounded 10–20px surfaces, restrained shadows, and existing navigation icon style. Generate the AFTER state, not a before/after comparison.

GOAL
Create a high-fidelity realistic product UI mockup showing how the attendance workbench looks after TASK-104. The first client attendance action must be visible without scrolling. Remove the repeated large roster header that currently repeats group name, schedule metadata, and date. Keep one compact workbench header only.

FORMAT
One polished landscape design board, approximately 3:2 aspect ratio, with two clearly separated artboards on a neutral light canvas:
- left: full 390×844 portrait mobile screen, shown large
- right: full 912×420 compact-height mobile landscape screen, shown wide
Small external captions above artboards: “390 × 844 · portrait” and “912 × 420 · compact landscape”.
No annotations, arrows, red boxes, device hardware frames, marketing copy, or explanatory paragraphs.

PORTRAIT ARTBOARD — EXACT HIERARCHY
1. Existing white K-4PRO app header with circular green brand mark, exact text “K-4PRO”, and profile chevron button.
2. Existing tabs: “Посещения” active with green underline; “Требуют внимания” with gray badge “0”.
3. One compact white attendance workbench surface, no duplicate title card:
   - visible label “Группа”
   - select value exactly “Боевое самбо группа 04 — Филиал Центр”
   - visible label “Дата тренировки”
   - full date input exactly “02.08.2026”
   - three separate 44×44 controls with at least 8px gaps: previous chevron, today calendar icon, next chevron; today may be icon-only
   - one compact tools row: progress exactly “0/7 отмечено” with a thin progress indicator; compact segmented control “Не отмечено” / “Все” with “Не отмечено” selected; 44×44 refresh icon button
4. Immediately after the workbench, an unframed roster containing the first white client card:
   - avatar, exact name “Анна Васильева”
   - no benign helper sentence such as attendance availability
   - one full-width primary status row with three clear 44px-tall radio-card buttons: “Не отмечено” selected, “Был”, “Не был”
   - all three status controls fully visible above the fixed bottom navigation
5. Fixed white bottom navigation respecting safe-area spacing, matching the reference: “Главная” active in green, “Расписание”, “Клиенты”, “Группы”, “Ещё”. Keep labels legible and not clipped.

COMPACT LANDSCAPE ARTBOARD — EXACT HIERARCHY
This is a touch/mobile compact-height layout, not a desktop sidebar layout. Hide the side navigation. Show:
1. Slim K-4PRO top header.
2. Tabs “Посещения” active and “Требуют внимания” with badge “0”.
3. A single-row or tightly two-row compact workbench surface:
   - group field with full readable value “Боевое самбо группа 04 — Филиал Центр”
   - date field with fully readable “02.08.2026”, never a blank square
   - previous, today, next 44×44 controls
   - compact “0/7 отмечено”, “Не отмечено / Все”, and refresh
4. First client row directly below: “Анна Васильева” on the left, three status controls “Не отмечено”, “Был”, “Не был” on the right, visible above navigation.
5. Fixed compact bottom navigation across the bottom; no sidebar, no horizontal overflow, no nested scrolling.

TYPE SYSTEM
Onest-like modern sans serif. Strong 700–800 weight for selected values and client name, 600 for labels/actions, 400–500 for secondary text. Russian text must be crisp, correctly spelled, and rendered verbatim.

COLOR + MATERIAL
Warm off-white background, pure white controls/cards, charcoal text, forest/muted green active state, pale green selected status, cool light-gray neutral states, subtle sand tint only for separators. Restrained practical CRM styling, not glassmorphism.

CONSTRAINTS
- Practical shippable Mantine-style interface, not concept art.
- Preserve only one visible group/date context; do not repeat group title, schedule, client count, or date badge below the workbench.
- First status action is the visual operational priority.
- Every icon button and status target looks at least 44×44.
- Full date is legible in both artboards.
- No horizontal scrolling cues.
- No extra widgets, stats cards, charts, illustrations, photos, tooltips, floating action buttons, or sticky attendance action bars.
- No route/navigation redesign beyond compact landscape using bottom navigation.
- No backend or permission concepts shown.
- No watermark.
- No gibberish, duplicate, or extra text beyond specified UI labels and existing K-4PRO navigation.
```
