"use client";

import React, { useState, useCallback, useEffect } from "react";
import "./SchoolResult.css";
import { useSchoolConfig } from "@/hooks/useSchoolConfig";
import { generateSingleReportCard } from "@/lib/reportCardPdf";

// ── TYPES & INTERFACES ──
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

export interface Student {
  id: string;
  name: string;
  gender: "Male" | "Female" | "";
  age: string;
  assessment: StudentAssessment;
}

export interface ClassRoom {
  id: string;
  name: string;
  session: string;
  students: Student[];
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
    students?: Student[];
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
  readOnly?: boolean;
}

export default function ResultsPage({
  initialStudent,
  initialClass,
  term: initialTerm,
  availableSubjects = [],
  onAddSubject,
  onSaveDraft,
  onComplete,
  readOnly = false,
}: ResultsPageProps) {
  const { config, gradeBands, gradeFor } = useSchoolConfig();

  // Position state
  const [studentPosition, setStudentPosition] = useState<number | null>(null);
  const [classSize, setClassSize] = useState<number | null>(null);
  const [studentAverage, setStudentAverage] = useState<number | null>(null);
  const [subjectStats, setSubjectStats] = useState<
    Record<string, SubjectStats>
  >({});
  const [termAverages, setTermAverages] = useState<Record<string, number>>({});
  const [cumulativeAverage, setCumulativeAverage] = useState<number | null>(
    null,
  );

  // Form state
  const [schoolName, setSchoolName] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [schoolPhone, setSchoolPhone] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [sex, setSex] = useState("");
  const [age, setAge] = useState("");
  const [className, setClassName] = useState("");
  const [session, setSession] = useState("");
  const [term, setTerm] = useState("");
  const [classAvg, setClassAvg] = useState("");

  const [daysOpened, setDaysOpened] = useState("");
  const [daysPresent, setDaysPresent] = useState("");
  const [daysAbsent, setDaysAbsent] = useState("");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [nextSubjectId, setNextSubjectId] = useState(0);

  const [affective, setAffective] = useState<AffectiveDomain>({});
  const [psychomotor, setPsychomotor] = useState<PsychomotorSkills>({});

  const [teacherName, setTeacherName] = useState("");
  const [headTeacherName, setHeadTeacherName] = useState("");
  const [teacherRemark, setTeacherRemark] = useState("");
  const [headRemark, setHeadRemark] = useState("");
  const [nextTerm, setNextTerm] = useState("");
  const [promotion, setPromotion] = useState("");

  const [toast, setToast] = useState<ToastState>({
    message: "",
    type: "",
    show: false,
  });

  const caWeight = config?.ca_weight ?? 40;
  const examWeight = config?.exam_weight ?? 60;

  // ── HYDRATE FROM PROPS ──
  useEffect(() => {
    if (!initialStudent || !initialClass) return;

    setStudentName(initialStudent.name || "");
    setStudentId(initialStudent.reg_no || initialStudent.id || "");
    setSex(initialStudent.gender || "");
    setAge(initialStudent.age || "");
    setClassName(initialClass.name || "");
    setSession(initialClass.session || "");
    setTerm(initialTerm || "");

    const asm = initialStudent.assessment || {};
    setSchoolName(asm.schoolName || config?.name || "");
    setSchoolAddress(asm.schoolAddress || config?.address || "");
    setSchoolEmail(asm.schoolEmail || "");
    setSchoolPhone(asm.schoolPhone || config?.phone || "");
    setClassAvg(asm.classAvg || "");
    setDaysOpened(asm.daysOpened || "");
    setDaysPresent(asm.daysPresent || "");
    setDaysAbsent(asm.daysAbsent || "");

    // Hydrate positions if present
    const pos = asm.positions;
    if (pos) {
      setStudentPosition(pos.position ?? null);
      setClassSize(pos.classSize ?? null);
      setStudentAverage(pos.average ?? null);
      setSubjectStats(pos.subjects || {});
    } else {
      setStudentPosition(null);
      setClassSize(null);
      setStudentAverage(null);
      setSubjectStats({});
    }

    setTermAverages(asm.termAverages || {});
    setCumulativeAverage(asm.cumulativeAverage ?? null);

    const subs =
      asm.subjects && asm.subjects.length > 0
        ? asm.subjects
        : Array.from({ length: 8 }, (_, i) => ({
            id: i,
            sub: "",
            ca: "",
            exam: "",
            sa: "",
          }));
    setSubjects(subs);
    setNextSubjectId(Math.max(...subs.map((s) => s.id), 0) + 1);

    setAffective(
      asm.affective || {
        a0: "",
        a1: "",
        a2: "",
        a3: "",
        a4: "",
        a5: "",
        a6: "",
        a7: "",
        a8: "",
        a9: "",
      },
    );
    setPsychomotor(
      asm.psychomotor || { p0: "", p1: "", p2: "", p3: "", p4: "", p5: "" },
    );

    setTeacherName(asm.teacherName || "");
    setHeadTeacherName(asm.headTeacherName || "");
    setTeacherRemark(asm.teacherRemark || "");
    setHeadRemark(asm.headRemark || "");
    setNextTerm(asm.nextTerm || "");
    setPromotion(asm.promotion || "");
  }, [initialStudent, initialClass, initialTerm, config]);

  // ── SAVE ──
  const handleSaveDraft = async (markCompleted = false) => {
    if (!initialStudent || !initialClass) return;

    const updatedAssessment: StudentAssessment = {
      schoolName,
      schoolAddress,
      schoolEmail,
      schoolPhone,
      daysOpened,
      daysPresent,
      daysAbsent,
      subjects,
      affective,
      psychomotor,
      teacherName,
      headTeacherName,
      teacherRemark,
      headRemark,
      nextTerm,
      promotion,
      classAvg,
      status: markCompleted ? "completed" : "draft",
    };

    const updatedStudent = {
      ...initialStudent,
      id: initialStudent.id,
      reg_no: initialStudent.reg_no || studentId || initialStudent.id,
      name: studentName,
      gender: sex,
      age,
      assessment: updatedAssessment,
    };

    try {
      if (markCompleted) {
        await onComplete?.(updatedStudent);
      } else {
        await onSaveDraft?.(updatedStudent);
      }

      showToast(
        markCompleted
          ? "Result saved & finalized!"
          : "Draft progress saved successfully!",
        "success",
      );
    } catch (err: any) {
      console.error("Save threw:", err);
      showToast(err.message || "Save failed. Please try again.", "error");
    }
  };

  const grade = (score: number | null): GradeResult => gradeFor(score);

  // ── SUBJECT HANDLERS ──
  const removeRow = useCallback((id: number) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateSubject = useCallback(
    (id: number, field: keyof Omit<Subject, "id">, value: string) => {
      setSubjects((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
      );
    },
    [],
  );

  const calcAbsent = useCallback(() => {
    const o = parseFloat(daysOpened) || 0;
    const p = parseFloat(daysPresent) || 0;
    setDaysAbsent(Math.max(0, o - p).toString());
  }, [daysOpened, daysPresent]);

  useEffect(() => {
    calcAbsent();
  }, [daysOpened, daysPresent, calcAbsent]);

  // ── CALCULATIONS ──
  const collectSubjects = (customSubjects?: Subject[]): ProcessedSubject[] => {
    const targetSubjects = customSubjects || subjects;
    return targetSubjects
      .map((s) => {
        const ca = s.ca !== "" ? parseFloat(s.ca) : null;
        const ex = s.exam !== "" ? parseFloat(s.exam) : null;
        const sa = s.sa !== "" ? parseFloat(s.sa) : null;

        if (!s.sub && ca === null && ex === null) return null;

        const tt = ca !== null || ex !== null ? (ca || 0) + (ex || 0) : null;
        const { g, remark } = tt !== null ? grade(tt) : { g: "—", remark: "—" };

        return {
          subject: s.sub || "(Unnamed)",
          ca: ca !== null ? ca : "—",
          exam: ex !== null ? ex : "—",
          tt: tt !== null ? tt : "—",
          sessAvg: sa !== null ? sa : "—",
          g,
          remark,
        };
      })
      .filter((item): item is ProcessedSubject => item !== null);
  };

  const calculateSummary = (customSubjects?: Subject[]): Summary => {
    const subjectsData = collectSubjects(customSubjects);
    const tts = subjectsData
      .map((s) => s.tt)
      .filter((tt): tt is number => typeof tt === "number");
    const sas = subjectsData
      .map((s) => s.sessAvg)
      .filter((sa): sa is number => typeof sa === "number");

    const n = tts.length;
    if (n === 0) {
      return {
        count: 0,
        termAvg: "—",
        finalAvg: "—",
        highest: "—",
        lowest: "—",
        finalGrade: "—",
      };
    }

    const termAvg = tts.reduce((a, b) => a + b, 0) / n;
    const finalAvg = sas.length
      ? sas.reduce((a, b) => a + b, 0) / sas.length
      : termAvg;
    const { g: finalGrade } = grade(finalAvg);

    return {
      count: n,
      termAvg: termAvg.toFixed(1) + "%",
      finalAvg: finalAvg.toFixed(1) + "%",
      highest: Math.max(...tts),
      lowest: Math.min(...tts),
      finalGrade,
    };
  };

  const clearAll = () => {
    if (!window.confirm("Clear all data and start fresh for this student?"))
      return;
    setSchoolName("");
    setSchoolAddress("");
    setSchoolEmail("");
    setSchoolPhone("");
    setStudentName(initialStudent.name || "");
    setStudentId(initialStudent.reg_no || initialStudent.id || "");
    setSex(initialStudent.gender || "");
    setAge(initialStudent.age || "");
    setClassName(initialClass.name || "");
    setSession(initialClass.session || "");
    setTerm(initialTerm || "");
    setClassAvg("");
    setDaysOpened("");
    setDaysPresent("");
    setDaysAbsent("");
    setSubjects(
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        sub: "",
        ca: "",
        exam: "",
        sa: "",
      })),
    );
    setNextSubjectId(8);
    setAffective({
      a0: "",
      a1: "",
      a2: "",
      a3: "",
      a4: "",
      a5: "",
      a6: "",
      a7: "",
      a8: "",
      a9: "",
    });
    setPsychomotor({ p0: "", p1: "", p2: "", p3: "", p4: "", p5: "" });
    setTeacherName("");
    setHeadTeacherName("");
    setTeacherRemark("");
    setHeadRemark("");
    setNextTerm("");
    setPromotion("");
    showToast("Cleared compiler inputs.", "success");
  };

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ message: msg, type, show: true });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3500);
  };

  // ── PDF ENGINE ──
  const exportPDF = () => {
    const subjectsData = collectSubjects();
    if (!studentName) {
      showToast("Please enter the student name.", "error");
      return;
    }
    if (subjectsData.length === 0) {
      showToast("Please add at least one subject with scores.", "error");
      return;
    }

    try {
      const doc = generateSingleReportCard({
        schoolName,
        schoolAddress,
        schoolEmail,
        schoolPhone,
        studentName,
        studentId,
        sex,
        age,
        className,
        session,
        term,
        classAvg,
        daysOpened,
        daysPresent,
        daysAbsent,
        subjects,
        affective,
        psychomotor,
        teacherName,
        headTeacherName,
        teacherRemark,
        headRemark,
        nextTerm,
        promotion,
        positions: studentPosition
          ? {
              position: studentPosition,
              classSize: classSize || 0,
              average: studentAverage || 0,
              subjects: subjectStats,
            }
          : undefined,
        termAverages,
        cumulativeAverage,
        gradeBands: gradeBands || [],
      });

      const fname = `${(studentName || "Student").replace(/\s+/g, "_")}_${(term || "Report").replace(/\s+/g, "_")}${session ? "_" + session : ""}.pdf`;
      doc.save(fname);
      showToast("✅ PDF exported successfully!", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Failed to export PDF.", "error");
    }
  };

  const summary = calculateSummary();

  return (
    <div className={`school-result ${readOnly ? "readonly" : ""}`}>
      <header>
        <div className="logo">🎓</div>
        <div>
          <h1>Result Compiler</h1>
          <p>
            {readOnly ? "Viewing" : "Editing"}: {studentName}
          </p>
        </div>
      </header>

      <div className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2>Assessment Compiler</h2>
          <div>
            {!readOnly && (
              <button
                className="btn btn-ghost"
                onClick={() => handleSaveDraft(false)}
              >
                💾 Save Draft Progress
              </button>
            )}
            <button className="btn btn-gold" onClick={exportPDF}>
              ⬇ Export Full PDF Report
            </button>
          </div>
        </div>

        <div className="step-label">Step 1 — School & Student Details</div>
        <div className="card">
          <div className="card-title">
            <span className="ic">🏫</span>School & Student Information
          </div>
          <div className="form-grid">
            <div className="field full">
              <label>School Name</label>
              <input
                type="text"
                placeholder="e.g. Smart Start Private School"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />
            </div>
            <div className="field full">
              <label>School Address</label>
              <input
                type="text"
                placeholder="e.g. 20 Gbenga Olatunji Street, Bucknor Lagos"
                value={schoolAddress}
                onChange={(e) => setSchoolAddress(e.target.value)}
              />
            </div>
            <div className="field">
              <label>School Email</label>
              <input
                type="text"
                placeholder="school@example.com"
                value={schoolEmail}
                onChange={(e) => setSchoolEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label>School Phone</label>
              <input
                type="text"
                placeholder="e.g. 09012293099"
                value={schoolPhone}
                onChange={(e) => setSchoolPhone(e.target.value)}
              />
            </div>
          </div>

          <br />

          <div className="form-grid">
            <div className="field">
              <label>Student Full Name</label>
              <input
                type="text"
                placeholder="e.g. Giovanni Onwuneme"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Student ID</label>
              <input
                type="text"
                placeholder="e.g. SSL1799"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Sex</label>
              <select value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="">— Select —</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
            <div className="field">
              <label>Age</label>
              <input
                type="text"
                placeholder="e.g. 5"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Class / Form</label>
              <input
                type="text"
                placeholder="e.g. Nursery 2, JSS3A"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Academic Session</label>
              <input
                type="text"
                placeholder="e.g. 2025/2026"
                value={session}
                onChange={(e) => setSession(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Term</label>
              <select value={term} onChange={(e) => setTerm(e.target.value)}>
                <option value="">— Select —</option>
                <option>First Term</option>
                <option>Second Term</option>
                <option>Third Term</option>
              </select>
            </div>
            <div className="field">
              <label>Class Average Score (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="e.g. 85.7"
                value={classAvg}
                onChange={(e) => setClassAvg(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="step-label">Step 2 — Attendance</div>
        <div className="card">
          <div className="card-title">
            <span className="ic">📅</span>Attendance Record
          </div>
          <div className="attend-grid">
            <div className="field">
              <label>Days School Opened</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 112"
                value={daysOpened}
                onChange={(e) => setDaysOpened(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Days Present</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 110"
                value={daysPresent}
                onChange={(e) => setDaysPresent(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Days Absent (auto)</label>
              <input
                type="number"
                min="0"
                placeholder="auto"
                value={daysAbsent}
                readOnly
              />
            </div>
          </div>
        </div>

        <div className="step-label">
          Step 3 — Cognitive Domain (Subjects & Scores)
        </div>
        <div className="card">
          <div className="card-title">
            <span className="ic">📚</span>Subjects, CA & Exam Scores
          </div>
          <p className="hint">
            CA (/{caWeight}) · Exam (/{examWeight}) · Total (auto) · Position
            (auto) · Grade (auto)
          </p>
          <div className="subjects-wrap">
            <table className="stbl">
              <thead>
                <tr>
                  <th style={{ width: "22px" }}>#</th>
                  <th style={{ width: "120px", textAlign: "left" }}>Subject</th>
                  <th style={{ width: "45px" }}>CA</th>
                  <th style={{ width: "45px" }}>Ex</th>
                  <th style={{ width: "40px" }}>Tot</th>
                  <th style={{ width: "40px" }}>Pos</th>
                  <th style={{ width: "30px" }}>Gr</th>
                  <th style={{ width: "28px" }}></th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s, idx) => {
                  const ca = s.ca !== "" ? parseFloat(s.ca) : null;
                  const ex = s.exam !== "" ? parseFloat(s.exam) : null;
                  const tt =
                    ca !== null || ex !== null ? (ca || 0) + (ex || 0) : null;
                  const { g } = tt !== null ? grade(tt) : { g: "—" };
                  const gradeClass =
                    g === "A"
                      ? "gA"
                      : g === "B"
                        ? "gB"
                        : g === "C"
                          ? "gC"
                          : g === "D"
                            ? "gD"
                            : g === "F"
                              ? "gF"
                              : "g_";

                  return (
                    <tr key={s.id}>
                      <td style={{ color: "#bbb", fontSize: ".75rem" }}>
                        {idx + 1}
                      </td>
                      <td>
                        <span className="block px-2 py-1 text-sm text-slate-800 font-medium">
                          {s.sub || "—"}
                        </span>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={caWeight}
                          placeholder={`0–${caWeight}`}
                          value={s.ca}
                          onChange={(e) =>
                            updateSubject(s.id, "ca", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={examWeight}
                          placeholder={`0–${examWeight}`}
                          value={s.exam}
                          onChange={(e) =>
                            updateSubject(s.id, "exam", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <span className="cc">{tt !== null ? tt : "—"}</span>
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          fontSize: ".85rem",
                          color: "#555",
                        }}
                      >
                        {subjectStats[s.sub]?.position ?? "—"}
                      </td>
                      <td>
                        <span className={`gb ${gradeClass}`}>{g}</span>
                      </td>
                      <td>
                        <button
                          className="btn btn-del"
                          onClick={() => removeRow(s.id)}
                          title="Remove subject"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!readOnly && (
            <div className="row-btns">
              {availableSubjects.length === 0 ? (
                <span className="text-xs text-slate-500">
                  No subjects in the school catalog yet. Ask your admin to add
                  some.
                </span>
              ) : (
                <select
                  value=""
                  onChange={async (e) => {
                    const id = e.target.value;
                    if (!id || !onAddSubject) return;
                    const subj = availableSubjects.find((s) => s.id === id);
                    if (!subj) return;
                    const classSubjectId = await onAddSubject(id, subj.name);
                    if (classSubjectId) {
                      setSubjects((prev) => [
                        ...prev,
                        {
                          id: nextSubjectId,
                          sub: subj.name,
                          ca: "",
                          exam: "",
                          sa: "",
                        },
                      ]);
                      setNextSubjectId((prev) => prev + 1);
                    }
                    e.target.value = "";
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">＋ Add Subject from Catalog</option>
                  {availableSubjects
                    .filter(
                      (avail) =>
                        !subjects.some(
                          (s) =>
                            s.sub.toLowerCase() === avail.name.toLowerCase(),
                        ),
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              )}
            </div>
          )}
        </div>

        <div className="summary-strip">
          <div className="stat">
            <span className="sl">Subjects</span>
            <span className="sv">{summary.count}</span>
          </div>
          <div className="stat">
            <span className="sl">Term Avg</span>
            <span className="sv">{summary.termAvg}</span>
          </div>
          <div className="stat">
            <span className="sl">Final Avg</span>
            <span className="sv">{summary.finalAvg}</span>
          </div>
          <div className="stat">
            <span className="sl">Position</span>
            <span className="sv">
              {studentPosition ?? "—"} / {classSize ?? "—"}
            </span>
          </div>
          <div className="stat">
            <span className="sl">Highest</span>
            <span className="sv pass">{summary.highest}</span>
          </div>
          <div className="stat">
            <span className="sl">Lowest</span>
            <span className="sv fail">{summary.lowest}</span>
          </div>
          <div className="stat">
            <span className="sl">Final Grade</span>
            <span className="sv">{summary.finalGrade}</span>
          </div>
        </div>

        {(Object.keys(termAverages).length > 1 ||
          cumulativeAverage != null) && (
          <div className="card" style={{ marginTop: 8 }}>
            <div className="card-title">
              <span className="ic">📈</span>Session Cumulative Average
            </div>
            <div className="summary-strip" style={{ marginBottom: 0 }}>
              {["First", "Second", "Third"].map((t) => (
                <div className="stat" key={t}>
                  <span className="sl">{t} Term</span>
                  <span className="sv">
                    {termAverages[t] != null
                      ? termAverages[t].toFixed(1) + "%"
                      : "—"}
                  </span>
                </div>
              ))}
              <div className="stat">
                <span className="sl">Cumulative</span>
                <span className="sv">
                  {cumulativeAverage != null
                    ? cumulativeAverage.toFixed(1) + "%"
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="step-label">
          Step 4 — Affective Domain & Psychomotor Skills
        </div>
        <div className="card">
          <div className="card-title">
            <span className="ic">🌱</span>Behavioural & Skills Assessment
          </div>
          <p className="hint">
            5 = Excellent · 4 = Very Good · 3 = Good · 2 = Average · 1 = Below
            Average · Leave blank if not assessed
          </p>
          <div className="domain-grid">
            <div className="dom-section">
              <h3>Affective Domain</h3>
              <table className="dom-tbl">
                <tbody>
                  {[
                    "Punctuality",
                    "Perseverance",
                    "Neatness",
                    "Honesty",
                    "Attentiveness",
                    "Politeness",
                    "Leadership",
                    "Relationship with Students",
                    "Emotional Stability",
                    "Health",
                  ].map((label, i) => (
                    <tr key={`a${i}`}>
                      <td>{label}</td>
                      <td>
                        <select
                          value={affective[`a${i}`] || ""}
                          onChange={(e) =>
                            setAffective({
                              ...affective,
                              [`a${i}`]: e.target.value,
                            })
                          }
                        >
                          <option value="">—</option>
                          <option>5</option>
                          <option>4</option>
                          <option>3</option>
                          <option>2</option>
                          <option>1</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="dom-section">
              <h3>Psychomotor Skills</h3>
              <table className="dom-tbl">
                <tbody>
                  {[
                    "Handling of Tools",
                    "Sports and Games",
                    "Musical Skills",
                    "Drawing & Painting",
                    "Verbal Fluency",
                    "Writing",
                  ].map((label, i) => (
                    <tr key={`p${i}`}>
                      <td>{label}</td>
                      <td>
                        <select
                          value={psychomotor[`p${i}`] || ""}
                          onChange={(e) =>
                            setPsychomotor({
                              ...psychomotor,
                              [`p${i}`]: e.target.value,
                            })
                          }
                        >
                          <option value="">—</option>
                          <option>5</option>
                          <option>4</option>
                          <option>3</option>
                          <option>2</option>
                          <option>1</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="step-label">Step 5 — Remarks & Next Term</div>
        <div className="card">
          <div className="card-title">
            <span className="ic">✍️</span>Remarks & Comments
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Class Teacher's Name</label>
              <input
                type="text"
                placeholder="e.g. Mrs. Adaeze Nwosu"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Head Teacher's Name</label>
              <input
                type="text"
                placeholder="e.g. Mr. Emeka Obi"
                value={headTeacherName}
                onChange={(e) => setHeadTeacherName(e.target.value)}
              />
            </div>
            <div className="field full">
              <label>Class Teacher's Remark</label>
              <textarea
                placeholder="e.g. Giovanni has done well this term. Keep it up boy..."
                value={teacherRemark}
                onChange={(e) => setTeacherRemark(e.target.value)}
              />
            </div>
            <div className="field full">
              <label>Head Teacher's Comment</label>
              <textarea
                placeholder="e.g. An excellent performance keep it up."
                value={headRemark}
                onChange={(e) => setHeadRemark(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Next Term Begins</label>
              <input
                type="text"
                placeholder="e.g. 4th May 2026"
                value={nextTerm}
                onChange={(e) => setNextTerm(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Promotion Status (optional)</label>
              <select
                value={promotion}
                onChange={(e) => setPromotion(e.target.value)}
              >
                <option value="">— Select —</option>
                <option>Promoted to Next Class</option>
                <option>Repeated – Academic Performance</option>
                <option>Repeated – Attendance</option>
                <option>Graduated</option>
                <option>Pending Review</option>
              </select>
            </div>
          </div>
        </div>

        <div className="export-row">
          {!readOnly && (
            <>
              <button className="btn btn-ghost" onClick={clearAll}>
                🗑 Clear All
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => handleSaveDraft(false)}
              >
                💾 Save Draft Progress
              </button>
            </>
          )}
          <button className="btn btn-gold" onClick={exportPDF}>
            ⬇ Export Full PDF Report
          </button>
        </div>
      </div>

      <div className={`toast ${toast.type} ${toast.show ? "show" : ""}`}>
        {toast.message}
      </div>
    </div>
  );
}