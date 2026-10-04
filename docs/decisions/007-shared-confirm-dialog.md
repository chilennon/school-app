# 007 — One shared ConfirmDialog

**Date:** October 2026
**Status:** Locked

## Context

Multiple destructive actions across the admin dashboard:
- Delete a student
- Delete a teacher
- Delete a class
- Force-delete a subject
- Reopen a student's result
- Approve all submitted results
- Reset a user's password

The initial implementation had one state variable and one `<ConfirmDialog>` per action — 7 dialogs, 7 pieces of state. Two problems:

1. **Repetition** — 7 nearly identical dialogs.
2. **A real bug** — dialogs inside `if (view === "teachers")` sections didn't render because `page.tsx` returned early. The dialog only appeared when you navigated away, which is when the view fell through to the main return.

## Decision

One state object, one dialog, one dispatcher.

```ts
type ConfirmAction =
  | { kind: "delete-student"; id: string }
  | { kind: "delete-teacher"; id: string; name: string }
  | ...;

const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

const runConfirm = async () => {
  switch (confirmAction.kind) {
    case "delete-student": await callAdminApi("delete-student", { id: confirmAction.id }); break;
    // ...
  }
};


A helper describeConfirm(action, bulkComment) maps the action kind to { title, description, confirmLabel, destructive }.

Consequences
Good:

Add a new destructive action by adding a variant to the type + a case to describeConfirm + a case to runConfirm. No state, no JSX.

The dialog is mounted once at the bottom of the single return. Works from any view.

No early-return bug possible — the dialog can't be inside a branch.

Costs:

One dispatcher function is slightly less readable than one handler per action. Acceptable trade.

Related: page.tsx uses a single return with {view === "teachers" && <TeachersSection .../>} blocks, not early returns. This is required for the pattern to work. Don't add early returns unless the whole page replaces itself (e.g. roll call, compiler).