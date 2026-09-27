"use client";

import React, { useState, useEffect, useMemo } from "react";
import { User, ClassRoom, Student } from "@/types/school";
import { supabase } from "@/lib/supabaseClient";

// Options for the class form dropdowns
const SESSION_OPTIONS = ["2023/2024", "2024/2025", "2025/2026", "2026/2027", "2027/2028"];
const TERM_OPTIONS = ["First Term", "Second Term", "Third Term"];

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"teachers" | "classes" | "allocations">("teachers");

  const [teachers, setTeachers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [isSubmittingTeacher, setIsSubmittingTeacher] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; pin: string } | null>(null);

  const [newClassName, setNewClassName] = useState("");
  const [newClassSession, setNewClassSession] = useState(SESSION_OPTIONS[2]); // default 2025/2026
  const [newClassTerm, setNewClassTerm] = useState(TERM_OPTIONS[2]);          // default Third Term

  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentRegNo, setNewStudentRegNo] = useState("");
  const [selectedStudentClassId, setSelectedStudentClassId] = useState("");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");

  // -------------------------------------------------------------
  // FETCH ALL DATA FROM SUPABASE
  // -------------------------------------------------------------
  const fetchData = async () => {
    setLoading(true);

    const { data: teachersData } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "teacher");

    const { data: classesData } = await supabase.from("classes").select("*");
    const { data: studentsData } = await supabase.from("students").select("*");

    if (teachersData) {
      setTeachers(
        teachersData.map((t) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          role: t.role,
        }))
      );
    }

    if (classesData) {
      setClasses(
        classesData.map((c) => ({
          id: c.id,
          name: c.name,
          session: c.session,
          term: c.term,
          assignedTeacherId: c.teacher_id,
          studentIds: [],
        }))
      );
    }

    if (studentsData) {
      setStudents(
        studentsData.map((s) => ({
          id: s.id,
          name: s.name,
          regNo: s.reg_no,
          currentClassId: s.class_id,
        }))
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // -------------------------------------------------------------
  // 1. REGISTER NEW TEACHER
  // -------------------------------------------------------------
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim() || !newTeacherEmail.trim()) return;

    setIsSubmittingTeacher(true);
    setCreatedCredentials(null);

    const tempPin = Math.floor(100000 + Math.random() * 900000).toString();
    const tempPassword = `Teacher#${tempPin}`;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newTeacherEmail.trim(),
      password: tempPassword,
    });

    if (authError || !authData.user) {
      alert(`Error creating teacher auth account: ${authError?.message}`);
      setIsSubmittingTeacher(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert([
      {
        id: authData.user.id,
        name: newTeacherName.trim(),
        email: newTeacherEmail.trim(),
        role: "teacher",
      },
    ]);

    if (profileError) {
      alert(`Account created, but profile mapping failed: ${profileError.message}`);
    } else {
      setTeachers((prev) => [
        ...prev,
        {
          id: authData.user!.id,
          name: newTeacherName.trim(),
          email: newTeacherEmail.trim(),
          role: "teacher",
        },
      ]);

      setCreatedCredentials({
        email: newTeacherEmail.trim(),
        pin: tempPassword,
      });

      setNewTeacherName("");
      setNewTeacherEmail("");
    }

    setIsSubmittingTeacher(false);
  };

  // -------------------------------------------------------------
  // 2. CREATE CLASSROOM (with session and term dropdowns)
  // -------------------------------------------------------------
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    if (!newClassSession || !newClassTerm) {
      alert("Please select a session and term.");
      return;
    }

    const { data, error } = await supabase
      .from("classes")
      .insert([
        {
          name: newClassName,
          session: newClassSession,
          term: newClassTerm,
          teacher_id: null,
        },
      ])
      .select();

    if (!error && data) {
      setClasses((prev) => [
        ...prev,
        {
          id: data[0].id,
          name: data[0].name,
          session: data[0].session,
          term: data[0].term,
          assignedTeacherId: null,
          studentIds: [],
        },
      ]);
      setNewClassName("");
      // Keep session/term as they were, so the admin can quickly create
      // multiple classes in the same session/term. Reset if you prefer:
      // setNewClassSession(SESSION_OPTIONS[2]);
      // setNewClassTerm(TERM_OPTIONS[2]);
    }
  };

  // -------------------------------------------------------------
  // 3. REGISTER STUDENT
  // -------------------------------------------------------------
  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentRegNo.trim()) return;

    const targetClassId = selectedStudentClassId || null;

    const { data, error } = await supabase
      .from("students")
      .insert([
        {
          name: newStudentName,
          reg_no: newStudentRegNo,
          class_id: targetClassId,
        },
      ])
      .select();

    if (!error && data) {
      setStudents((prev) => [
        {
          id: data[0].id,
          name: data[0].name,
          regNo: data[0].reg_no,
          currentClassId: data[0].class_id,
        },
        ...prev,
      ]);

      setNewStudentName("");
      setNewStudentRegNo("");
      setSelectedStudentClassId("");
    }
  };

  // -------------------------------------------------------------
  // 4. ASSIGN TEACHER TO CLASS
  // -------------------------------------------------------------
  const handleAssignTeacherToClass = async (classId: string, teacherId: string) => {
    const assignedTeacher = teacherId || null;

    const { error } = await supabase
      .from("classes")
      .update({ teacher_id: assignedTeacher })
      .eq("id", classId);

    if (!error) {
      setClasses((prev) =>
        prev.map((cls) => (cls.id === classId ? { ...cls, assignedTeacherId: assignedTeacher } : cls))
      );
    }
  };

  // -------------------------------------------------------------
  // 5. ASSIGN STUDENT TO CLASS
  // -------------------------------------------------------------
  const handleAssignStudentToClass = async (studentId: string, targetClassId: string) => {
    const assignedClass = targetClassId || null;

    const { error } = await supabase
      .from("students")
      .update({ class_id: assignedClass })
      .eq("id", studentId);

    if (!error) {
      setStudents((prev) =>
        prev.map((std) => (std.id === studentId ? { ...std, currentClassId: assignedClass } : std))
      );
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
        s.regNo.toLowerCase().includes(studentSearchQuery.toLowerCase())
    );
  }, [students, studentSearchQuery]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Loading database records...</div>;
  }

  return (
    <div className="p-6">
      {/* Top Header & Navigation */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Control Center</h1>
          <p className="text-sm text-slate-500">Connected to Live Supabase Instance</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab("teachers")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === "teachers" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:text-slate-900"}`}
          >
            Teachers
          </button>
          <button
            onClick={() => setActiveTab("classes")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === "classes" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:text-slate-900"}`}
          >
            Class Rooms
          </button>
          <button
            onClick={() => setActiveTab("allocations")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === "allocations" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:text-slate-900"}`}
          >
            Student Directory
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {/* TAB 1: TEACHER MANAGEMENT & CREATION */}
        {activeTab === "teachers" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Register New Teacher</h2>
              <form onSubmit={handleCreateTeacher} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={newTeacherName}
                    onChange={(e) => setNewTeacherName(e.target.value)}
                    required
                    placeholder="e.g. Mr. John Keating"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newTeacherEmail}
                    onChange={(e) => setNewTeacherEmail(e.target.value)}
                    required
                    placeholder="e.g. keating@school.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingTeacher}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 rounded-lg text-sm transition shadow"
                >
                  {isSubmittingTeacher ? "Creating Account..." : "Generate Teacher Account"}
                </button>
              </form>

              {createdCredentials && (
                <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <h3 className="text-sm font-bold text-emerald-800 mb-1">✓ Teacher Account Created</h3>
                  <p className="text-xs text-emerald-600 mb-3">Provide these initial login credentials to the teacher:</p>
                  <div className="space-y-1 font-mono text-xs bg-white p-2.5 rounded border border-emerald-200 text-slate-700">
                    <p><strong>Email:</strong> {createdCredentials.email}</p>
                    <p><strong>Temp Password:</strong> {createdCredentials.pin}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Registered Teachers Roster</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                    <tr>
                      <th className="p-3 border-b">Teacher Name</th>
                      <th className="p-3 border-b">Email</th>
                      <th className="p-3 border-b">Assigned Class(es)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teachers.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">{t.name}</td>
                        <td className="p-3 text-slate-600">{t.email}</td>
                        <td className="p-3">
                          {classes
                            .filter((c) => c.assignedTeacherId === t.id)
                            .map((c) => (
                              <span key={c.id} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-semibold mr-1">
                                {c.name}
                              </span>
                            )) || <span className="text-slate-400 text-xs">Unassigned</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CLASS MANAGEMENT */}
        {activeTab === "classes" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Create New Class</h2>
              <form onSubmit={handleCreateClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Class Name</label>
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    required
                    placeholder="e.g. Primary 5B"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Session</label>
                  <select
                    value={newClassSession}
                    onChange={(e) => setNewClassSession(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SESSION_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Term</label>
                  <select
                    value={newClassTerm}
                    onChange={(e) => setNewClassTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TERM_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition shadow">
                  Create Class
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Classroom Matrix</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classes.map((cls) => (
                  <div key={cls.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{cls.name}</h3>
                                            <p className="text-xs text-slate-500 mt-1">Session: {cls.session}</p>
                    </div>
                    <div className="mt-4">
                      <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Form Teacher</label>
                      <select
                        value={cls.assignedTeacherId || ""}
                        onChange={(e) => handleAssignTeacherToClass(cls.id, e.target.value)}
                        className="w-full text-sm bg-white border border-slate-300 rounded-lg p-2 outline-none"
                      >
                        <option value="">-- Unassigned --</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STUDENT REGISTRATION */}
        {activeTab === "allocations" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Register New Student</h2>
              <form onSubmit={handleRegisterStudent} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    required
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Registration Number</label>
                  <input
                    type="text"
                    value={newStudentRegNo}
                    onChange={(e) => setNewStudentRegNo(e.target.value)}
                    required
                    placeholder="e.g. STU/2025/089"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Initial Class Assignment</label>
                  <select
                    value={selectedStudentClassId}
                    onChange={(e) => setSelectedStudentClassId(e.target.value)}
                    className="w-full text-sm bg-white border border-slate-300 rounded-lg p-2 outline-none"
                  >
                    <option value="">-- Unassigned --</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg text-sm transition shadow">
                  Register & Assign
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                <h2 className="text-lg font-bold text-slate-800">Student Directory</h2>
                <input
                  type="text"
                  placeholder="Search student by name or Reg No..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="w-full sm:w-64 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                    <tr>
                      <th className="p-3 border-b">Reg No</th>
                      <th className="p-3 border-b">Student Name</th>
                      <th className="p-3 border-b">Assigned Classroom</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-xs text-slate-600">{student.regNo}</td>
                          <td className="p-3 font-medium text-slate-800">{student.name}</td>
                          <td className="p-3">
                            <select
                              value={student.currentClassId || ""}
                              onChange={(e) => handleAssignStudentToClass(student.id, e.target.value)}
                              className="text-sm bg-white border border-slate-300 rounded-lg px-2 py-1 outline-none"
                            >
                              <option value="">-- Unassigned --</option>
                              {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-slate-500">No matching students found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};