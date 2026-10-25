// app/admin/_hooks/useConfirmDialog.ts
import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { ReviewStudent, PendingClass } from "../_lib/types";

export type ConfirmAction =
  | { kind: "delete-student"; id: string }
  | { kind: "delete-teacher"; id: string; name: string }
  | { kind: "delete-class"; id: string; name: string }
  | { kind: "force-delete-subject"; id: string; name: string }
  | { kind: "reopen-student"; enrolmentId: string; termId: string; name: string }
  | { kind: "approve-all"; termId: string; count: number }
  | { kind: "reset-password"; id: string; name: string };

export function describeConfirm(
  action: ConfirmAction,
  bulkComment: string
): {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
} {
  switch (action.kind) {
    case "delete-student":
      return {
        title: "Delete this student?",
        description: "Their enrolment and any scores recorded for them will be removed. This can't be undone.",
        confirmLabel: "Delete",
        destructive: true,
      };
    case "delete-teacher":
      return {
        title: "Delete this teacher?",
        description: "Their account and any class assignments will be removed. This can't be undone.",
        confirmLabel: "Delete",
        destructive: true,
      };
    case "delete-class":
      return {
        title: "Delete this class?",
        description: "Students and teachers in this class will be unassigned. This can't be undone.",
        confirmLabel: "Delete",
        destructive: true,
      };
    case "force-delete-subject":
      return {
        title: `Delete "${action.name}"?`,
        description: "This subject is used in classes and has recorded scores. Deleting it will remove those scores. This can't be undone.",
        confirmLabel: "Delete Anyway",
        destructive: true,
      };
    case "reopen-student":
      return {
        title: "Send this result back?",
        description: `${action.name}'s result will return to draft so the teacher can edit it again.`,
        confirmLabel: "Send Back",
        destructive: true,
      };
    case "approve-all":
      return {
        title: "Approve all submitted results?",
        description: `You're about to approve ${action.count} submitted result${action.count === 1 ? "" : "s"}.` +
          (bulkComment ? `\n\nHead teacher comment: "${bulkComment}"` : ""),
        confirmLabel: "Approve All",
        destructive: false,
      };
    case "reset-password":
      return {
        title: "Reset this person's password?",
        description: `${action.name} will be signed out and given a new passcode. Their current password will stop working immediately. This cannot be undone.`,
        confirmLabel: "Reset Password",
        destructive: true,
      };
  }
}

interface UseConfirmDialogProps {
  callAdminApi: (action: string, payload: any) => Promise<any>;
  dataRefresh: () => Promise<void>;
  approvals: any; // We type this as any for now to avoid importing the whole hook type
  bulkComment: string;
  setCreatedCredentials: (creds: any) => void;
}

export function useConfirmDialog({
  callAdminApi,
  dataRefresh,
  approvals,
  bulkComment,
  setCreatedCredentials,
}: UseConfirmDialogProps) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const askConfirm = useCallback((action: ConfirmAction) => {
    setConfirmAction(action);
  }, []);

  const runConfirm = async () => {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      switch (confirmAction.kind) {
        case "delete-student":
          await callAdminApi("delete-student", { id: confirmAction.id });
          await dataRefresh();
          toast.success("Student deleted.");
          break;
        case "delete-teacher":
          await callAdminApi("delete-teacher", { id: confirmAction.id });
          await dataRefresh();
          toast.success("Teacher deleted.");
          break;
        case "delete-class":
          await callAdminApi("delete-class", { id: confirmAction.id });
          await dataRefresh();
          toast.success("Class deleted.");
          break;
        case "force-delete-subject":
          await callAdminApi("delete-subject", { id: confirmAction.id, force: true });
          await dataRefresh();
          toast.success(`"${confirmAction.name}" deleted.`);
          break;
        case "reopen-student":
          await callAdminApi("reopen-student", {
            enrolmentId: confirmAction.enrolmentId,
            termId: confirmAction.termId,
          });
          approvals.setReviewStudents((prev: ReviewStudent[]) =>
            prev.map((s: ReviewStudent) =>
              s.enrolmentId === confirmAction.enrolmentId ? { ...s, status: "draft", approvedAt: null } : s
            )
          );
          toast.success("Result sent back to teacher.");
          break;
        case "approve-all":
          const toApprove = approvals.reviewStudents.filter((s: ReviewStudent) => s.status === "submitted");
          for (const s of toApprove) {
            await callAdminApi("approve-student", {
              enrolmentId: s.enrolmentId,
              termId: confirmAction.termId,
              headComment: bulkComment || null,
            });
          }
          const current = approvals.pendingClasses.find((c: PendingClass) => c.classId === approvals.reviewClassId);
          if (current) {
            await approvals.openReview(current.classId, current.termId, current.sessionId);
          }
          await approvals.load();
          toast.success(`Approved ${toApprove.length} result${toApprove.length === 1 ? "" : "s"}.`);
          break;
        case "reset-password":
          const result = await callAdminApi("reset-password", { id: confirmAction.id });
          setCreatedCredentials({
            email: result.email,
            pin: result.pin,
            title: "Password Reset",
            description: `Share the new passcode with ${confirmAction.name} privately.`,
          });
          toast.success("Password reset.");
          break;
      }
      setConfirmAction(null);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setConfirmBusy(false);
    }
  };

  return {
    confirmAction,
    confirmBusy,
    askConfirm,
    runConfirm,
  };
}