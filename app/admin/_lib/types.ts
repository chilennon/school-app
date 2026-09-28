export interface SubjectRow {
  id: string;
  name: string;
  display_order: number;
}

export interface PendingClass {
  classId: string;
  className: string;
  sessionName: string;
  termLabel: string;
  termId: string;
  sessionId: string;
  submittedCount: number;
  approvedCount: number;
  totalStudents: number;
}

export interface ReviewStudent {
  enrolmentId: string;
  name: string;
  regNo: string;
  status: string;
  comment: string;
  approvedAt: string | null;
}

export type AdminView =
  | "home"
  | "students"
  | "approvals"
  | "more"
  | "teachers"
  | "subjects"
  | "classes"
  | "settings";