export interface ClassInfo {
  id: string;
  name: string;
  session: string;
  session_id: string | null;
}

export interface TermInfo {
  id: string;
  name: string;
  sequence: number;
  is_current: boolean;
}

export interface StudentInfo {
  id: string;
  name: string;
  reg_no: string;
  gender?: string;
  age?: string;
  enrolment_id: string;
  assessment?: any;
}

export interface CatalogSubject {
  id: string;
  name: string;
}

export type ClassStatus = "draft" | "submitted" | "approved" | "mixed";

export type MobileTab = "home" | "scores" | "profile";