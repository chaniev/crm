# Gym CRM agents (TOML)

Набор локальных TOML-конфигов для работы с Codex или другим локальным раннером, где удобно хранить системные промпты и шаблоны входных данных отдельно.

## Что внутри

- `agents/00-orchestrator.toml` — главный агент, который принимает ТЗ целиком и собирает общее решение
- `agents/10-ux-admin-workspace.toml` — UX для администратора
- `agents/11-ux-trainer-workspace.toml` — UX для тренера
- `agents/20-ux-critic.toml` — критик UX-решений
- `agents/30-ui-dashboard-designer.toml` — UI агент
- `agents/40-design-system.toml` — дизайн-система и палитра
- `agents/50-react-frontend.toml` — frontend-архитектура под React
- `templates/project-requirements-template.md` — шаблон ТЗ

## Как использовать

1. Заполни `templates/project-requirements-template.md`.
2. Передай итоговый текст как `full_requirements` в orchestrator или напрямую в отдельные агентные конфиги.
3. Запускай цепочку:
   - admin UX
   - trainer UX
   - UX critic
   - UI
   - design system
   - frontend
4. Либо прогоняй всё через orchestrator.

## Рекомендуемый порядок

### Вариант 1 — через orchestrator
Подходит, если у тебя есть обвязка, которая умеет:
- читать TOML
- подставлять шаблонные переменные
- прокидывать результаты между агентами

### Вариант 2 — вручную в Codex CLI
Открой нужный `.toml`, возьми значение `prompt.system`, затем подставь шаблон `user_template.content` и вставь туда своё ТЗ.

## Что важно понимать

Эти TOML-файлы — универсальные конфиги с системными промптами и шаблонами. Они **не завязаны на конкретный официальный формат Codex CLI**, потому что формат локальной оркестрации у всех обычно свой.

Если тебе нужен следующий шаг, я могу подготовить ещё и:
- единый `agents.toml`
- bash/python раннер, который читает эти TOML и прогоняет цепочку автоматически
- версию под конкретную структуру твоего проекта
