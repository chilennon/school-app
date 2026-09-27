"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ResultsPage from "./results/page";
import { ClassRoom } from "@/types/school";
import { computeTermAverages } from "@/lib/termAverages";
import { generateBatchReportCards, ReportCardInput } from "@/lib/reportCardPdf";
import { useSchoolConfig } from "@/hooks/useSchoolConfig";

interface ClassInfo {
  id: string;
  name: string;
  session: string;
  session_id: string | null;
}

interface TermInfo {
  id: string;
  name: string;
  sequence: number;
  is_current: boolean;
}

interface StudentInfo {
  id: string;
  name: string;
  reg_no: string;
  gender?: string;
  age?: string;
  enrolment_id: string;
  assessment?: any;
}

interface CatalogSubject {
  id: string;
  name: string;
}

type ClassStatus = "draft" | "submitted" | "approved" | "mixed";

function computePositions(students: any[]): Record<string, any> {
  const subjectTotals: Record<string, number[]> = {};

  students.forEach((s) => {
    (s.assessment?.subjects || []).forEach((sub: any) => {
      const ca = sub.ca !== "" ? parseFloat(sub.ca) : null;
      const ex = sub.exam !== "" ? parseFloat(sub.exam) : null;
      if (ca === null && ex === null) return;
      const tt = (ca || 0) + (ex || 0);
      if (!subjectTotals[sub.sub]) subjectTotals[sub.sub] = [];
      subjectTotals[sub.sub].push(tt);
    });
  });

  const statsBySubject: Record<
    string,
    { highest: number; lowest: number; average: number; sortedDesc: number[] }
  > = {};
  Object.entries(subjectTotals).forEach(([name, totals]) => {
    const sorted = [...totals].sort((a, b) => b - a);
    statsBySubject[name] = {
      highest: sorted[0],
      lowest: sorted[sorted.length - 1],
      average: totals.reduce((a, b) => a + b, 0) / totals.length,
      sortedDesc: sorted,
    };
  });

  const studentInfo: Record<string, any> = {};
  const studentTotals: { id: string; total: number }[] = [];

  students.forEach((s) => {
    const subs = s.assessment?.subjects || [];
    let total = 0;
    let count = 0;
    const subjectStats: Record<string, any> = {};

    subs.forEach((sub: any) => {
      const ca = sub.ca !== "" ? parseFloat(sub.ca) : null;
      const ex = sub.exam !== "" ? parseFloat(sub.exam) : null;
      if (ca === null && ex === null) return;
      const tt = (ca || 0) + (ex || 0);
      total += tt;
      count++;

      const stats = statsBySubject[sub.sub];
      const rank = stats.sortedDesc.indexOf(tt) + 1;
      subjectStats[sub.sub] = {
        position: rank,
        highest: stats.highest,
        lowest: stats.lowest,
        average: stats.average,
      };
    });

    const avg = count > 0 ? total / count : 0;
    studentTotals.push({ id: s.id, total });
    studentInfo[s.id] = {
      total,
      average: avg,
      classSize: students.length,
      position: 0,
      subjects: subjectStats,
    };
  });

  const sortedByTotal = [...studentTotals].sort((a, b) => b.total - a.total);
  studentTotals.forEach((st) => {
    const rank = sortedByTotal.findIndex((x) => x.total === st.total) + 1;
    studentInfo[st.id].position = rank;
  });

  return studentInfo;
}

