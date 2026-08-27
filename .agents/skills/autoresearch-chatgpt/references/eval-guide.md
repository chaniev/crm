# Binary eval guide

Use this guide when defining or repairing the eval suite.

## Write observable checks

Each eval must contain:

```text
EVAL <id>: <short name>
Question: <yes/no question about one output>
Pass: <specific observable evidence>
Fail: <specific counter-evidence>
Method: <command, parser, rubric, or blind semantic scorer>
Applies to: <all prompts or listed prompt IDs>
```

Good checks are binary, distinct, relevant to the user's goal, and likely to be scored the same way by two independent evaluators.

## Prefer the strongest evidence

Use evidence in this order:

1. Executed test, parser, schema, or validator.
2. Deterministic inspection such as file existence, exact fields, or forbidden tokens.
3. Evidence-based semantic judgment with explicit pass and fail anchors.
4. Subjective judgment only when the quality itself is subjective and no observable proxy is honest.

Do not let a semantic scorer infer that code works when it can be executed. Preserve the command output or other evidence with the score.

## Avoid weak evals

Rewrite checks such as:

- "Is it good/professional/engaging?"
- "Rate it from 1 to 10."
- "Does it follow best practices?"
- "Would a user like it?"

Prefer:

- "Does the output include every required section: A, B, and C?"
- "Does the generated project pass the specified test command?"
- "Does every factual claim include a source URL or supplied-file citation?"
- "Does the response avoid all phrases in the supplied banned list?"

## Prevent gaming and overfitting

- Test outcomes, not arbitrary wording.
- Avoid exact counts unless the count is a real product requirement.
- Keep evals independent; do not count the same defect twice.
- Include negative or edge-case prompts.
- Reserve at least one prompt for holdout validation when the dataset permits.
- Freeze evals before candidate mutations.
- Keep the trial runner blind to eval answers and previous failures.
- Reject improvements that trade away an important non-scored invariant; add the missing invariant and restart the baseline if necessary.

## Sanity-check every eval

Ask:

1. Would two independent scorers agree?
2. Can the skill pass without genuinely improving?
3. Does the check represent something the user cares about?
4. Can it be executed instead of judged?
5. Is it applicable to every prompt it will score?

If any answer exposes ambiguity, repair the eval before running the baseline.
