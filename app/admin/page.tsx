"use client";

import React, { useState, useEffect, useMemo } from "react";
import { User, ClassRoom, Student } from "@/types/school";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentTerm } from "@/hooks/useCurrentTerm";
import { useSessionsAndTerms } from "@/hooks/useSessionsAndTerms";
import ResultsPage from "../teacher/results/page";
import { computeTermAverages } from "@/lib/termAverages";
import SettingsTab from "./SettingsTab";
import { generateBatchReportCards, ReportCardInput } from "@/lib/reportCardPdf";

interface SubjectRow {
  id: string;
  name: string;
  display_order: number;
}

interface PendingClass {
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

interface ReviewStudent {
  enrolmentId: string;
  name: string;
  regNo: string;
  status: string;
  comment: string;
  approvedAt: string | null;
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<
    | "teachers"
    | "subjects"
    | "classes"
    | "allocations"
    | "approvals"
    | "settings"
  >("teachers");

  const [teachers, setTeachers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [classSubjectIds, setClassSubjectIds] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(true);

  const { session: currentSession, term: currentTerm } = useCurrentTerm();
  const { sessions: allSessions } = useSessionsAndTerms();

  // Approvals state
  const [pendingClasses, setPendingClasses] = useState<PendingClass[]>([]);
  const [reviewClassId, setReviewClassId] = useState<string | null>(null);
  const [reviewStudents, setReviewStudents] = useState<ReviewStudent[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [bulkComment, setBulkComment] = useState("");
  const [busyEnrolmentId, setBusyEnrolmentId] = useState<string | null>(null);
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<{
    student: any;
    classRoom: any;
  } | null>(null);

  // Teacher form
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
  const [isSubmittingTeacher, setIsSubmittingTeacher] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    pin: string;
  } | null>(null);

  // Subject form
  const [newSubjectName, setNewSubjectName] = useState("");
  const [isAddingSubject, setIsAddingSubject] = useState(false);

  // Class form
  const [newClassName, setNewClassName] = useState("");
  const [newClassSession, setNewClassSession] = useState("");
  const [newClassSubjectIds, setNewClassSubjectIds] = useState<string[]>([]);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);

