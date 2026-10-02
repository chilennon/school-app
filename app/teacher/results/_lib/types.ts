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

export interface ToastState {
  message: string;
  type: "success" | "error" | "";
  show: boolean;
}

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
  status: "not_started" | "draft" | "submitted" | "approved" | "completed";
}

export interface ResultsPageProps {
  initialStudent: {
    id: string;
    name: string;
    reg_no?: string;
    gender?: string;
    age?: string;
    assessment?: Partial<StudentAssessment> | null;
  };
  initialClass: {
    id: string;
    name: string;
    session: string;
    students?: any[];
    studentIds?: string[];
  };
  term: string;
  availableSubjects?: { id: string; name: string }[];
  onAddSubject?: (
    subjectId: string,
    subjectName: string,
  ) => Promise<string | null>;
  onSaveDraft?: (updatedStudent: any) => void | Promise<void>;
  onComplete?: (updatedStudent: any) => void | Promise<void>;
  onExit?: () => void;
  readOnly?: boolean;
}

/**
 * Shape of the compiler's editable form state.
 * Grouped by concern so the whole form can be reset or hydrated in one call.
 */
export interface CompilerForm {
  // School
  schoolName: string;
  schoolAddress: string;
  schoolEmail: string;
  schoolPhone: string;
  // Student
  studentName: string;
  studentId: string;
  sex: string;
  age: string;
  className: string;
  session: string;
  term: string;
  classAvg: string;
  // Attendance
  daysOpened: string;
  daysPresent: string;
  daysAbsent: string;
  // Traits
  affective: AffectiveDomain;
  psychomotor: PsychomotorSkills;
  // Remarks
  teacherName: string;
  headTeacherName: string;
  teacherRemark: string;
  headRemark: string;
  nextTerm: string;
  promotion: string;
  // Hydrated-only (never edited by user)
  positions?: StudentPositions;
  termAverages: Record<string, number>;
  cumulativeAverage: number | null;
}