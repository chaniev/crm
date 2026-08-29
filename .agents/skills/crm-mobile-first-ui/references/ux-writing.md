# CRM UX writing

Use for labels, instructions, validation, errors, confirmations, empty states,
notifications, and recovery copy.

## Preserve product vocabulary

- Inspect nearby Russian copy and use one term for one CRM concept throughout a
  flow.
- Preserve backend-provided validation and permission reasons. Clarify their
  presentation without inventing a different rule.
- Prefer plain, short language that a busy coach or administrator understands
  on the first pass.
- Use sentence case unless an established component convention requires
  otherwise.

## Actions and confirmations

- Start action labels with a verb that names the operation.
- Avoid `OK`, `Yes`, `No`, and playful copy for consequential actions.
- A destructive confirmation repeats the affected entity and consequence; its
  confirm button names that consequence.
- Keep one progression vocabulary within a multi-step flow.
- Match input-neutral wording when the same interface supports touch and
  pointer; prefer `select` over device-specific instructions when possible.

## Errors and recovery

- Place the message beside the failed field, action, or state surface.
- State what failed, what remains preserved, and the next recovery action when
  those facts are known.
- Use calm, direct language. Data loss, access, and security copy is explicit
  and never playful.
- Do not expose internal exception wording unless it is an intentional public
  ProblemDetails detail.
- Success feedback names the affected entity or operation and does not mask
  partial or stale completion.

## Localization and layout

- Do not concatenate sentence fragments around variables. Use complete
  localized templates and correct pluralization.
- Validate longer translations, names, numbers, and unbroken content.
- Never use truncation to hide a consequence, validation reason, or recovery
  instruction.
- Placeholder is an example or hint, not a persistent field label or
  accessible name.