  // Student form
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentRegNo, setNewStudentRegNo] = useState("");
  const [newStudentAge, setNewStudentAge] = useState("");
  const [newStudentSex, setNewStudentSex] = useState("");
  const [selectedStudentClassId, setSelectedStudentClassId] = useState("");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Seed class form defaults
  useEffect(() => {
    if (editingClass) return;
    if (!newClassSession && currentSession)
      setNewClassSession(currentSession.name);
  }, [currentSession, editingClass, newClassSession]);

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const callAdminApi = async (action: string, payload: any) => {
    const token = await getAccessToken();
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Request failed");
    }
    return response.json();
  };

  const fetchData = async () => {
    setLoading(true);

    const { data: teachersData } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "teacher");
    const { data: classesData } = await supabase.from("classes").select("*");
    const { data: studentsData } = await supabase.from("students").select("*");
    const { data: subjectsData } = await supabase
      .from("subjects")
      .select("*")
      .order("name");
    const { data: classSubjectsData } = await supabase
      .from("class_subjects")
      .select("class_id, subject_id");

    if (teachersData) {
      setTeachers(
        teachersData.map((t) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          role: t.role,
        })),
      );
    }
    if (classesData) {
      setClasses(
        classesData.map((c) => ({
          id: c.id,
          name: c.name,
          session: c.session,
          session_id: c.session_id ?? null,
          assignedTeacherId: c.teacher_id,
          studentIds: [],
        })),
      );
    }
    if (studentsData) {
      setStudents(
        studentsData.map((s) => ({
          id: s.id,
          name: s.name,
          regNo: s.reg_no,
          currentClassId: s.class_id,
          gender: s.gender || "",
          age: s.age || "",
        })),
      );
    }
    if (subjectsData) setSubjects(subjectsData as SubjectRow[]);

    const grouped: Record<string, string[]> = {};
    (classSubjectsData || []).forEach((r: any) => {
      if (!grouped[r.class_id]) grouped[r.class_id] = [];
      grouped[r.class_id].push(r.subject_id);
    });
    setClassSubjectIds(grouped);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ────────────────────────────────────────────────────────────
  // Approvals
  // ────────────────────────────────────────────────────────────
  const handleBatchPrintReview = async () => {
    if (!reviewClassId) return;
    const current = pendingClasses.find((c) => c.classId === reviewClassId);
    if (!current) return;

    setBatchPrinting(true);
    try {
      const { classId, termId, sessionId } = current;

      // Fetch school config + grade bands
      const [schoolRes, bandsRes, classRes, termRes] = await Promise.all([
        supabase.from("schools").select("*").limit(1).single(),
        supabase.from("grade_bands").select("*").order("display_order"),
        supabase
          .from("classes")
          .select("id, name, session")
          .eq("id", classId)
          .single(),
        supabase.from("terms").select("name").eq("id", termId).maybeSingle(),
      ]);

      const school = schoolRes.data;
      const gradeBands = bandsRes.data || [];
      const cls = classRes.data;
      const termName = termRes.data?.name ? `${termRes.data.name} Term` : "";

      if (!school || !cls || gradeBands.length === 0) {
        alert("Could not load school config or class.");
        return;
      }

      // Class subjects for ordering
      const { data: csubs } = await supabase
        .from("class_subjects")
        .select(`id, subject:subjects (id, name, display_order)`)
        .eq("class_id", classId)
        .eq("session_id", sessionId);

      const subjectOrder = (csubs || [])
        .map((cs: any) => ({
          name: cs.subject?.name,
          order: cs.subject?.display_order ?? 0,
          class_subject_id: cs.id,
        }))
        .filter((s: any) => s.name)
        .sort((a: any, b: any) => a.order - b.order);

      // All enrolments in the class
      const { data: enrols } = await supabase
        .from("enrolments")
        .select(`id, student:students (id, name, reg_no, gender, age)`)
        .eq("class_id", classId)
        .eq("session_id", sessionId)
        .eq("status", "active");

      if (!enrols || enrols.length === 0) {
        alert("No students in this class.");
        return;
      }

      const enrolmentIds = enrols.map((e: any) => e.id);

      // Fetch all scores/traits/records across all terms (for cumulative)
      const [scoresRes, traitsRes, recordsRes, termsRes] = await Promise.all([
        supabase.from("scores").select("*").in("enrolment_id", enrolmentIds),
        supabase
          .from("trait_ratings")
          .select("*")
          .in("enrolment_id", enrolmentIds)
          .eq("term_id", termId),
        supabase
          .from("term_records")
          .select("*")
          .in("enrolment_id", enrolmentIds)
          .eq("term_id", termId),
        supabase
          .from("terms")
          .select("id, name, sequence")
          .eq("session_id", sessionId)
          .order("sequence"),
      ]);

      const allScores = scoresRes.data || [];
      const traits = traitsRes.data || [];
      const records = recordsRes.data || [];
      const sessionTerms = termsRes.data || [];

      // Compute term averages per student (all terms)
      const termAveragesByEnrolment = computeTermAverages(
        allScores.filter((s: any) => s.term_id !== termId) as any, // any extra terms
        sessionTerms as any,
        enrolmentIds,
      );

      // Compute positions
      const scoresForPositions = allScores.filter(
        (s: any) => s.term_id === termId,
      );
      const perEnrolment: Record<string, Record<string, number>> = {};
      scoresForPositions.forEach((s: any) => {
        const ca = s.ca_score != null ? Number(s.ca_score) : null;
        const ex = s.exam_score != null ? Number(s.exam_score) : null;
        if (ca === null && ex === null) return;
        const tt = (ca || 0) + (ex || 0);
        if (!perEnrolment[s.enrolment_id]) perEnrolment[s.enrolment_id] = {};
        perEnrolment[s.enrolment_id][s.class_subject_id] = tt;
      });

      const csIdToName: Record<string, string> = {};
      subjectOrder.forEach((so: any) => {
        csIdToName[so.class_subject_id] = so.name;
      });

      const subjectAllTotals: Record<string, number[]> = {};
      Object.values(perEnrolment).forEach((subMap) => {
        Object.entries(subMap).forEach(([csId, tt]) => {
          const name = csIdToName[csId];
          if (!name) return;
          if (!subjectAllTotals[name]) subjectAllTotals[name] = [];
          subjectAllTotals[name].push(tt);
        });
      });
      const sortedBySubject: Record<string, number[]> = {};
      Object.entries(subjectAllTotals).forEach(([name, totals]) => {
        sortedBySubject[name] = [...totals].sort((a, b) => b - a);
      });

      const allTotals = Object.values(perEnrolment).map((subMap) =>
        Object.values(subMap).reduce((a, b) => a + b, 0),
      );
      const sortedTotals = [...allTotals].sort((a, b) => b - a);

      const items: ReportCardInput[] = enrols.map((e: any) => {
        const student = e.student;
        const enrolmentId = e.id;

        const scoreMap: Record<string, any> = {};
        scoresForPositions
          .filter((s: any) => s.enrolment_id === enrolmentId)
          .forEach((s: any) => {
            scoreMap[s.class_subject_id] = s;
          });

        const subjects = subjectOrder.map((so: any) => {
          const row = scoreMap[so.class_subject_id];
          return {
            sub: so.name,
            ca: row?.ca_score != null ? String(row.ca_score) : "",
            exam: row?.exam_score != null ? String(row.exam_score) : "",
            sa: row?.sa_score != null ? String(row.sa_score) : "",
          };
        });

        const affective: Record<string, string> = {};
        const psychomotor: Record<string, string> = {};
        traits
          .filter((t: any) => t.enrolment_id === enrolmentId)
          .forEach((t: any) => {
            if (t.trait_domain === "affective")
              affective[t.trait_key] = String(t.rating ?? "");
            else if (t.trait_domain === "psychomotor")
              psychomotor[t.trait_key] = String(t.rating ?? "");
          });

        const record = records.find((r: any) => r.enrolment_id === enrolmentId);

        const thisEnrolTotals = perEnrolment[enrolmentId] || {};
        const studentTotal = Object.values(thisEnrolTotals).reduce(
          (a, b) => a + b,
          0,
        );
        const subjCount = Object.keys(thisEnrolTotals).length;
        const avg = subjCount > 0 ? studentTotal / subjCount : 0;
        const position = sortedTotals.indexOf(studentTotal) + 1;

        const subjectStats: Record<string, any> = {};
        Object.entries(thisEnrolTotals).forEach(([csId, tt]) => {
          const name = csIdToName[csId];
          if (!name) return;
          const stats = sortedBySubject[name];
          subjectStats[name] = {
            position: stats.indexOf(tt) + 1,
            highest: stats[0],
            lowest: stats[stats.length - 1],
            average: stats.reduce((a, b) => a + b, 0) / stats.length,
          };
        });

        const termAvgs = termAveragesByEnrolment[enrolmentId] || {
          termAverages: {},
          cumulativeAverage: null,
        };

        return {
          schoolName: school.name,
          schoolAddress: school.address || "",
          schoolEmail: "",
          schoolPhone: school.phone || "",
          studentName: student?.name || "",
          studentId: student?.reg_no || "",
          sex: student?.gender || "",
          age: student?.age || "",
          className: cls.name,
          session: cls.session,
          term: termName,
          classAvg: "",
          daysOpened:
            record?.days_opened != null ? String(record.days_opened) : "",
          daysPresent:
            record?.days_present != null ? String(record.days_present) : "",
          daysAbsent:
            record?.days_absent != null ? String(record.days_absent) : "",
          subjects,
          affective,
          psychomotor,
          teacherName: "",
          headTeacherName: "",
          teacherRemark: record?.class_teacher_comment || "",
          headRemark: record?.head_teacher_comment || "",
          nextTerm: "",
          promotion: "",
          positions: {
            position,
            classSize: allTotals.length,
            average: avg,
            subjects: subjectStats,
          },
          termAverages: termAvgs.termAverages,
          cumulativeAverage: termAvgs.cumulativeAverage,
          gradeBands,
        };
      });

      const doc = generateBatchReportCards(items);
      const safe = (s: string) => s.replace(/\s+/g, "_");
      doc.save(`${safe(cls.name)}_${safe(termName)}_ReportCards.pdf`);
    } catch (err) {
      console.error("Batch print failed:", err);
      alert("Failed to generate report cards.");
    } finally {
      setBatchPrinting(false);
    }
  };

  const fetchApprovals = async () => {
    const { data: records, error: recErr } = await supabase
      .from("term_records")
      .select("enrolment_id, term_id, status")
      .in("status", ["submitted", "approved"]);

    if (recErr) {
      console.error("Failed to load approvals:", recErr);
      return;
    }
    if (!records || records.length === 0) {
      setPendingClasses([]);
      return;
    }

    const enrolmentIds = Array.from(
      new Set(records.map((r) => r.enrolment_id)),
    );
    const termIds = Array.from(new Set(records.map((r) => r.term_id)));

    const [enrolsRes, termsRes] = await Promise.all([
      supabase
        .from("enrolments")
        .select("id, class_id, session_id")
        .in("id", enrolmentIds),
      supabase.from("terms").select("id, name").in("id", termIds),
    ]);

    const enrols = enrolsRes.data || [];
    const terms = termsRes.data || [];

    if (enrols.length === 0) {
      setPendingClasses([]);
      return;
    }

    const classIds = Array.from(new Set(enrols.map((e) => e.class_id)));

    const [classRowsRes, allEnrolsRes] = await Promise.all([
      supabase
        .from("classes")
        .select("id, name, session, session_id")
        .in("id", classIds),
      supabase
        .from("enrolments")
        .select("id, class_id")
        .in("class_id", classIds)
        .eq("status", "active"),
    ]);

    const classRows = classRowsRes.data || [];
    const allEnrols = allEnrolsRes.data || [];

    const classById: Record<string, any> = {};
    classRows.forEach((c) => {
      classById[c.id] = c;
    });

    const termNameById: Record<string, string> = {};
    terms.forEach((t) => {
      termNameById[t.id] = t.name;
    });

    const totalByClass: Record<string, number> = {};
    allEnrols.forEach((e) => {
      totalByClass[e.class_id] = (totalByClass[e.class_id] || 0) + 1;
    });

    const enrolToClass: Record<string, string> = {};
    enrols.forEach((e) => {
      enrolToClass[e.id] = e.class_id;
    });

    const byKey: Record<
      string,
      { classId: string; termId: string; submitted: number; approved: number }
    > = {};

    records.forEach((r) => {
      const classId = enrolToClass[r.enrolment_id];
      if (!classId) return;
      const key = `${classId}::${r.term_id}`;
      if (!byKey[key]) {
        byKey[key] = { classId, termId: r.term_id, submitted: 0, approved: 0 };
      }
      if (r.status === "submitted") byKey[key].submitted++;
      if (r.status === "approved") byKey[key].approved++;
    });

    const list: PendingClass[] = Object.values(byKey).map(
      ({ classId, termId, submitted, approved }) => {
        const c = classById[classId];
        return {
          classId,
          className: c?.name || "—",
          sessionName: c?.session || "—",
          termLabel: `${termNameById[termId] || "Term"} Term`,
          termId,
          sessionId: c?.session_id || "",
          submittedCount: submitted,
          approvedCount: approved,
          totalStudents: totalByClass[classId] || 0,
        };
      },
    );

    setPendingClasses(list);
  };

  useEffect(() => {
    if (activeTab === "approvals") {
      fetchApprovals();
    }
  }, [activeTab]);

  const handleOpenReview = async (
    classId: string,
    termId: string,
    sessionId: string,
  ) => {
    setReviewClassId(classId);
    setReviewLoading(true);
    setReviewStudents([]);

    const { data: enrols } = await supabase
      .from("enrolments")
      .select(`id, student:students (id, name, reg_no)`)
      .eq("class_id", classId)
      .eq("session_id", sessionId)
      .eq("status", "active");

    if (!enrols) {
      setReviewLoading(false);
      return;
    }

    const enrolmentIds = enrols.map((e: any) => e.id);

    const { data: records } = await supabase
      .from("term_records")
      .select("enrolment_id, status, head_teacher_comment, approved_at")
      .in("enrolment_id", enrolmentIds)
      .eq("term_id", termId);

    const recordByEnrolment: Record<string, any> = {};
    (records || []).forEach((r: any) => {
      recordByEnrolment[r.enrolment_id] = r;
    });

    const built: ReviewStudent[] = enrols.map((e: any) => {
      const rec = recordByEnrolment[e.id];
      return {
        enrolmentId: e.id,
        name: e.student?.name || "—",
        regNo: e.student?.reg_no || "—",
        status: rec?.status || "draft",
        comment: rec?.head_teacher_comment || "",
        approvedAt: rec?.approved_at || null,
      };
    });

    built.sort((a, b) => a.name.localeCompare(b.name));
    setReviewStudents(built);
    setReviewLoading(false);
  };

  const handleBackToList = () => {
    setReviewClassId(null);
    setReviewStudents([]);
    setBulkComment("");
  };

  const handleApproveStudent = async (
    enrolmentId: string,
    termId: string,
    comment: string,
  ) => {
    setBusyEnrolmentId(enrolmentId);
    try {
      await callAdminApi("approve-student", {
        enrolmentId,
        termId,
        headComment: comment || null,
      });
      setReviewStudents((prev) =>
        prev.map((s) =>
          s.enrolmentId === enrolmentId
            ? {
                ...s,
                status: "approved",
                comment,
                approvedAt: new Date().toISOString(),
              }
            : s,
        ),
      );
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setBusyEnrolmentId(null);
    }
  };

  const handleReopenStudent = async (enrolmentId: string, termId: string) => {
    if (!confirm("Send this student's result back to the teacher for editing?"))
      return;
    setBusyEnrolmentId(enrolmentId);
    try {
      await callAdminApi("reopen-student", { enrolmentId, termId });
      setReviewStudents((prev) =>
        prev.map((s) =>
          s.enrolmentId === enrolmentId
            ? { ...s, status: "draft", approvedAt: null }
            : s,
        ),
      );
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setBusyEnrolmentId(null);
    }
  };

  const handleApproveAll = async (termId: string) => {
    const toApprove = reviewStudents.filter((s) => s.status === "submitted");
    if (toApprove.length === 0) {
      alert("No submitted results to approve.");
      return;
    }
    if (
      !confirm(
        `Approve all ${toApprove.length} submitted result${toApprove.length > 1 ? "s" : ""}?` +
          (bulkComment ? `\n\nHead teacher comment: "${bulkComment}"` : ""),
      )
    )
      return;

    setReviewLoading(true);
    try {
      for (const s of toApprove) {
        await callAdminApi("approve-student", {
          enrolmentId: s.enrolmentId,
          termId,
          headComment: bulkComment || null,
        });
      }
      const current = pendingClasses.find((c) => c.classId === reviewClassId);
      if (current) {
        await handleOpenReview(
          current.classId,
          current.termId,
          current.sessionId,
        );
      }
      await fetchApprovals();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleViewResult = async (
    enrolmentId: string,
    classId: string,
    termId: string,
    sessionId: string,
  ) => {
    const { data: enrol } = await supabase
      .from("enrolments")
      .select(
        `id, student:students (id, name, reg_no, gender, age, assessment)`,
      )
      .eq("id", enrolmentId)
      .single();

    if (!enrol) {
      alert("Could not load student.");
      return;
    }

    const { data: cls } = await supabase
      .from("classes")
      .select("id, name, session, session_id")
      .eq("id", classId)
      .single();

    if (!cls) return;

    const { data: termRow } = await supabase
      .from("terms")
      .select("name")
      .eq("id", termId)
      .maybeSingle();

    const termName = termRow?.name ? `${termRow.name} Term` : "";

    const { data: csubs } = await supabase
      .from("class_subjects")
      .select(`id, subject:subjects (id, name, display_order)`)
      .eq("class_id", classId)
      .eq("session_id", sessionId);

    const [scoreRes, traitRes, recordRes] = await Promise.all([
      supabase
        .from("scores")
        .select("*")
        .eq("enrolment_id", enrolmentId)
        .eq("term_id", termId),
      supabase
        .from("trait_ratings")
        .select("*")
        .eq("enrolment_id", enrolmentId)
        .eq("term_id", termId),
      supabase
        .from("term_records")
        .select("*")
        .eq("enrolment_id", enrolmentId)
        .eq("term_id", termId)
        .maybeSingle(),
    ]);

    const [sessionTermsRes, allScoresRes] = await Promise.all([
      supabase
        .from("terms")
        .select("id, name, sequence")
        .eq("session_id", sessionId)
        .order("sequence"),
      supabase
        .from("scores")
        .select("enrolment_id, term_id, ca_score, exam_score")
        .eq("enrolment_id", enrolmentId),
    ]);

    let termAvgs: {
      termAverages: Record<string, number>;
      cumulativeAverage: number | null;
    } = {
      termAverages: {},
      cumulativeAverage: null,
    };
    if (sessionTermsRes.data && allScoresRes.data) {
      const result = computeTermAverages(
        allScoresRes.data as any,
        sessionTermsRes.data as any,
        [enrolmentId],
      );
      termAvgs = result[enrolmentId] || termAvgs;
    }

    const subjectOrder = (csubs || [])
      .map((cs: any) => ({
        name: cs.subject?.name,
        order: cs.subject?.display_order ?? 0,
        class_subject_id: cs.id,
      }))
      .filter((s: any) => s.name)
      .sort((a: any, b: any) => a.order - b.order);

    const scoreByCsId: Record<string, any> = {};
    (scoreRes.data || []).forEach((r: any) => {
      scoreByCsId[r.class_subject_id] = r;
    });

    const subjects = subjectOrder.map((so: any, idx: number) => {
      const row = scoreByCsId[so.class_subject_id];
      return {
        id: idx,
        sub: so.name,
        ca: row?.ca_score != null ? String(row.ca_score) : "",
        exam: row?.exam_score != null ? String(row.exam_score) : "",
        sa: row?.sa_score != null ? String(row.sa_score) : "",
      };
    });

    const affective: Record<string, string> = {
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
    };
    const psychomotor: Record<string, string> = {
      p0: "",
      p1: "",
      p2: "",
      p3: "",
      p4: "",
      p5: "",
    };

    (traitRes.data || []).forEach((t: any) => {
      if (t.trait_domain === "affective" && t.trait_key in affective) {
        affective[t.trait_key] = t.rating != null ? String(t.rating) : "";
      } else if (
        t.trait_domain === "psychomotor" &&
        t.trait_key in psychomotor
      ) {
        psychomotor[t.trait_key] = t.rating != null ? String(t.rating) : "";
      }
    });

    const { data: allEnrols } = await supabase
      .from("enrolments")
      .select("id")
      .eq("class_id", classId)
      .eq("session_id", sessionId)
      .eq("status", "active");

    const allEnrolmentIds = (allEnrols || []).map((e: any) => e.id);

    let positions: any = undefined;
    if (allEnrolmentIds.length > 0) {
      const { data: allScores } = await supabase
        .from("scores")
        .select("enrolment_id, class_subject_id, ca_score, exam_score")
        .in("enrolment_id", allEnrolmentIds)
        .eq("term_id", termId);

      const perEnrolment: Record<string, Record<string, number>> = {};
      (allScores || []).forEach((s: any) => {
        const ca = s.ca_score != null ? Number(s.ca_score) : null;
        const ex = s.exam_score != null ? Number(s.exam_score) : null;
        if (ca === null && ex === null) return;
        const tt = (ca || 0) + (ex || 0);
        if (!perEnrolment[s.enrolment_id]) perEnrolment[s.enrolment_id] = {};
        perEnrolment[s.enrolment_id][s.class_subject_id] = tt;
      });

      const csIdToName: Record<string, string> = {};
      subjectOrder.forEach((so: any) => {
        csIdToName[so.class_subject_id] = so.name;
      });

      const subjectAllTotals: Record<string, number[]> = {};
      Object.values(perEnrolment).forEach((subMap) => {
        Object.entries(subMap).forEach(([csId, tt]) => {
          const name = csIdToName[csId];
          if (!name) return;
          if (!subjectAllTotals[name]) subjectAllTotals[name] = [];
          subjectAllTotals[name].push(tt);
        });
      });

      const sortedBySubject: Record<string, number[]> = {};
      Object.entries(subjectAllTotals).forEach(([name, totals]) => {
        sortedBySubject[name] = [...totals].sort((a, b) => b - a);
      });

      const thisEnrolTotals = perEnrolment[enrolmentId] || {};
      const studentTotal = Object.values(thisEnrolTotals).reduce(
        (a, b) => a + b,
        0,
      );
      const subjCount = Object.keys(thisEnrolTotals).length;
      const avg = subjCount > 0 ? studentTotal / subjCount : 0;

      const allTotals = Object.values(perEnrolment).map((subMap) =>
        Object.values(subMap).reduce((a, b) => a + b, 0),
      );
      const sortedTotals = [...allTotals].sort((a, b) => b - a);
      const position = sortedTotals.indexOf(studentTotal) + 1;

      const subjectStats: Record<string, any> = {};
      Object.entries(thisEnrolTotals).forEach(([csId, tt]) => {
        const name = csIdToName[csId];
        if (!name) return;
        const stats = sortedBySubject[name];
        subjectStats[name] = {
          position: stats.indexOf(tt) + 1,
          highest: stats[0],
          lowest: stats[stats.length - 1],
          average: stats.reduce((a, b) => a + b, 0) / stats.length,
        };
      });

      positions = {
        position,
        classSize: allTotals.length,
        total: studentTotal,
        average: avg,
        subjects: subjectStats,
      };
    }

    const record = recordRes.data;
    const studentData = (enrol as any).student;

    setViewingStudent({
      student: {
        id: studentData.id,
        reg_no: studentData.reg_no,
        name: studentData.name,
        gender: studentData.gender || "",
        age: studentData.age || "",
        enrolment_id: enrolmentId,
        assessment: {
          schoolName: "House Of Angels School",
          schoolAddress: "10, Albert Okolo St, Jakande Estate, Lagos, Nigeria",
          schoolEmail: "",
          schoolPhone: "08033848328",
          daysOpened:
            record?.days_opened != null ? String(record.days_opened) : "",
          daysPresent:
            record?.days_present != null ? String(record.days_present) : "",
          daysAbsent:
            record?.days_absent != null ? String(record.days_absent) : "",
          subjects,
          affective,
          psychomotor,
          teacherName: "",
          headTeacherName: "",
          teacherRemark: record?.class_teacher_comment || "",
          headRemark: record?.head_teacher_comment || "",
          nextTerm: "",
          promotion: "",
          classAvg: "",
          positions,
          termAverages: termAvgs.termAverages,
          cumulativeAverage: termAvgs.cumulativeAverage,
          status: record?.status || "draft",
        },
      },
      classRoom: {
        id: cls.id,
        name: cls.name,
        session: cls.session,
        term: termName,
        assignedTeacherId: null,
        studentIds: [],
      },
    });
  };

  // ────────────────────────────────────────────────────────────
  // Teacher handlers
  // ────────────────────────────────────────────────────────────
  const handleCreateOrUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim() || !newTeacherEmail.trim()) return;
    setIsSubmittingTeacher(true);
    setCreatedCredentials(null);
    try {
      if (editingTeacher) {
        await callAdminApi("update-teacher", {
          id: editingTeacher.id,
          name: newTeacherName.trim(),
          email: newTeacherEmail.trim(),
        });
        setTeachers((prev) =>
          prev.map((t) =>
            t.id === editingTeacher.id
              ? { ...t, name: newTeacherName, email: newTeacherEmail }
              : t,
          ),
        );
        setEditingTeacher(null);
        setNewTeacherName("");
        setNewTeacherEmail("");
      } else {
        const result = await callAdminApi("create-teacher", {
          name: newTeacherName.trim(),
          email: newTeacherEmail.trim(),
        });
        setCreatedCredentials({ email: result.email, pin: result.pin });
        await fetchData();
        setNewTeacherName("");
        setNewTeacherEmail("");
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsSubmittingTeacher(false);
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!confirm("Are you sure you want to delete this teacher?")) return;
    try {
      await callAdminApi("delete-teacher", { id });
      setTeachers((prev) => prev.filter((t) => t.id !== id));
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  // ────────────────────────────────────────────────────────────
  // Subject handlers
  // ────────────────────────────────────────────────────────────
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    setIsAddingSubject(true);
    try {
      await callAdminApi("add-subject", { name: newSubjectName.trim() });
      setNewSubjectName("");
      await fetchData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsAddingSubject(false);
    }
  };

  const handleDeleteSubject = async (id: string, name: string) => {
    const first = await callAdminApi("delete-subject", { id }).catch((err) => {
      return { error: err.message, requiresForce: true };
    });

    if (first?.error && first?.requiresForce) {
      if (
        !confirm(
          `"${name}" is used in one or more classes and has scores attached. ` +
            `Deleting it will also remove those scores. Continue?`,
        )
      )
        return;

      try {
        await callAdminApi("delete-subject", { id, force: true });
        await fetchData();
      } catch (error: any) {
        alert(`Error: ${error.message}`);
      }
      return;
    }

    if (first?.error) {
      alert(`Error: ${first.error}`);
      return;
    }

    await fetchData();
  };

  // ────────────────────────────────────────────────────────────
  // Class handlers
  // ────────────────────────────────────────────────────────────
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !newClassSession.trim()) return;

    try {
      if (editingClass) {
        await callAdminApi("update-class", {
          id: editingClass.id,
          name: newClassName,
          session: newClassSession,
        });
        await callAdminApi("set-class-subjects", {
          classId: editingClass.id,
          subjectIds: newClassSubjectIds,
        });
        setEditingClass(null);
        setNewClassName("");
        setNewClassSubjectIds([]);
        if (currentSession) setNewClassSession(currentSession.name);
        await fetchData();
      } else {
        await callAdminApi("create-class", {
          name: newClassName,
          session: newClassSession,
          subject_ids: newClassSubjectIds,
        });
        setNewClassName("");
        setNewClassSubjectIds([]);
        await fetchData();
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (
      !confirm(
        "Deleting this class will unassign all attached students and teachers. Continue?",
      )
    )
      return;
    try {
      await callAdminApi("delete-class", { id });
      setClasses((prev) => prev.filter((c) => c.id !== id));
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleAssignTeacherToClass = async (
    classId: string,
    teacherId: string,
  ) => {
    try {
      await callAdminApi("assign-teacher", {
        classId,
        teacherId: teacherId || null,
      });
      setClasses((prev) =>
        prev.map((cls) =>
          cls.id === classId
            ? { ...cls, assignedTeacherId: teacherId || null }
            : cls,
        ),
      );
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const toggleClassSubject = (subjectId: string) => {
    setNewClassSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId],
    );
  };

  // ────────────────────────────────────────────────────────────
  // Student handlers
  // ────────────────────────────────────────────────────────────
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentRegNo.trim()) return;
    try {
      if (editingStudent) {
        await callAdminApi("update-student", {
          id: editingStudent.id,
          name: newStudentName,
          reg_no: newStudentRegNo,
          class_id: selectedStudentClassId || null,
          gender: newStudentSex,
          age: newStudentAge,
        });
        setEditingStudent(null);
        resetStudentForm();
      } else {
        await callAdminApi("create-student", {
          name: newStudentName,
          reg_no: newStudentRegNo,
          class_id: selectedStudentClassId || null,
          gender: newStudentSex,
          age: newStudentAge,
        });
        resetStudentForm();
      }
      await fetchData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this student record?"))
      return;
    try {
      await callAdminApi("delete-student", { id });
      setStudents((prev) => prev.filter((s) => s.id !== id));
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const resetStudentForm = () => {
    setEditingStudent(null);
    setNewStudentName("");
    setNewStudentRegNo("");
    setNewStudentAge("");
    setNewStudentSex("");
    setSelectedStudentClassId("");
  };

  const filteredStudents = useMemo(() => {
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
        s.regNo.toLowerCase().includes(studentSearchQuery.toLowerCase()),
    );
  }, [students, studentSearchQuery]);

  const sessionSuggestions = allSessions.map((s) => s.name);
  const totalPending = pendingClasses.reduce((n, c) => n + c.submittedCount, 0);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        Loading control center...
      </div>
    );
  }

  if (viewingStudent) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm print:hidden">
            <button
              onClick={() => setViewingStudent(null)}
              className="text-xs bg-slate-800 text-white font-semibold px-4 py-2 rounded-lg hover:bg-slate-700 transition"
            >
              ← Back to Approvals
            </button>
            <div className="text-right">
              <p className="text-xs text-slate-500">
                Viewing Result (read-only)
              </p>
              <p className="text-sm font-bold text-slate-800">
                {viewingStudent.student.name} ({viewingStudent.student.reg_no})
              </p>
            </div>
          </div>

          <ResultsPage
            initialStudent={viewingStudent.student}
            initialClass={viewingStudent.classRoom}
            term={viewingStudent.classRoom.term || ""}
            readOnly
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Admin Control Console
          </h1>
          <p className="text-xs text-slate-500">
            Live Database CRUD Console
            {currentSession && currentTerm && (
              <>
                {" "}
                · {currentSession.name} · {currentTerm.name} Term
              </>
            )}
          </p>
        </div>

        <div className="w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold min-w-max">
            <button
              onClick={() => setActiveTab("teachers")}
              className={`px-3 py-2 rounded-lg transition ${activeTab === "teachers" ? "bg-blue-600 text-white shadow" : "text-slate-600"}`}
            >
              Teachers
            </button>
            <button
              onClick={() => setActiveTab("subjects")}
              className={`px-3 py-2 rounded-lg transition ${activeTab === "subjects" ? "bg-blue-600 text-white shadow" : "text-slate-600"}`}
            >
              Subjects
            </button>
            <button
              onClick={() => setActiveTab("classes")}
              className={`px-3 py-2 rounded-lg transition ${activeTab === "classes" ? "bg-blue-600 text-white shadow" : "text-slate-600"}`}
            >
              Class Rooms
            </button>
            <button
              onClick={() => setActiveTab("allocations")}
              className={`px-3 py-2 rounded-lg transition ${activeTab === "allocations" ? "bg-blue-600 text-white shadow" : "text-slate-600"}`}
            >
              Students
            </button>
            <button
              onClick={() => setActiveTab("approvals")}
              className={`px-3 py-2 rounded-lg transition ${activeTab === "approvals" ? "bg-blue-600 text-white shadow" : "text-slate-600"}`}
            >
              Approvals
              {totalPending > 0 && (
                <span className="ml-1 inline-block bg-amber-500 text-white text-[9px] px-1.5 rounded-full">
                  {totalPending}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3 py-2 rounded-lg transition ${activeTab === "settings" ? "bg-blue-600 text-white shadow" : "text-slate-600"}`}
            >
              Settings
            </button>
          </div>
        </div>
      </header>

      {/* TAB: TEACHERS */}
      {activeTab === "teachers" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4">
              {editingTeacher ? "Edit Teacher" : "Register Teacher"}
            </h2>
            <form
              onSubmit={handleCreateOrUpdateTeacher}
              className="space-y-3 sm:space-y-4"
            >
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-500 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-500 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newTeacherEmail}
                  onChange={(e) => setNewTeacherEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSubmittingTeacher}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-sm"
                >
                  {editingTeacher ? "Update Record" : "Create Account"}
                </button>
                {editingTeacher && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTeacher(null);
                      setNewTeacherName("");
                      setNewTeacherEmail("");
                    }}
                    className="px-3 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
            {createdCredentials && (
              <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                <p className="font-bold text-emerald-800">
                  Teacher Account Created!
                </p>
                <p className="text-slate-700">
                  <strong>Email:</strong> {createdCredentials.email}
                </p>
                <p className="text-slate-700">
                  <strong>Passcode:</strong> {createdCredentials.pin}
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4">
              Teacher Directory
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-100 text-slate-600 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teachers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-800">
                        {t.name}
                      </td>
                      <td className="p-3 text-slate-600">{t.email}</td>
                      <td className="p-3 space-x-3">
                        <button
                          onClick={() => {
                            setEditingTeacher(t);
                            setNewTeacherName(t.name);
                            setNewTeacherEmail(t.email);
                          }}
                          className="text-xs text-blue-600 font-bold hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTeacher(t.id)}
                          className="text-xs text-red-600 font-bold hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: SUBJECTS */}
      {activeTab === "subjects" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4">
              Add Subject
            </h2>
            <form
              onSubmit={handleAddSubject}
              className="space-y-3 sm:space-y-4"
            >
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-500 mb-1">
                  Subject Name
                </label>
                <input
                  type="text"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  required
                  placeholder="e.g. French"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={isAddingSubject}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-sm"
              >
                {isAddingSubject ? "Adding..." : "Add to Catalog"}
              </button>
              <p className="text-[10px] text-slate-400">
                Subjects you add here appear in the class creation form and in
                teacher compilers.
              </p>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4">
              Subject Catalog ({subjects.length})
            </h2>
            {subjects.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                No subjects yet. Add one on the left.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {subjects.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 border border-slate-200 rounded-lg flex justify-between items-center bg-slate-50"
                  >
                    <span className="text-sm text-slate-800 font-medium">
                      {s.name}
                    </span>
                    <button
                      onClick={() => handleDeleteSubject(s.id, s.name)}
                      className="text-xs text-red-600 font-bold hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: CLASSES */}
      {activeTab === "classes" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4">
              {editingClass ? "Edit Class" : "Create Class"}
            </h2>
            <form onSubmit={handleSaveClass} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-500 mb-1">
                  Class Name
                </label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  required
                  placeholder="Primary 4A"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-500 mb-1">
                  Session
                </label>
                <input
                  type="text"
                  list="session-suggestions"
                  value={newClassSession}
                  onChange={(e) => setNewClassSession(e.target.value)}
                  required
                  placeholder="e.g. 2025/2026"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <datalist id="session-suggestions">
                  {sessionSuggestions.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-500 mb-1">
                  Subjects Offered ({newClassSubjectIds.length} selected)
                </label>
                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                  {subjects.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No subjects yet. Add some in the Subjects tab first.
                    </p>
                  ) : (
                    subjects.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={newClassSubjectIds.includes(s.id)}
                          onChange={() => toggleClassSubject(s.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">{s.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!newClassName.trim() || !newClassSession.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-sm"
              >
                {editingClass ? "Update Class" : "Save Class"}
              </button>

              {editingClass && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingClass(null);
                    setNewClassName("");
                    setNewClassSubjectIds([]);
                    if (currentSession) setNewClassSession(currentSession.name);
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-sm transition"
                >
                  Cancel
                </button>
              )}
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4">
              Classes & Assigned Teachers
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {classes.map((cls) => {
                const clsSubjectIds = classSubjectIds[cls.id] || [];
                const clsSubjects = subjects.filter((s) =>
                  clsSubjectIds.includes(s.id),
                );
                return (
                  <div
                    key={cls.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-900">{cls.name}</h3>
                        <p className="text-[11px] text-slate-500">
                          {cls.session}
                        </p>
                      </div>
                      <div className="space-x-2">
                        <button
                          onClick={() => {
                            setEditingClass(cls);
                            setNewClassName(cls.name);
                            setNewClassSession(cls.session);
                            setNewClassSubjectIds(
                              classSubjectIds[cls.id] || [],
                            );
                          }}
                          className="text-xs text-blue-600 font-bold hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClass(cls.id)}
                          className="text-xs text-red-600 font-bold hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Subjects ({clsSubjects.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {clsSubjects.length === 0 ? (
                          <span className="text-[11px] text-slate-400 italic">
                            No subjects assigned
                          </span>
                        ) : (
                          clsSubjects.map((s) => (
                            <span
                              key={s.id}
                              className="inline-block bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-semibold"
                            >
                              {s.name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Form Teacher
                      </label>
                      <select
                        value={cls.assignedTeacherId || ""}
                        onChange={(e) =>
                          handleAssignTeacherToClass(cls.id, e.target.value)
                        }
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 outline-none"
                      >
                        <option value="">-- Unassigned --</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB: STUDENTS */}
      {activeTab === "allocations" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4">
              {editingStudent ? "Edit Student" : "Register Student"}
            </h2>
            <form
              onSubmit={handleSaveStudent}
              className="space-y-3 sm:space-y-4"
            >
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-500 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-500 mb-1">
                  Reg Number
                </label>
                <input
                  type="text"
                  value={newStudentRegNo}
                  onChange={(e) => setNewStudentRegNo(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-500 mb-1">
                  Age
                </label>
                <input
                  type="number"
                  min="0"
                  value={newStudentAge}
                  onChange={(e) => setNewStudentAge(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-500 mb-1">
                  Sex
                </label>
                <select
                  value={newStudentSex}
                  onChange={(e) => setNewStudentSex(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-200 rounded-xl p-2.5 outline-none"
                >
                  <option value="">-- Select --</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase text-slate-500 mb-1">
                  Assigned Class
                </label>
                <select
                  value={selectedStudentClassId}
                  onChange={(e) => setSelectedStudentClassId(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-200 rounded-xl p-2.5 outline-none"
                >
                  <option value="">-- Unassigned --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-sm"
                >
                  {editingStudent ? "Update Student" : "Register Student"}
                </button>
                {editingStudent && (
                  <button
                    type="button"
                    onClick={resetStudentForm}
                    className="px-3 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-4">
              <h2 className="text-sm sm:text-base font-bold text-slate-800">
                Student Directory
              </h2>
              <input
                type="text"
                placeholder="Search students..."
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-100 text-slate-600 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Reg No</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Age</th>
                    <th className="p-3">Sex</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-xs text-slate-600">
                        {s.regNo}
                      </td>
                      <td className="p-3 font-medium text-slate-800">
                        {s.name}
                      </td>
                      <td className="p-3 text-slate-600">{s.age || "—"}</td>
                      <td className="p-3 text-slate-600">{s.gender || "—"}</td>
                      <td className="p-3 text-slate-600">
                        {classes.find((c) => c.id === s.currentClassId)?.name ||
                          "Unassigned"}
                      </td>
                      <td className="p-3 space-x-3">
                        <button
                          onClick={() => {
                            setEditingStudent(s);
                            setNewStudentName(s.name);
                            setNewStudentRegNo(s.regNo);
                            setSelectedStudentClassId(s.currentClassId || "");
                            setNewStudentAge(s.age || "");
                            setNewStudentSex(s.gender || "");
                          }}
                          className="text-xs text-blue-600 font-bold hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(s.id)}
                          className="text-xs text-red-600 font-bold hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: APPROVALS */}
      {activeTab === "approvals" && (
        <div className="space-y-4 sm:space-y-6">
          {reviewClassId === null ? (
            <>
              {pendingClasses.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-500">
                  No classes pending approval right now.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingClasses.map((c) => (
                    <div
                      key={`${c.classId}-${c.termId}`}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3"
                    >
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {c.className}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {c.sessionName} · {c.termLabel}
                        </p>
                      </div>
                      <div className="flex gap-3 text-xs">
                        {c.submittedCount > 0 && (
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-2 py-0.5 font-semibold">
                            {c.submittedCount} awaiting
                          </span>
                        )}
                        {c.approvedCount > 0 && (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-2 py-0.5 font-semibold">
                            {c.approvedCount} approved
                          </span>
                        )}
                        <span className="text-slate-500">
                          {c.totalStudents} student
                          {c.totalStudents !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          handleOpenReview(c.classId, c.termId, c.sessionId)
                        }
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-xl text-sm transition shadow-sm"
                      >
                        Review Results
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <button
                    onClick={handleBackToList}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    ← Back to list
                  </button>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-500">
                      Reviewing
                    </p>
                    <p className="text-sm font-bold text-slate-800">
                      {
                        pendingClasses.find((c) => c.classId === reviewClassId)
                          ?.className
                      }
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Head Teacher Comment (applied to all on bulk approve)
                    </label>
                    <input
                      type="text"
                      value={bulkComment}
                      onChange={(e) => setBulkComment(e.target.value)}
                      placeholder="e.g. A good result. Keep it up."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleBatchPrintReview}
                    disabled={reviewLoading || batchPrinting}
                    className="bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-xl text-sm transition whitespace-nowrap"
                  >
                    {batchPrinting ? "Preparing PDF..." : "🖨 Print All"}
                  </button>
                  <button
                    onClick={() => {
                      const c = pendingClasses.find(
                        (x) => x.classId === reviewClassId,
                      );
                      if (c) handleApproveAll(c.termId);
                    }}
                    disabled={reviewLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold px-4 py-2 rounded-xl text-sm transition shadow-sm whitespace-nowrap"
                  >
                    {reviewLoading ? "Approving..." : "Approve All Submitted"}
                  </button>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                {reviewLoading ? (
                  <p className="text-sm text-slate-500 text-center py-6">
                    Loading...
                  </p>
                ) : reviewStudents.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">
                    No students.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {reviewStudents.map((s) => (
                      <div
                        key={s.enrolmentId}
                        className={`p-3 rounded-xl border ${
                          s.status === "approved"
                            ? "border-emerald-200 bg-emerald-50"
                            : s.status === "submitted"
                              ? "border-amber-200 bg-amber-50"
                              : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-800 text-sm truncate">
                                {s.name}
                              </p>
                              <span className="text-[10px] font-mono text-slate-500">
                                {s.regNo}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Status:{" "}
                              <span className="font-semibold">
                                {s.status === "submitted"
                                  ? "Awaiting approval"
                                  : s.status === "approved"
                                    ? "Approved"
                                    : "Draft"}
                              </span>
                            </p>
                          </div>

                          <div className="flex-1">
                            <input
                              type="text"
                              value={s.comment}
                              onChange={(e) => {
                                const v = e.target.value;
                                setReviewStudents((prev) =>
                                  prev.map((x) =>
                                    x.enrolmentId === s.enrolmentId
                                      ? { ...x, comment: v }
                                      : x,
                                  ),
                                );
                              }}
                              placeholder="Head teacher comment (optional)"
                              disabled={s.status === "approved"}
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </div>

                          <div className="flex gap-2 whitespace-nowrap">
                            <button
                              onClick={() => {
                                const c = pendingClasses.find(
                                  (x) => x.classId === reviewClassId,
                                );
                                if (c)
                                  handleViewResult(
                                    s.enrolmentId,
                                    c.classId,
                                    c.termId,
                                    c.sessionId,
                                  );
                              }}
                              className="text-xs bg-blue-50 text-blue-600 font-semibold px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition"
                            >
                              View
                            </button>

                            {s.status === "submitted" && (
                              <button
                                onClick={() => {
                                  const c = pendingClasses.find(
                                    (x) => x.classId === reviewClassId,
                                  );
                                  if (c)
                                    handleApproveStudent(
                                      s.enrolmentId,
                                      c.termId,
                                      s.comment,
                                    );
                                }}
                                disabled={busyEnrolmentId === s.enrolmentId}
                                className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold px-3 py-1.5 rounded-lg transition"
                              >
                                {busyEnrolmentId === s.enrolmentId
                                  ? "..."
                                  : "Approve"}
                              </button>
                            )}

                            {s.status === "approved" && (
                              <button
                                onClick={() => {
                                  const c = pendingClasses.find(
                                    (x) => x.classId === reviewClassId,
                                  );
                                  if (c)
                                    handleReopenStudent(
                                      s.enrolmentId,
                                      c.termId,
                                    );
                                }}
                                disabled={busyEnrolmentId === s.enrolmentId}
                                className="text-xs bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-semibold px-3 py-1.5 rounded-lg transition"
                              >
                                Reopen
                              </button>
                            )}

                            {s.status === "draft" && (
                              <span className="text-[11px] text-slate-400 italic px-2 py-1.5">
                                Waiting on teacher
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB: SETTINGS */}
      {activeTab === "settings" && <SettingsTab callAdminApi={callAdminApi} />}
    </div>
  );
}
