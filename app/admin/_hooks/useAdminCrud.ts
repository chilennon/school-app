// app/admin/_hooks/useAdminCrud.ts
import { toast } from "sonner";
import type { ConfirmAction } from "./useConfirmDialog";

interface UseAdminCrudProps {
  callAdminApi: (action: string, payload: any) => Promise<any>;
  dataRefresh: () => Promise<void>;
  askConfirm: (action: ConfirmAction) => void;
}

export function useAdminCrud({ callAdminApi, dataRefresh, askConfirm }: UseAdminCrudProps) {
  
  // ── STUDENTS ──
  const handleSaveStudent = async (input: any) => {
    const action = input.id ? "update-student" : "create-student";
    await callAdminApi(action, {
      id: input.id,
      name: input.name,
      reg_no: input.regNo,
      class_id: input.classId || null,
      family_id: input.familyId || null,
      gender: input.gender,
      age: input.age,
    });
    await dataRefresh();
    toast.success(input.id ? "Student updated." : "Student added.");
  };

  const askDeleteStudent = (id: string) => askConfirm({ kind: "delete-student", id });

  // ── TEACHERS ──
  const handleCreateTeacher = async (name: string, email: string) => {
    try {
      const result = await callAdminApi("create-teacher", { name, email });
      await dataRefresh();
      toast.success("Teacher account created.");
      return result; // Return to let the UI set createdCredentials
    } catch (err: any) {
      toast.error(err.message || "Couldn't create teacher");
      throw err;
    }
  };

  const handleUpdateTeacher = async (id: string, name: string, email: string) => {
    try {
      await callAdminApi("update-teacher", { id, name, email });
      await dataRefresh();
      toast.success("Teacher updated.");
    } catch (err: any) {
      toast.error(err.message || "Couldn't update teacher");
    }
  };

  const askDeleteTeacher = (id: string, name: string) => askConfirm({ kind: "delete-teacher", id, name });

  // ── ADMINS ──
  const handleCreateAdmin = async (name: string, email: string) => {
    try {
      const result = await callAdminApi("create-admin", { name, email });
      await dataRefresh();
      toast.success("Admin account created.");
      return result;
    } catch (err: any) {
      toast.error(err.message || "Couldn't create admin");
      throw err;
    }
  };

  const askResetPassword = (id: string, name: string) => askConfirm({ kind: "reset-password", id, name });

  // ── SUBJECTS ──
  const handleAddSubject = async (name: string) => {
    try {
      await callAdminApi("add-subject", { name });
      await dataRefresh();
      toast.success("Subject added.");
    } catch (err: any) {
      toast.error(err.message || "Couldn't add subject");
    }
  };

  const handleDeleteSubject = async (id: string, name: string) => {
    const first = await callAdminApi("delete-subject", { id }).catch((err) => ({
      error: err.message,
      requiresForce: true,
    }));
    if (first?.error && first?.requiresForce) {
      askConfirm({ kind: "force-delete-subject", id, name });
      return;
    }
    if (first?.error) {
      toast.error(first.error);
      return;
    }
    await dataRefresh();
    toast.success("Subject deleted.");
  };

  // ── CLASSES ──
  const handleSaveClass = async (input: any) => {
    try {
      if (input.id) {
        await callAdminApi("update-class", {
          id: input.id,
          name: input.name,
          session: input.session,
        });
        await callAdminApi("set-class-subjects", {
          classId: input.id,
          subjectIds: input.subjectIds,
        });
      } else {
        await callAdminApi("create-class", {
          name: input.name,
          session: input.session,
          subject_ids: input.subjectIds,
        });
      }
      await dataRefresh();
      toast.success(input.id ? "Class updated." : "Class created.");
    } catch (err: any) {
      toast.error(err.message || "Couldn't save class");
    }
  };

  const askDeleteClass = (id: string, name: string) => askConfirm({ kind: "delete-class", id, name });

  const handleAssignTeacher = async (classId: string, teacherId: string) => {
    try {
      await callAdminApi("assign-teacher", { classId, teacherId: teacherId || null });
      await dataRefresh();
    } catch (err: any) {
      toast.error(err.message || "Couldn't assign teacher");
    }
  };

  // ── APPROVALS ──
  const handleApproveStudent = async (enrolmentId: string, termId: string, comment: string) => {
    try {
      await callAdminApi("approve-student", { enrolmentId, termId, headComment: comment || null });
      toast.success("Result approved.");
      return true;
    } catch (err: any) {
      toast.error(err.message || "Couldn't approve result");
      return false;
    }
  };

  const askReopenStudent = (enrolmentId: string, termId: string, name: string) => 
    askConfirm({ kind: "reopen-student", enrolmentId, termId, name });
    
  const askApproveAll = (termId: string, count: number) => 
    askConfirm({ kind: "approve-all", termId, count });

  return {
    handleSaveStudent,
    askDeleteStudent,
    handleCreateTeacher,
    handleUpdateTeacher,
    askDeleteTeacher,
    handleCreateAdmin,
    askResetPassword,
    handleAddSubject,
    handleDeleteSubject,
    handleSaveClass,
    askDeleteClass,
    handleAssignTeacher,
    handleApproveStudent,
    askReopenStudent,
    askApproveAll,
  };
}