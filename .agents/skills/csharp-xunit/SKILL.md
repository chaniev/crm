---
name: csharp-xunit
description: Use when creating, reviewing, or substantially restructuring xUnit tests in backend/tests/GymCrm.Tests for CRM domain behavior, ASP.NET Core endpoints, authorization, persistence, integration boundaries, regression fixes, or asynchronous C# code. Use for xUnit mechanics and test structure, while deriving behavior from existing CRM contracts and project conventions.
---

# C# xUnit Testing

Create durable behavior tests that follow the existing backend test suite.

## Establish the contract

1. Read the root and `backend/AGENTS.md`.
2. Inspect the changed entry point, application flow, authorization boundary,
   persistence behavior, and nearby tests.
3. Derive expected behavior from production contracts and confirmed regression
   risk, not from private implementation details.
4. Reuse existing fixtures, factories, test host, database setup, naming, and
   assertion style.

Do not introduce a second assertion, mocking, fixture, or data-generation
library without a demonstrated gap.

## Select coverage

Cover the smallest set that proves the changed contract:

- one valid path;
- one invalid or failure path;
- negative authorization and access-scope behavior when affected;
- serialization, validation, and `ProblemDetails` behavior at API boundaries;
- transaction, concurrency, duplicate submission, or idempotency behavior
  when relevant;
- date, timezone, sorting, filtering, and pagination boundaries when touched;
- a regression test that fails for the original defect.

Use `[Theory]` only when multiple inputs prove the same behavior contract.
Prefer named test cases or readable data sources over opaque positional data.

## Keep tests reliable

- Await asynchronous operations; never block with `.Result` or `.Wait()`.
- Propagate cancellation where the tested contract supports it.
- Avoid shared mutable state and order-dependent tests.
- Make time, identifiers, and test data deterministic.
- Assert observable outcomes and material side effects.
- Keep fixture scope no broader than required.
- Do not weaken production validation or bypass authorization solely to make
  setup easier.
- Do not remove or rewrite unrelated tests to make a change pass.

## Validate

Run the narrowest relevant test filter first, then:

```text
dotnet test backend/GymCrm.slnx
```

Return:

- behavior contract covered;
- tests added or changed;
- reason for Fact, Theory, fixture, or integration-test choices;
- exact commands and results;
- failure, authorization, persistence, or environment boundaries not covered;
- remaining regression risk.
