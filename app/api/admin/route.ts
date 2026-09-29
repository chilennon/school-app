import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin" || !profile.school_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const callerSchoolId = profile.school_id;

    switch (action) {
      // ──────────────────────────────────────────────────────────
      // APPROVALS
      // ──────────────────────────────────────────────────────────
      case "approve-student": {
        const { enrolmentId, termId, headComment } = body;
        if (!enrolmentId || !termId) {
          return NextResponse.json(
            { error: "Missing fields" },
            { status: 400 }
          );
        }

        // Verify enrolment belongs to caller's school
        const { data: enrol } = await supabaseAdmin
          .from("enrolments")
          .select("id")
          .eq("id", enrolmentId)
          .eq("school_id", callerSchoolId)
          .maybeSingle();

        if (!enrol) {
          return NextResponse.json(
            { error: "Enrolment not found" },
            { status: 404 }
          );
        }

        const { error } = await supabaseAdmin.from("term_records").upsert(
          [
            {
              school_id: callerSchoolId,
              enrolment_id: enrolmentId,
              term_id: termId,
              status: "approved",
              head_teacher_comment: headComment ?? null,
              approved_by: user.id,
              approved_at: new Date().toISOString(),
              server_updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "enrolment_id,term_id" }
        );

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      case "reopen-student": {
        const { enrolmentId, termId } = body;
        if (!enrolmentId || !termId) {
          return NextResponse.json(
            { error: "Missing fields" },
            { status: 400 }
          );
        }

        const { data: enrol } = await supabaseAdmin
          .from("enrolments")
          .select("id")
          .eq("id", enrolmentId)
          .eq("school_id", callerSchoolId)
          .maybeSingle();

        if (!enrol) {
          return NextResponse.json(
            { error: "Enrolment not found" },
            { status: 404 }
          );
        }

        const { error } = await supabaseAdmin
          .from("term_records")
          .update({
            status: "draft",
            approved_by: null,
            approved_at: null,
            server_updated_at: new Date().toISOString(),
          })
          .eq("school_id", callerSchoolId)
          .eq("enrolment_id", enrolmentId)
          .eq("term_id", termId);

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      // ──────────────────────────────────────────────────────────
      // SESSIONS & TERMS (Settings)
      // ──────────────────────────────────────────────────────────
      case "create-session": {
        const { name } = body;
        if (!name || !name.trim()) {
          return NextResponse.json(
            { error: "Session name required" },
            { status: 400 }
          );
        }
        const trimmed = String(name).trim();

        const { data: existing } = await supabaseAdmin
          .from("sessions")
          .select("id")
          .eq("school_id", callerSchoolId)
          .eq("name", trimmed)
          .maybeSingle();

        if (existing) {
          return NextResponse.json(
            { error: `Session "${trimmed}" already exists` },
            { status: 400 }
          );
        }

        const { data: newSession, error: sessErr } = await supabaseAdmin
          .from("sessions")
          .insert([
            { school_id: callerSchoolId, name: trimmed, is_current: false },
          ])
          .select()
          .single();

        if (sessErr || !newSession) {
          return NextResponse.json(
            { error: sessErr?.message || "Session creation failed" },
            { status: 500 }
          );
        }

        const { error: termErr } = await supabaseAdmin.from("terms").insert([
          {
            school_id: callerSchoolId,
            session_id: newSession.id,
            name: "First",
            sequence: 1,
            is_current: false,
          },
          {
            school_id: callerSchoolId,
            session_id: newSession.id,
            name: "Second",
            sequence: 2,
            is_current: false,
          },
          {
            school_id: callerSchoolId,
            session_id: newSession.id,
            name: "Third",
            sequence: 3,
            is_current: false,
          },
        ]);

        if (termErr) {
          return NextResponse.json({ error: termErr.message }, { status: 500 });
        }

        return NextResponse.json({ session: newSession });
      }

      case "set-current-session": {
        const { sessionId } = body;
        if (!sessionId) {
          return NextResponse.json(
            { error: "Missing sessionId" },
            { status: 400 }
          );
        }

        // Verify session belongs to caller's school
        const { data: targetSession } = await supabaseAdmin
          .from("sessions")
          .select("id")
          .eq("id", sessionId)
          .eq("school_id", callerSchoolId)
          .maybeSingle();

        if (!targetSession) {
          return NextResponse.json(
            { error: "Session not found" },
            { status: 404 }
          );
        }

        // Clear current flag — scoped to this school only
        const { error: clearErr } = await supabaseAdmin
          .from("sessions")
          .update({ is_current: false })
          .eq("school_id", callerSchoolId)
          .eq("is_current", true);

        if (clearErr)
          return NextResponse.json(
            { error: clearErr.message },
            { status: 500 }
          );

        const { error: setErr } = await supabaseAdmin
          .from("sessions")
          .update({ is_current: true })
          .eq("id", sessionId)
          .eq("school_id", callerSchoolId);

        if (setErr)
          return NextResponse.json({ error: setErr.message }, { status: 500 });

        // If no term inside this session is current yet, mark First as current
        const { data: currentTerms } = await supabaseAdmin
          .from("terms")
          .select("id")
          .eq("school_id", callerSchoolId)
          .eq("session_id", sessionId)
          .eq("is_current", true);

        if (!currentTerms || currentTerms.length === 0) {
          const { data: firstTerm } = await supabaseAdmin
            .from("terms")
            .select("id")
            .eq("school_id", callerSchoolId)
            .eq("session_id", sessionId)
            .eq("name", "First")
            .maybeSingle();

          if (firstTerm) {
            await supabaseAdmin
              .from("terms")
              .update({ is_current: true })
              .eq("id", firstTerm.id)
              .eq("school_id", callerSchoolId);
          }
        }

        return NextResponse.json({ success: true });
      }

      case "set-current-term": {
        const { termId } = body;
        if (!termId) {
          return NextResponse.json(
            { error: "Missing termId" },
            { status: 400 }
          );
        }

        const { data: term } = await supabaseAdmin
          .from("terms")
          .select("id, session_id")
          .eq("id", termId)
          .eq("school_id", callerSchoolId)
          .maybeSingle();

        if (!term) {
          return NextResponse.json({ error: "Term not found" }, { status: 404 });
        }

        const { error: clearErr } = await supabaseAdmin
          .from("terms")
          .update({ is_current: false })
          .eq("school_id", callerSchoolId)
          .eq("session_id", term.session_id);

        if (clearErr)
          return NextResponse.json(
            { error: clearErr.message },
            { status: 500 }
          );

        const { error: setErr } = await supabaseAdmin
          .from("terms")
          .update({ is_current: true })
          .eq("id", termId)
          .eq("school_id", callerSchoolId);

        if (setErr)
          return NextResponse.json({ error: setErr.message }, { status: 500 });

        return NextResponse.json({ success: true });
      }

      case "update-term": {
        const { termId, next_term_begins, days_opened } = body;
        if (!termId) {
          return NextResponse.json(
            { error: "Missing termId" },
            { status: 400 }
          );
        }

        const updates: any = {};
        if (next_term_begins !== undefined) {
          updates.next_term_begins = next_term_begins || null;
        }
        if (days_opened !== undefined) {
          updates.days_opened =
            days_opened === "" || days_opened == null
              ? null
              : Number(days_opened);
        }

        if (Object.keys(updates).length === 0) {
          return NextResponse.json({ success: true });
        }

        const { error } = await supabaseAdmin
          .from("terms")
          .update(updates)
          .eq("id", termId)
          .eq("school_id", callerSchoolId);

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      // ──────────────────────────────────────────────────────────
      // TEACHERS
      // ──────────────────────────────────────────────────────────
      case "create-teacher": {
        const { name, email } = body;
        if (!name || !email) {
          return NextResponse.json(
            { error: "Name and email required" },
            { status: 400 }
          );
        }

        const tempPin = Math.floor(
          100000 + Math.random() * 900000
        ).toString();
        const tempPassword = `Teacher#${tempPin}`;

        // CRITICAL: pass school_id + role in metadata so the trigger
        // creates the profile correctly. Without this, signup fails
        // because profiles.school_id is NOT NULL.
        const { data: newUser, error: createUserError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              name,
              role: "teacher",
              school_id: callerSchoolId,
            },
          });

        if (createUserError || !newUser.user) {
          return NextResponse.json(
            {
              error: createUserError?.message || "User creation failed",
            },
            { status: 500 }
          );
        }

        return NextResponse.json({ email, pin: tempPassword });
      }

      case "update-teacher": {
        const { id, name, email } = body;
        if (!id || !name || !email) {
          return NextResponse.json(
            { error: "Missing fields" },
            { status: 400 }
          );
        }

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ name, email })
          .eq("id", id)
          .eq("school_id", callerSchoolId);

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      case "delete-teacher": {
        const { id } = body;
        if (!id)
          return NextResponse.json({ error: "Missing id" }, { status: 400 });

        // Verify teacher belongs to caller's school
        const { data: target } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", id)
          .eq("school_id", callerSchoolId)
          .maybeSingle();

        if (!target) {
          return NextResponse.json(
            { error: "Teacher not found" },
            { status: 404 }
          );
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      // ──────────────────────────────────────────────────────────
      // SUBJECTS
      // ──────────────────────────────────────────────────────────
      case "add-subject": {
        const { name } = body;
        if (!name || !name.trim()) {
          return NextResponse.json(
            { error: "Subject name required" },
            { status: 400 }
          );
        }

        const { data, error } = await supabaseAdmin
          .from("subjects")
          .insert([
            {
              school_id: callerSchoolId,
              name: name.trim(),
              display_order: 0,
            },
          ])
          .select()
          .single();

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ subject: data });
      }

      case "delete-subject": {
        const { id, force } = body;
        if (!id)
          return NextResponse.json({ error: "Missing id" }, { status: 400 });

        // Verify subject belongs to caller's school
        const { data: subject } = await supabaseAdmin
          .from("subjects")
          .select("id")
          .eq("id", id)
          .eq("school_id", callerSchoolId)
          .maybeSingle();

        if (!subject) {
          return NextResponse.json(
            { error: "Subject not found" },
            { status: 404 }
          );
        }

        // Check how many classes use it
        const { count } = await supabaseAdmin
          .from("class_subjects")
          .select("id", { count: "exact", head: true })
          .eq("subject_id", id)
          .eq("school_id", callerSchoolId);

        if (count && count > 0 && !force) {
          return NextResponse.json(
            {
              error: `This subject is linked to ${count} class${
                count > 1 ? "es" : ""
              }. Pass force: true to delete anyway.`,
              requiresForce: true,
              classCount: count,
            },
            { status: 400 }
          );
        }

        if (force) {
          const { data: links } = await supabaseAdmin
            .from("class_subjects")
            .select("id")
            .eq("subject_id", id)
            .eq("school_id", callerSchoolId);

          const linkIds = (links || []).map((l) => l.id);
          if (linkIds.length > 0) {
            await supabaseAdmin
              .from("scores")
              .delete()
              .in("class_subject_id", linkIds);
            await supabaseAdmin
              .from("class_subjects")
              .delete()
              .eq("subject_id", id)
              .eq("school_id", callerSchoolId);
          }
        }

        const { error } = await supabaseAdmin
          .from("subjects")
          .delete()
          .eq("id", id)
          .eq("school_id", callerSchoolId);

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      case "set-class-subjects": {
        const { classId, subjectIds } = body as {
          classId: string;
          subjectIds: string[];
        };
        if (!classId || !Array.isArray(subjectIds)) {
          return NextResponse.json(
            { error: "Missing fields" },
            { status: 400 }
          );
        }

        const { data: cls } = await supabaseAdmin
          .from("classes")
          .select("id, session_id")
          .eq("id", classId)
          .eq("school_id", callerSchoolId)
          .maybeSingle();

        if (!cls || !cls.session_id) {
          return NextResponse.json(
            { error: "Class not found or has no session" },
            { status: 400 }
          );
        }

        const { data: existing } = await supabaseAdmin
          .from("class_subjects")
          .select("id, subject_id")
          .eq("class_id", classId)
          .eq("session_id", cls.session_id);

        const existingBySubjectId = new Map<string, string>();
        (existing || []).forEach((row) =>
          existingBySubjectId.set(row.subject_id, row.id)
        );

        const desired = new Set(subjectIds);

        const toInsert = subjectIds
          .filter((sid) => !existingBySubjectId.has(sid))
          .map((sid) => ({
            school_id: callerSchoolId,
            class_id: classId,
            subject_id: sid,
            session_id: cls.session_id,
            staff_id: null,
          }));

        if (toInsert.length > 0) {
          const { error } = await supabaseAdmin
            .from("class_subjects")
            .insert(toInsert);
          if (error)
            return NextResponse.json(
              { error: error.message },
              { status: 500 }
            );
        }

        const toRemove = (existing || []).filter(
          (row) => !desired.has(row.subject_id)
        );
        for (const row of toRemove) {
          await supabaseAdmin
            .from("scores")
            .delete()
            .eq("class_subject_id", row.id);
          await supabaseAdmin
            .from("class_subjects")
            .delete()
            .eq("id", row.id);
        }

        return NextResponse.json({ success: true });
      }

      // ──────────────────────────────────────────────────────────
      // CLASSES
      // ──────────────────────────────────────────────────────────
      case "create-class": {
        const { name, session: sessionName, subject_ids } = body;
        if (!name || !sessionName) {
          return NextResponse.json(
            { error: "Missing fields" },
            { status: 400 }
          );
        }

        const trimmedSession = String(sessionName).trim();

        // Find or create session
        let sessionId: string;
        const { data: existingSession } = await supabaseAdmin
          .from("sessions")
          .select("id")
          .eq("school_id", callerSchoolId)
          .eq("name", trimmedSession)
          .maybeSingle();

        if (existingSession) {
          sessionId = existingSession.id;
        } else {
          const { data: newSession, error: sessErr } = await supabaseAdmin
            .from("sessions")
            .insert([
              {
                school_id: callerSchoolId,
                name: trimmedSession,
                is_current: false,
              },
            ])
            .select()
            .single();

          if (sessErr || !newSession) {
            return NextResponse.json(
              { error: sessErr?.message || "Session creation failed" },
              { status: 500 }
            );
          }
          sessionId = newSession.id;

          await supabaseAdmin.from("terms").insert([
            {
              school_id: callerSchoolId,
              session_id: sessionId,
              name: "First",
              sequence: 1,
              is_current: false,
            },
            {
              school_id: callerSchoolId,
              session_id: sessionId,
              name: "Second",
              sequence: 2,
              is_current: false,
            },
            {
              school_id: callerSchoolId,
              session_id: sessionId,
              name: "Third",
              sequence: 3,
              is_current: false,
            },
          ]);
        }

        const { data: createdClass, error: classErr } = await supabaseAdmin
          .from("classes")
          .insert([
            {
              school_id: callerSchoolId,
              name,
              session: trimmedSession,
              session_id: sessionId,
              teacher_id: null,
            },
          ])
          .select()
          .single();

        if (classErr || !createdClass) {
          return NextResponse.json(
            { error: classErr?.message || "Class creation failed" },
            { status: 500 }
          );
        }

        if (Array.isArray(subject_ids) && subject_ids.length > 0) {
          const links = subject_ids.map((sid: string) => ({
            school_id: callerSchoolId,
            class_id: createdClass.id,
            subject_id: sid,
            session_id: sessionId,
            staff_id: null,
          }));
          const { error: linkErr } = await supabaseAdmin
            .from("class_subjects")
            .insert(links);

          if (linkErr) {
            await supabaseAdmin
              .from("classes")
              .delete()
              .eq("id", createdClass.id);
            return NextResponse.json(
              { error: linkErr.message },
              { status: 500 }
            );
          }
        }

        return NextResponse.json({ class: createdClass });
      }

      case "update-class": {
        const { id, name, session: sessionName } = body;
        if (!id || !name || !sessionName) {
          return NextResponse.json(
            { error: "Missing fields" },
            { status: 400 }
          );
        }

        const trimmedSession = String(sessionName).trim();

        // Verify class belongs to caller's school
        const { data: existingClass } = await supabaseAdmin
          .from("classes")
          .select("id")
          .eq("id", id)
          .eq("school_id", callerSchoolId)
          .maybeSingle();

        if (!existingClass) {
          return NextResponse.json(
            { error: "Class not found" },
            { status: 404 }
          );
        }

        let sessionId: string;
        const { data: existingSession } = await supabaseAdmin
          .from("sessions")
          .select("id")
          .eq("school_id", callerSchoolId)
          .eq("name", trimmedSession)
          .maybeSingle();

        if (existingSession) {
          sessionId = existingSession.id;
        } else {
          const { data: newSession, error: sessErr } = await supabaseAdmin
            .from("sessions")
            .insert([
              {
                school_id: callerSchoolId,
                name: trimmedSession,
                is_current: false,
              },
            ])
            .select()
            .single();

          if (sessErr || !newSession) {
            return NextResponse.json(
              { error: sessErr?.message || "Session creation failed" },
              { status: 500 }
            );
          }
          sessionId = newSession.id;

          await supabaseAdmin.from("terms").insert([
            {
              school_id: callerSchoolId,
              session_id: sessionId,
              name: "First",
              sequence: 1,
              is_current: false,
            },
            {
              school_id: callerSchoolId,
              session_id: sessionId,
              name: "Second",
              sequence: 2,
              is_current: false,
            },
            {
              school_id: callerSchoolId,
              session_id: sessionId,
              name: "Third",
              sequence: 3,
              is_current: false,
            },
          ]);
        }

        const { error } = await supabaseAdmin
          .from("classes")
          .update({
            name,
            session: trimmedSession,
            session_id: sessionId,
          })
          .eq("id", id)
          .eq("school_id", callerSchoolId);

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      case "delete-class": {
        const { id } = body;
        if (!id)
          return NextResponse.json({ error: "Missing id" }, { status: 400 });

        const { error } = await supabaseAdmin
          .from("classes")
          .delete()
          .eq("id", id)
          .eq("school_id", callerSchoolId);

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      case "assign-teacher": {
        const { classId, teacherId } = body;
        if (!classId)
          return NextResponse.json(
            { error: "Missing classId" },
            { status: 400 }
          );

        // Verify class belongs to caller's school
        const { data: cls } = await supabaseAdmin
          .from("classes")
          .select("id")
          .eq("id", classId)
          .eq("school_id", callerSchoolId)
          .maybeSingle();

        if (!cls) {
          return NextResponse.json(
            { error: "Class not found" },
            { status: 404 }
          );
        }

        // If assigning a teacher, verify they belong to same school
        if (teacherId) {
          const { data: teacher } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("id", teacherId)
            .eq("school_id", callerSchoolId)
            .maybeSingle();

          if (!teacher) {
            return NextResponse.json(
              { error: "Teacher not found in this school" },
              { status: 404 }
            );
          }
        }

        const { error } = await supabaseAdmin
          .from("classes")
          .update({ teacher_id: teacherId || null })
          .eq("id", classId)
          .eq("school_id", callerSchoolId);

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      // ──────────────────────────────────────────────────────────
      // STUDENTS
      // ──────────────────────────────────────────────────────────
      case "create-student": {
        const { name, reg_no, class_id, gender, age } = body;
        if (!name || !reg_no) {
          return NextResponse.json(
            { error: "Name and reg_no required" },
            { status: 400 }
          );
        }

        const { data: student, error } = await supabaseAdmin
          .from("students")
          .insert([
            {
              school_id: callerSchoolId,
              name,
              reg_no,
              class_id: class_id || null,
              gender,
              age,
            },
          ])
          .select()
          .single();

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });

        if (class_id) {
          const { data: cls } = await supabaseAdmin
            .from("classes")
            .select("session_id")
            .eq("id", class_id)
            .eq("school_id", callerSchoolId)
            .maybeSingle();

          if (cls?.session_id) {
            await supabaseAdmin.from("enrolments").upsert(
              [
                {
                  school_id: callerSchoolId,
                  student_id: student.id,
                  class_id,
                  session_id: cls.session_id,
                  status: "active",
                },
              ],
              { onConflict: "student_id,session_id" }
            );
          }
        }

        return NextResponse.json({ student });
      }

      case "update-student": {
        const { id, name, reg_no, class_id, gender, age } = body;
        if (!id || !name || !reg_no) {
          return NextResponse.json(
            { error: "Missing fields" },
            { status: 400 }
          );
        }

        const { error } = await supabaseAdmin
          .from("students")
          .update({
            name,
            reg_no,
            class_id: class_id || null,
            gender,
            age,
          })
          .eq("id", id)
          .eq("school_id", callerSchoolId);

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });

        if (class_id) {
          const { data: cls } = await supabaseAdmin
            .from("classes")
            .select("session_id")
            .eq("id", class_id)
            .eq("school_id", callerSchoolId)
            .maybeSingle();

          if (cls?.session_id) {
            await supabaseAdmin.from("enrolments").upsert(
              [
                {
                  school_id: callerSchoolId,
                  student_id: id,
                  class_id,
                  session_id: cls.session_id,
                  status: "active",
                },
              ],
              { onConflict: "student_id,session_id" }
            );
          }
        }

        return NextResponse.json({ success: true });
      }

      case "delete-student": {
        const { id } = body;
        if (!id)
          return NextResponse.json({ error: "Missing id" }, { status: 400 });

        const { error } = await supabaseAdmin
          .from("students")
          .delete()
          .eq("id", id)
          .eq("school_id", callerSchoolId);

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}