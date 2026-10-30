/**
 * Dexie schema for Phase 1 offline data layer.
 * See docs/specs/offline-dexie.md for the authoritative contract.
 */
import Dexie, { type Table } from "dexie";

// ---------------------------------------------------------------------------
// Reference tables (read-only; pulled; never written locally)
// ---------------------------------------------------------------------------
export interface School {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  motto: string | null;
  ca_weight: number;
  exam_weight: number;
  promotion_threshold: number;
  gate_results_on_fees: boolean;
  school_type: string;
  logo_url: string | null;
  deleted_at: string | null;
}

export interface Session {
  id: string;
  school_id: string;
  name: string;
  is_current: boolean;
  deleted_at: string | null;
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
  deleted_at: string | null;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  display_order: number;
  deleted_at: string | null;
}

export interface GradeBand {
  id: string;
  school_id: string;
  min_score: number;
  max_score: number;
  grade: string;
  remark: string;
  display_order: number;
  deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// Sync tables (written via outbox)
// ---------------------------------------------------------------------------
interface SyncMeta {
  server_updated_at: string;
  client_updated_at: string | null;
  client_mutation_id: string | null;
  deleted_at: string | null;
}

export interface ClassRoom extends SyncMeta {
  id: string;
  school_id: string;
  teacher_id: string | null;
  name: string;
  session: string;
  session_id: string | null;
  created_at: string;
}

export interface ClassSubject extends SyncMeta {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  staff_id: string | null;
  session_id: string;
  created_at: string | null;
}

export interface Enrolment extends SyncMeta {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  session_id: string;
  status: "active" | "inactive" | "graduated";
  created_at: string | null;
}

export interface Student extends SyncMeta {
  id: string;
  school_id: string;
  name: string;
  reg_no: string;
  class_id: string | null;
  gender: string | null;
  age: string | null;
  assessment: Record<string, unknown> | null;
  family_id: string | null;
  created_at: string;
}

export interface Score extends SyncMeta {
  id: string;
  school_id: string;
  enrolment_id: string;
  class_subject_id: string;
  term_id: string;
  ca_score: number | null;
  exam_score: number | null;
  sa_score: number | null;
  status: "draft" | "submitted" | "approved";
  device_id: string | null;
  device_updated_at: string | null;
  created_at: string | null;
}

export interface TraitRating extends SyncMeta {
  id: string;
  school_id: string;
  enrolment_id: string;
  term_id: string;
  trait_key: string;
  trait_domain: "affective" | "psychomotor";
  rating: number | null;
}

export interface TermRecord extends SyncMeta {
  id: string;
  school_id: string;
  enrolment_id: string;
  term_id: string;
  days_opened: number | null;
  days_present: number | null;
  days_absent: number | null;
  class_teacher_comment: string | null;
  head_teacher_comment: string | null;
  approved_by: string | null;
  approved_at: string | null;
  release_override: boolean | null;
  override_by: string | null;
  status: "draft" | "submitted" | "approved";
}

export interface AttendanceLog extends SyncMeta {
  id: string;
  school_id: string;
  enrolment_id: string;
  date: string; // 'YYYY-MM-DD'
  status: "present" | "absent";
  recorded_by: string;
  recorded_at: string;
}

// ---------------------------------------------------------------------------
// Infrastructure tables
// ---------------------------------------------------------------------------
export type OutboxStatus = "pending" | "in_flight" | "failed" | "rejected";

/**
 * Every table an outbox row may target.
 *
 * "term_result" is synthetic: it never corresponds to a Dexie table of its
 * own. One row of this type carries the whole atomic payload for
 * scores + trait_ratings + term_records + students for a single
 * (enrolment, term) pair, and is unpacked server-side by
 * apply_term_result_atomic. See app/api/sync-push/route.ts.
 */
export type OutboxTableName =
  | "classes"
  | "class_subjects"
  | "enrolments"
  | "students"
  | "scores"
  | "trait_ratings"
  | "term_records"
  | "attendance_logs"
  | "term_result";

export interface OutboxEntry {
  id: string;
  school_id: string;
  user_id: string;
  table_name: OutboxTableName;
  match_key: string;
  payload: Record<string, unknown>;
  client_updated_at: string;
  created_at: string;
  status: OutboxStatus;
  attempts: number;
  last_error: string | null;
  rejected_reason: string | null;
}

export interface Meta {
  key: string;
  value: unknown;
}

export const META_KEYS = {
  USER_ID: "user_id",
  SCHOOL_ID: "school_id",
  ROLE: "role",
  INSTALLED_AT: "installed_at",
  LAST_SYNCED_AT: "last_synced_at",
  CURRENT_SESSION_ID: "current_session_id",
  DB_VERSION: "db_version",
  CURSOR_PREFIX: "cursor.",
  LOCK_OWNER: "lock.owner",
  LOCK_ACQUIRED_AT: "lock.acquired_at",
} as const;

// ---------------------------------------------------------------------------
// Dexie database definition
// ---------------------------------------------------------------------------
const DB_NAME_PREFIX = "naijaschool_db";

export function dbNameFor(schoolId: string, userId: string): string {
  return `${DB_NAME_PREFIX}_${schoolId}_${userId}`;
}

export class NaijaSchoolDB extends Dexie {
  schools!: Table<School, string>;
  sessions!: Table<Session, string>;
  terms!: Table<Term, string>;
  subjects!: Table<Subject, string>;
  grade_bands!: Table<GradeBand, string>;