function StatusBadge({ status }: { status: ClassStatus }) {
  const map = {
    draft: {
      label: "Draft — not yet submitted",
      bg: "bg-slate-100 text-slate-700 border-slate-200",
    },
    submitted: {
      label: "Submitted — awaiting approval",
      bg: "bg-amber-50 text-amber-800 border-amber-200",
    },
    approved: {
      label: "Approved — locked",
      bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    mixed: {
      label: "Mixed — some students need attention",
      bg: "bg-red-50 text-red-800 border-red-200",
    },
  } as const;
  const s = map[status];
  return (
    <span
      className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.bg}`}
    >
      {s.label}
    </span>
  );
}

const EMPTY_AFFECTIVE = {
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
const EMPTY_PSYCHOMOTOR = { p0: "", p1: "", p2: "", p3: "", p4: "", p5: "" };

export default function TeacherDashboardPage() {
  const { config, gradeFor } = useSchoolConfig();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState("");
  const [assignedClasses, setAssignedClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [classTerms, setClassTerms] = useState<TermInfo[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [gradeBands, setGradeBands] = useState<any[]>([]);
  const [catalogSubjects, setCatalogSubjects] = useState<CatalogSubject[]>([]);

  const [subjectMap, setSubjectMap] = useState<Record<string, string>>({});
  const [classStatus, setClassStatus] = useState<ClassStatus>("draft");
  const [submitting, setSubmitting] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [userEmail, setUserEmail] = useState("");

    const [activeCompilerData, setActiveCompilerData] = useState<{
    student: any;
    classRoom: ClassRoom;
  } | null>(null);

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const callTeacherApi = async (action: string, payload: any) => {
    const token = await getAccessToken();
    const response = await fetch("/api/teacher", {
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

  const fetchClassData = async (cls: ClassInfo, termId: string) => {
    const { data: classSubjects, error: csErr } = await supabase
      .from("class_subjects")
      .select(
        `
        id,
        subject:subjects (id, name, display_order)
      `,
      )
      .eq("class_id", cls.id)
      .eq("session_id", cls.session_id);

    if (csErr) console.error("class_subjects fetch failed:", csErr);

    const subjMap: Record<string, string> = {};
    const subjectOrder: {
      name: string;
      order: number;
      class_subject_id: string;
    }[] = [];

    (classSubjects || []).forEach((row: any) => {
      const name = row.subject?.name;
      if (name) {
        subjMap[name.toLowerCase()] = row.id;
        subjectOrder.push({
          name,
          order: row.subject.display_order ?? 0,
          class_subject_id: row.id,
        });
      }
    });
    subjectOrder.sort((a, b) => a.order - b.order);
    setSubjectMap(subjMap);

    const { data: enrolmentRows, error: enrErr } = await supabase
      .from("enrolments")
      .select(
        `
        id,
        student:students (id, name, reg_no, gender, age, assessment)
      `,
      )
      .eq("class_id", cls.id)
      .eq("session_id", cls.session_id)
      .eq("status", "active");

    if (enrErr) {
      console.error("enrolments fetch failed:", enrErr);
      return { students: [], subjectOrder };
    }

    const enrolmentList = (enrolmentRows || [])
      .map((r: any) => ({ enrolment_id: r.id, ...r.student }))
      .filter((s: any) => s && s.id);

    const enrolmentIds = enrolmentList.map((s: any) => s.enrolment_id);

    const scoresByEnrolment: Record<string, any[]> = {};
    const traitsByEnrolment: Record<string, any[]> = {};
    const recordsByEnrolment: Record<string, any> = {};

    if (enrolmentIds.length > 0) {
      const [scoreRes, traitRes, recordRes] = await Promise.all([
        supabase
          .from("scores")
          .select("*")
          .in("enrolment_id", enrolmentIds)
          .eq("term_id", termId),
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
      ]);

      if (scoreRes.error) console.error("scores fetch failed:", scoreRes.error);
      if (traitRes.error) console.error("traits fetch failed:", traitRes.error);
      if (recordRes.error)
        console.error("records fetch failed:", recordRes.error);

      (scoreRes.data || []).forEach((row: any) => {
        if (!scoresByEnrolment[row.enrolment_id])
          scoresByEnrolment[row.enrolment_id] = [];
        scoresByEnrolment[row.enrolment_id].push(row);
      });

      (traitRes.data || []).forEach((row: any) => {
        if (!traitsByEnrolment[row.enrolment_id])
          traitsByEnrolment[row.enrolment_id] = [];
        traitsByEnrolment[row.enrolment_id].push(row);
      });

      (recordRes.data || []).forEach((row: any) => {
        recordsByEnrolment[row.enrolment_id] = row;
      });
    }

    // Cumulative averages across all terms
    let termAveragesByEnrolment: Record<
      string,
      { termAverages: Record<string, number>; cumulativeAverage: number | null }
    > = {};

    if (enrolmentIds.length > 0 && cls.session_id) {
      const [termsRes, allScoresRes] = await Promise.all([
        supabase
          .from("terms")
          .select("id, name, sequence")
          .eq("session_id", cls.session_id)
          .order("sequence"),
        supabase
          .from("scores")
          .select("enrolment_id, term_id, ca_score, exam_score")
          .in("enrolment_id", enrolmentIds),
      ]);

      if (termsRes.data && allScoresRes.data) {
        termAveragesByEnrolment = computeTermAverages(
          allScoresRes.data as any,
          termsRes.data as any,
          enrolmentIds,
        );
      }
    }

    const statusSet = new Set<string>();
    enrolmentList.forEach((s: any) => {
      const rec = recordsByEnrolment[s.enrolment_id];
      statusSet.add(rec?.status || "draft");
    });

    let derivedStatus: ClassStatus = "draft";
    if (statusSet.size === 1) {
      derivedStatus = Array.from(statusSet)[0] as ClassStatus;
    } else if (statusSet.size > 1) {
      derivedStatus = "mixed";
    }
    setClassStatus(derivedStatus);

    const studentsBuilt = enrolmentList.map((s: any) => {
      const scoreRows = scoresByEnrolment[s.enrolment_id] || [];
      const scoreBySubjectId: Record<string, any> = {};
      scoreRows.forEach((r) => {
        scoreBySubjectId[r.class_subject_id] = r;
      });

      const subjects = subjectOrder.map((so, idx) => {
        const row = scoreBySubjectId[so.class_subject_id];
        return {
          id: idx,
          sub: so.name,
          ca: row?.ca_score != null ? String(row.ca_score) : "",
          exam: row?.exam_score != null ? String(row.exam_score) : "",
          sa: row?.sa_score != null ? String(row.sa_score) : "",
        };
      });

      const affective: Record<string, string> = { ...EMPTY_AFFECTIVE };
      const psychomotor: Record<string, string> = { ...EMPTY_PSYCHOMOTOR };

      (traitsByEnrolment[s.enrolment_id] || []).forEach((t: any) => {
        if (t.trait_domain === "affective" && t.trait_key in affective) {
          affective[t.trait_key] = t.rating != null ? String(t.rating) : "";
        } else if (
          t.trait_domain === "psychomotor" &&
          t.trait_key in psychomotor
        ) {
          psychomotor[t.trait_key] = t.rating != null ? String(t.rating) : "";
        }
      });

      const record = recordsByEnrolment[s.enrolment_id];

      return {
        id: s.id,
        name: s.name,
        reg_no: s.reg_no,
        gender: s.gender || "",
        age: s.age || "",
        enrolment_id: s.enrolment_id,
        assessment: {
          ...(s.assessment || {}),
          subjects,
          affective,
          psychomotor,
          daysOpened:
            record?.days_opened != null ? String(record.days_opened) : "",
          daysPresent:
            record?.days_present != null ? String(record.days_present) : "",
          daysAbsent:
            record?.days_absent != null ? String(record.days_absent) : "",
          teacherRemark: record?.class_teacher_comment || "",
          headRemark: record?.head_teacher_comment || "",
          termAverages:
            termAveragesByEnrolment[s.enrolment_id]?.termAverages || {},
          cumulativeAverage:
            termAveragesByEnrolment[s.enrolment_id]?.cumulativeAverage ?? null,
          status: record?.status || "draft",
        },
      };
    });

    const positionsByStudent = computePositions(studentsBuilt);
    studentsBuilt.forEach((st: any) => {
      st.assessment = {
        ...st.assessment,
        positions: positionsByStudent[st.id],
      };
    });

    return { students: studentsBuilt, subjectOrder };
  };

  // Load class + its terms, pick a default term, load data
  const loadClassWithTerms = async (cls: ClassInfo) => {
    setSelectedClass(cls);

    const { data: termsData } = await supabase
      .from("terms")
      .select("id, name, sequence, is_current")
      .eq("session_id", cls.session_id)
      .order("sequence");

    if (!termsData || termsData.length === 0) {
      setClassTerms([]);
      setSelectedTermId(null);
      setStudents([]);
      return;
    }

    setClassTerms(termsData as TermInfo[]);

    const defaultTerm = [...(termsData as TermInfo[])].sort(
      (a, b) => a.sequence - b.sequence,
    )[0];
    setSelectedTermId(defaultTerm.id);

    const { students: builtStudents } = await fetchClassData(
      cls,
      defaultTerm.id,
    );
    setStudents(builtStudents);
  };

  useEffect(() => {
    const fetchTeacherData = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/sign-in/staff");
        return;
      }

      setUserEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();
      if (profile) setTeacherName(profile.name);

      const { data: schoolRow } = await supabase
        .from("schools")
        .select("id")
        .limit(1)
        .single();
      if (schoolRow) setSchoolId(schoolRow.id);

      const { data: catalog } = await supabase
        .from("subjects")
        .select("id, name")
        .order("name");
      if (catalog) setCatalogSubjects(catalog as CatalogSubject[]);

      // ↓ ADDED: grade bands for report cards
      const { data: bandsData, error: bandsErr } = await supabase
        .from("grade_bands")
        .select("*")
        .order("display_order");
      if (bandsErr) console.error("grade_bands fetch failed:", bandsErr);
      if (bandsData) setGradeBands(bandsData);

      const { data: classData } = await supabase
        .from("classes")
        .select("id, name, session, session_id")
        .eq("teacher_id", user.id);

      if (classData && classData.length > 0) {
        setAssignedClasses(classData);
        await loadClassWithTerms(classData[0]);
      }

      setLoading(false);
    };

    fetchTeacherData();
  }, [router]);

  const handleSelectClass = async (cls: ClassInfo) => {
    setLoading(true);
    await loadClassWithTerms(cls);
    setLoading(false);
  };

  const handleSelectTerm = async (termId: string) => {
    if (!selectedClass) return;
    setSelectedTermId(termId);
    setLoading(true);
    const { students: builtStudents } = await fetchClassData(
      selectedClass,
      termId,
    );
    setStudents(builtStudents);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/sign-in/staff");
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: "error", text: "Please fill in all fields." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "New passwords do not match.",
      });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({
        type: "error",
        text: "Password must be at least 6 characters.",
      });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });
    if (signInError) {
      setPasswordMessage({
        type: "error",
        text: "Current password is incorrect.",
      });
      setPasswordLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) {
      setPasswordMessage({ type: "error", text: updateError.message });
    } else {
      setPasswordMessage({
        type: "success",
        text: "Password updated successfully!",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setShowPasswordForm(false), 1500);
    }
    setPasswordLoading(false);
  };

  const handleEnterScores = (student: StudentInfo) => {
    if (!selectedClass || !selectedTermId) return;

    const st = student.assessment?.status || "draft";
    if (st === "submitted") {
      alert("This student's result has already been submitted for approval.");
      return;
    }
    if (st === "approved") {
      alert("This student's result has been approved and locked.");
      return;
    }

    const formattedStudent = {
      id: student.id,
      reg_no: student.reg_no || student.id,
      name: student.name,
      gender: student.gender || "",
      age: student.age || "",
      enrolment_id: student.enrolment_id,
      assessment: student.assessment || {
        schoolName: "House Of Angels School",
        schoolAddress: "10, Albert Okolo St, Jakande Estate, Lagos, Nigeria",
        schoolEmail: "",
        schoolPhone: "08033848328",
        daysOpened: "",
        daysPresent: "",
        daysAbsent: "",
        subjects: [],
        affective: { ...EMPTY_AFFECTIVE },
        psychomotor: { ...EMPTY_PSYCHOMOTOR },
        teacherName: teacherName || "",
        headTeacherName: "",
        teacherRemark: "",
        headRemark: "",
        nextTerm: "",
        promotion: "",
        classAvg: "",
        status: "not_started",
      },
    };

    const formattedClassRoom: ClassRoom & { term: string } = {
      id: selectedClass.id,
      name: selectedClass.name,
      session: selectedClass.session,
      term: classTerms.find((t) => t.id === selectedTermId)?.name || "First",
      assignedTeacherId: null,
      studentIds: students.map((s) => s.id),
    };

    setActiveCompilerData({
      student: formattedStudent,
      classRoom: formattedClassRoom,
    });
  };

  const handleAddSubjectToClass = async (
    subjectId: string,
    subjectName: string,
  ): Promise<string | null> => {
    if (!selectedClass) return null;
    try {
      const result = await callTeacherApi("add-class-subject", {
        classId: selectedClass.id,
        subjectId,
      });
      if (result.classSubjectId) {
        setSubjectMap((prev) => ({
          ...prev,
          [subjectName.toLowerCase()]: result.classSubjectId,
        }));
        return result.classSubjectId;
      }
      return null;
    } catch (err: any) {
      alert(`Error adding subject: ${err.message}`);
      return null;
    }
  };

  const handleSubmitClassResults = async () => {
    if (!selectedClass || !selectedTermId) return;
    const termName =
      classTerms.find((t) => t.id === selectedTermId)?.name || "this term";

    if (
      !confirm(
        `Submit ${selectedClass.name} — ${termName} Term results for review?\n\n` +
          `Once submitted, you cannot edit scores until the head teacher either approves them or reopens the class.`,
      )
    )
      return;

    setSubmitting(true);
    try {
      await callTeacherApi("submit-class-results", {
        classId: selectedClass.id,
        termId: selectedTermId,
      });
      const { students: builtStudents } = await fetchClassData(
        selectedClass,
        selectedTermId,
      );
      setStudents(builtStudents);
      alert("Results submitted for approval.");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchPrint = () => {
    if (!selectedClass || !selectedTermId || students.length === 0) return;
    if (!gradeBands || gradeBands.length === 0) {
      alert(
        "School config not loaded yet. Please wait a moment and try again.",
      );
      return;
    }

    const termName =
      classTerms.find((t) => t.id === selectedTermId)?.name || "Term";

    const items: ReportCardInput[] = students.map((s) => {
      const asm = s.assessment || {};
      return {
        schoolName: asm.schoolName || config?.name || "House Of Angels School",
        schoolAddress: asm.schoolAddress || config?.address || "",
        schoolEmail: asm.schoolEmail || "",
        schoolPhone: asm.schoolPhone || config?.phone || "",
        studentName: s.name,
        studentId: s.reg_no || s.id,
        sex: s.gender || "",
        age: s.age || "",
        className: selectedClass.name,
        session: selectedClass.session,
        term: `${termName} Term`,
        classAvg: asm.classAvg || "",
        daysOpened: asm.daysOpened || "",
        daysPresent: asm.daysPresent || "",
        daysAbsent: asm.daysAbsent || "",
        subjects: asm.subjects || [],
        affective: asm.affective || {},
        psychomotor: asm.psychomotor || {},
        teacherName: asm.teacherName || teacherName || "",
        headTeacherName: asm.headTeacherName || "",
        teacherRemark: asm.teacherRemark || "",
        headRemark: asm.headRemark || "",
        nextTerm: asm.nextTerm || "",
        promotion: asm.promotion || "",
        positions: asm.positions,
        termAverages: asm.termAverages,
        cumulativeAverage: asm.cumulativeAverage,
        gradeBands,
      };
    });

    const doc = generateBatchReportCards(items);
    const safe = (s: string) => s.replace(/\s+/g, "_");
    doc.save(
      `${safe(selectedClass.name)}_${safe(termName)}_Term_ReportCards.pdf`,
    );
  };

  const handleReopenClassResults = async () => {
    if (!selectedClass || !selectedTermId) return;
    if (
      !confirm(
        "Reopen this class for editing? This will send results back to draft.",
      )
    )
      return;

    setSubmitting(true);
    try {
      await callTeacherApi("reopen-class-results", {
        classId: selectedClass.id,
        termId: selectedTermId,
      });
      const { students: builtStudents } = await fetchClassData(
        selectedClass,
        selectedTermId,
      );
      setStudents(builtStudents);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveToSupabase = async (
    updatedStudent: any,
    status: "draft" | "completed",
  ): Promise<void> => {
    const targetStudentId =
      updatedStudent?.id || activeCompilerData?.student?.id;
    const enrolmentId = activeCompilerData?.student?.enrolment_id;
    const termId = selectedTermId;

    if (!targetStudentId || !enrolmentId || !termId || !schoolId) {
      console.error("Missing ids to save", {
        targetStudentId,
        enrolmentId,
        termId,
        schoolId,
      });
      throw new Error("Missing required ids. Try reloading the page.");
    }

    const { data: freshRecord } = await supabase
      .from("term_records")
      .select("status")
      .eq("enrolment_id", enrolmentId)
      .eq("term_id", termId)
      .maybeSingle();

    const liveStatus = freshRecord?.status ?? "draft";
    if (liveStatus !== "draft") {
      throw new Error(
        `This student's result has been ${liveStatus}. Your changes were not saved. ` +
          `Reload the page to see the current status.`,
      );
    }

    const asm = updatedStudent?.assessment || {};

    const incomingSubjects: {
      sub: string;
      ca: string;
      exam: string;
      sa: string;
    }[] = asm.subjects || [];

    const scoreUpserts = incomingSubjects
      .map((s) => {
        const key = (s.sub || "").trim().toLowerCase();
        const classSubjectId = subjectMap[key];
        if (!classSubjectId) return null;
        return {
          school_id: schoolId,
          enrolment_id: enrolmentId,
          class_subject_id: classSubjectId,
          term_id: termId,
          ca_score: s.ca !== "" ? Number(s.ca) : null,
          exam_score: s.exam !== "" ? Number(s.exam) : null,
          sa_score: s.sa !== "" ? Number(s.sa) : null,
          status,
          server_updated_at: new Date().toISOString(),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (scoreUpserts.length > 0) {
      const { error } = await supabase.from("scores").upsert(scoreUpserts, {
        onConflict: "enrolment_id,class_subject_id,term_id",
      });
      if (error) throw new Error(`Failed to save scores: ${error.message}`);
    }

    await supabase
      .from("trait_ratings")
      .delete()
      .eq("enrolment_id", enrolmentId)
      .eq("term_id", termId);

    const traitRows: any[] = [];
    Object.entries(asm.affective || {}).forEach(([k, v]) => {
      if (v !== "" && v != null) {
        traitRows.push({
          school_id: schoolId,
          enrolment_id: enrolmentId,
          term_id: termId,
          trait_key: k,
          trait_domain: "affective",
          rating: Number(v),
          server_updated_at: new Date().toISOString(),
        });
      }
    });
    Object.entries(asm.psychomotor || {}).forEach(([k, v]) => {
      if (v !== "" && v != null) {
        traitRows.push({
          school_id: schoolId,
          enrolment_id: enrolmentId,
          term_id: termId,
          trait_key: k,
          trait_domain: "psychomotor",
          rating: Number(v),
          server_updated_at: new Date().toISOString(),
        });
      }
    });

    if (traitRows.length > 0) {
      const { error } = await supabase.from("trait_ratings").insert(traitRows);
      if (error) throw new Error(`Failed to save traits: ${error.message}`);
    }

    const { error: recordError } = await supabase.from("term_records").upsert(
      [
        {
          school_id: schoolId,
          enrolment_id: enrolmentId,
          term_id: termId,
          days_opened:
            asm.daysOpened !== "" && asm.daysOpened != null
              ? Number(asm.daysOpened)
              : null,
          days_present:
            asm.daysPresent !== "" && asm.daysPresent != null
              ? Number(asm.daysPresent)
              : null,
          days_absent:
            asm.daysAbsent !== "" && asm.daysAbsent != null
              ? Number(asm.daysAbsent)
              : null,
          class_teacher_comment: asm.teacherRemark || null,
          head_teacher_comment: asm.headRemark || null,
          server_updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "enrolment_id,term_id" },
    );

    if (recordError)
      throw new Error(
        `Failed to save attendance/remarks: ${recordError.message}`,
      );

    const {
      subjects: _s,
      affective: _a,
      psychomotor: _p,
      daysOpened: _do,
      daysPresent: _dp,
      daysAbsent: _da,
      teacherRemark: _tr,
      headRemark: _hr,
      positions: _pos,
      ...leftoverAssessment
    } = asm;

    const updatedAssessment = { ...leftoverAssessment, status };

    const { data, error } = await supabase
      .from("students")
      .update({
        name: updatedStudent.name,
        gender: updatedStudent.gender || null,
        age: updatedStudent.age || null,
        assessment: updatedAssessment,
      })
      .eq("id", targetStudentId)
      .select("*")
      .single();

    if (error)
      throw new Error(`Failed to save student record: ${error.message}`);

    const savedStudent = {
      ...(data || updatedStudent),
      assessment: {
        ...updatedAssessment,
        subjects: incomingSubjects,
        affective: asm.affective,
        psychomotor: asm.psychomotor,
        daysOpened: asm.daysOpened,
        daysPresent: asm.daysPresent,
        daysAbsent: asm.daysAbsent,
        teacherRemark: asm.teacherRemark,
        headRemark: asm.headRemark,
        positions: asm.positions,
        termAverages: asm.termAverages,
        cumulativeAverage: asm.cumulativeAverage,
      },
    };

    setStudents((prev) =>
      prev.map((s) =>
        s.id === targetStudentId ? { ...s, ...savedStudent } : s,
      ),
    );
    setActiveCompilerData((prev) =>
      prev ? { ...prev, student: { ...prev.student, ...savedStudent } } : prev,
    );
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        Loading teacher workspace...
      </div>
    );
  }

  if (activeCompilerData) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm print:hidden">
            <button
              onClick={() => setActiveCompilerData(null)}
              className="text-xs bg-slate-800 text-white font-semibold px-4 py-2 rounded-lg hover:bg-slate-700 transition"
            >
              ← Back to Dashboard
            </button>
            <div className="text-right">
              <p className="text-xs text-slate-500">Currently Editing</p>
              <p className="text-sm font-bold text-slate-800">
                {activeCompilerData.student.name} (
                {activeCompilerData.student.reg_no})
              </p>
            </div>
          </div>

          <ResultsPage
            initialStudent={activeCompilerData.student}
            initialClass={activeCompilerData.classRoom}
            term={
              classTerms.find((t) => t.id === selectedTermId)?.name || "First"
            }
            availableSubjects={catalogSubjects}
            onAddSubject={handleAddSubjectToClass}
            onSaveDraft={(updatedStudent: any) =>
              handleSaveToSupabase(updatedStudent, "draft")
            }
            onComplete={(updatedStudent: any) =>
              handleSaveToSupabase(updatedStudent, "completed")
            }
          />
        </div>
      </div>
    );
  }

  const selectedTermName =
    classTerms.find((t) => t.id === selectedTermId)?.name || "";

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-600">
              House Of Angels School
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              Welcome, {teacherName || "Teacher"}
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="text-xs bg-slate-100 text-slate-700 font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-200 transition"
            >
              Change Password
            </button>
            <button
              onClick={handleLogout}
              className="text-xs bg-red-50 text-red-600 font-medium px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-100 transition"
            >
              Sign Out
            </button>
          </div>
        </header>

        {showPasswordForm && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              Change Password
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Enter current password"
                />
              </div>
              <div className="hidden md:block"></div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            {passwordMessage && (
              <p
                className={`text-sm ${passwordMessage.type === "success" ? "text-green-600" : "text-red-600"}`}
              >
                {passwordMessage.text}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handlePasswordChange}
                disabled={passwordLoading}
                className="text-xs bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {passwordLoading ? "Updating..." : "Update Password"}
              </button>
              <button
                onClick={() => setShowPasswordForm(false)}
                className="text-xs bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {assignedClasses.length > 0 ? (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-700 uppercase mb-3">
                Your Assigned Classes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {assignedClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => handleSelectClass(cls)}
                    className={`p-4 rounded-xl text-left border transition ${
                      selectedClass?.id === cls.id
                        ? "border-blue-600 bg-blue-50 ring-2 ring-blue-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <h3 className="font-bold text-slate-900">{cls.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Session: {cls.session}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {selectedClass && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                {/* Term tabs */}
                <div className="flex gap-2 mb-4 border-b border-slate-200">
                  {classTerms.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTerm(t.id)}
                      className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
                        selectedTermId === t.id
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {t.name} Term
                      {t.is_current && (
                        <span className="ml-2 text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full uppercase">
                          current
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {classStatus === "mixed" && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-red-600 text-lg">⚠</span>
                      <h3 className="font-bold text-red-900 text-sm">
                        {
                          students.filter(
                            (s) => s.assessment?.status === "draft",
                          ).length
                        }{" "}
                        student
                        {students.filter(
                          (s) => s.assessment?.status === "draft",
                        ).length !== 1
                          ? "s"
                          : ""}{" "}
                        need
                        {students.filter(
                          (s) => s.assessment?.status === "draft",
                        ).length === 1
                          ? "s"
                          : ""}{" "}
                        your attention
                      </h3>
                    </div>
                    <p className="text-xs text-red-700 mb-3">
                      The head teacher sent these results back. Click a name to
                      open the compiler and fix them.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {students
                        .filter((s) => s.assessment?.status === "draft")
                        .map((s) => (
                          <button
                            key={s.id}
                            onClick={() => handleEnterScores(s)}
                            className="text-xs bg-white border border-red-300 text-red-800 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 transition"
                          >
                            {s.name} →
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedClass.name} — {selectedTermName} Term Roster (
                      {students.length})
                    </h2>
                    <StatusBadge status={classStatus} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleBatchPrint}
                      disabled={students.length === 0}
                      className="text-xs bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-lg transition"
                    >
                      🖨 Print All
                    </button>
                    {(classStatus === "draft" || classStatus === "mixed") && (
                      <button
                        onClick={handleSubmitClassResults}
                        disabled={submitting}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold px-4 py-2 rounded-lg transition"
                      >
                        {submitting
                          ? "Submitting..."
                          : `Submit ${selectedTermName} Term`}
                      </button>
                    )}
                    {classStatus === "submitted" && (
                      <button
                        onClick={handleReopenClassResults}
                        disabled={submitting}
                        className="text-xs bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-lg transition"
                      >
                        {submitting ? "Reopening..." : "Reopen for Edits"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[10px]">
                      <tr>
                        <th className="p-3 border-b">Reg No</th>
                        <th className="p-3 border-b">Student Name</th>
                        <th className="p-3 border-b">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.length > 0 ? (
                        students.map((student) => (
                          <tr key={student.id} className="hover:bg-slate-50">
                            <td className="p-3 font-mono text-xs text-slate-600">
                              {student.reg_no}
                            </td>
                            <td className="p-3 font-medium text-slate-800">
                              {student.name}
                            </td>
                            <td className="p-3">
                              {(() => {
                                const st =
                                  student.assessment?.status || "draft";
                                if (st === "submitted") {
                                  return (
                                    <span className="text-[11px] text-amber-700 italic">
                                      Awaiting approval
                                    </span>
                                  );
                                }
                                if (st === "approved") {
                                  return (
                                    <span className="text-[11px] text-emerald-700 italic">
                                      Approved — locked
                                    </span>
                                  );
                                }
                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleEnterScores(student)}
                                    className="text-xs bg-blue-50 text-blue-600 font-semibold px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
                                  >
                                    {student.assessment?.status === "draft"
                                      ? "Edit Scores"
                                      : "Enter Scores"}
                                  </button>
                                );
                              })()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={3}
                            className="p-4 text-center text-slate-500 text-xs"
                          >
                            No students registered in this class.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-amber-800 text-center">
            <p className="font-bold">No Allocated Classes Found</p>
          </div>
        )}
      </div>
    </div>
  );
}
