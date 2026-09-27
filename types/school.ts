// ============================================================
// Users & roles
// ============================================================

export type UserRole = "admin" | "teacher" | "parent";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash?: string;
  assignedClassIds?: string[];
}

// ============================================================
// Classes & students
// ============================================================

/**
 * Registry-level class room — used by admin & teacher dashboards.
 * Does NOT carry a student list; use ClassRoomWithStudents when
 * you need the roster inline.
 */
export interface ClassRoom {
  id: string;
  name: string;
  session: string;
  session_id?: string | null;
  assignedTeacherId: string | null;
  studentIds: string[];
}

/** Registry-level student — used by admin dashboard listings. */
export interface Student {
  id: string;
  name: string;
  regNo: string;
  currentClassId: string | null;
  age?: string;
  gender?: string;
  createdAt?: string;
}

// ============================================================
// School configuration
// ============================================================

export interface SchoolConfig {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  motto: string | null;
  ca_weight: number;
  exam_weight: number;
  promotion_threshold: number;
  gate_results_on_fees: boolean;
}

export interface GradeBand {
  id: string;
  school_id: string;
  min_score: number;
  max_score: number;
  grade: string;
  remark: string;
  display_order: number;
}

// ============================================================
// Sessions, terms, enrolments
// ============================================================

export interface Session {
  id: string;
  school_id: string;
  name: string;
  is_current: boolean;
  created_at?: string;
}

export interface Term {
  id: string;
  school_id: string;
  session_id: string;
  name: string;
  sequence: number;
  days_opened: number | null;
  next_term_begins: string | null;
  is_current: boolean;
  created_at?: string;
}

export interface Enrolment {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  session_id: string;
  status: "active" | "transferred" | "withdrawn";
  created_at?: string;
}

export interface ScoreRow {
  id: string;
  enrolment_id: string;
  class_subject_id: string;
  term_id: string;
  ca_score: number | null;
  exam_score: number | null;
  sa_score: number | null;
  status: string;
}

// ============================================================
// Report card / assessment
// ============================================================

export interface Subject {
  id: number;
  sub: string;
  ca: string;
  exam: string;
  sa: string;
}

export interface ProcessedSubject {
  subject: string;
  ca: number | string;
  exam: number | string;
  tt: number | string;
  sessAvg: number | string;
  g: string;
  remark: string;
}

export interface AffectiveDomain {
  [key: string]: string;
}

export interface PsychomotorSkills {
  [key: string]: string;
}

export interface SubjectStats {
  position: number;
  highest: number;
  lowest: number;
  average: number;
}

export interface StudentPositions {
  position: number;
  classSize: number;
  total: number;
  average: number;
  subjects: Record<string, SubjectStats>;
}

export type AssessmentStatus =
  | "not_started"
  | "draft"
  | "submitted"
  | "approved"
  | "completed"; // legacy — do not use in new code

export interface StudentAssessment {
  schoolName: string;
  schoolAddress: string;
  schoolEmail: string;
  schoolPhone: string;
  daysOpened: string;
  daysPresent: string;
  daysAbsent: string;
  subjects: Subject[];
  affective: AffectiveDomain;
  psychomotor: PsychomotorSkills;
  teacherName: string;
  headTeacherName: string;
  teacherRemark: string;
  headRemark: string;
  nextTerm: string;
  promotion: string;
  classAvg: string;
  positions?: StudentPositions;
  termAverages?: Record<string, number>;
  cumulativeAverage?: number | null;
  status: AssessmentStatus;
}

/**
 * Full student object with assessment — used inside the result
 * compiler and when passing a student to it.
 */
export interface StudentWithAssessment {
  id: string;
  name: string;
  gender: "Male" | "Female" | "";
  age: string;
  assessment: StudentAssessment;
}

/** Class room with the roster embedded — used by the result compiler. */
export interface ClassRoomWithStudents {
  id: string;
  name: string;
  session: string;
  term: string;
  students: StudentWithAssessment[];
}

// ============================================================
// UI-specific helpers
// ============================================================

export interface GradeResult {
  g: string;
  remark: string;
}

export interface Summary {
  count: number;
  termAvg: string;
  finalAvg: string;
  highest: number | string;
  lowest: number | string;
  finalGrade: string;
}

export interface ToastState {
  message: string;
  type: "success" | "error" | "";
  show: boolean;
}

// ============================================================
// Data Transfer Objects (DTOs)
// ============================================================

export interface CreateClassInput {
  name: string;
  session: string;
  term: string;
  assignedTeacherId?: string | null;
}

export interface RegisterStudentInput {
  name: string;
  regNo: string;
  currentClassId?: string | null;
  gender?: string;
  age?: string;
}

export interface StudentQueryParams {
  search?: string;
  classId?: string;
  page?: number;
  limit?: number;
}