  classes!: Table<ClassRoom, string>;
  class_subjects!: Table<ClassSubject, string>;
  enrolments!: Table<Enrolment, string>;
  students!: Table<Student, string>;
  scores!: Table<Score, string>;
  trait_ratings!: Table<TraitRating, string>;
  term_records!: Table<TermRecord, string>;
  attendance_logs!: Table<AttendanceLog, string>;

  outbox!: Table<OutboxEntry, string>;
  meta!: Table<Meta, string>;

  constructor(name: string) {
    super(name);

    this.version(1).stores({
      schools: "id",
      sessions: "id, school_id, is_current",
      terms: "id, session_id, [session_id+sequence]",
      subjects: "id, school_id, [school_id+display_order]",
      grade_bands: "id, school_id, [school_id+display_order]",

      classes: "id, school_id, teacher_id, [school_id+teacher_id], deleted_at, server_updated_at",
      class_subjects: "id, class_id, session_id, [class_id+session_id], deleted_at, server_updated_at",
      enrolments: "id, class_id, student_id, session_id, status, [class_id+session_id], [student_id+session_id], deleted_at, server_updated_at",
      students: "id, school_id, name, deleted_at, server_updated_at",
      scores: "id, enrolment_id, class_subject_id, term_id, [enrolment_id+term_id], [enrolment_id+class_subject_id+term_id], deleted_at, server_updated_at",
      trait_ratings: "id, enrolment_id, term_id, [enrolment_id+term_id], [enrolment_id+term_id+trait_domain+trait_key], deleted_at, server_updated_at",
      term_records: "id, enrolment_id, term_id, status, [enrolment_id+term_id], deleted_at, server_updated_at",
      attendance_logs: "id, enrolment_id, date, [enrolment_id+date], deleted_at, server_updated_at",

      outbox: "id, status, created_at, [status+created_at], [table_name+match_key]",
      meta: "key",
    });
  }
}

export async function openDb(schoolId: string, userId: string): Promise<NaijaSchoolDB> {
  const db = new NaijaSchoolDB(dbNameFor(schoolId, userId));
  await db.open();
  return db;
}

export async function wipeDb(db: NaijaSchoolDB): Promise<void> {
  await db.delete();
}

export async function getCursor(db: NaijaSchoolDB, table: string): Promise<string | null> {
  const row = await db.meta.get(META_KEYS.CURSOR_PREFIX + table);
  return (row?.value as string | undefined) ?? null;
}

export async function setCursor(db: NaijaSchoolDB, table: string, cursor: string | null): Promise<void> {
  await db.meta.put({ key: META_KEYS.CURSOR_PREFIX + table, value: cursor });
}

export async function getOutboxStatus(db: NaijaSchoolDB): Promise<{
  pending: number;
  failed: number;
  rejected: number;
  inFlight: number;
}> {
  const [pending, failed, rejected, inFlight] = await Promise.all([
    db.outbox.where("status").equals("pending").count(),
    db.outbox.where("status").equals("failed").count(),
    db.outbox.where("status").equals("rejected").count(),
    db.outbox.where("status").equals("in_flight").count(),
  ]);
  return { pending, failed, rejected, inFlight };
}