import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";
import { normalizePhone } from "@/lib/utils/phone"; // <-- Added Import

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
      .select("role, school_id, name")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      (profile.role !== "admin" && profile.role !== "owner") ||
      !profile.school_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const callerSchoolId = profile.school_id;
    const callerName = profile.name || "Admin";
    const callerIsOwner = profile.role === "owner";

    switch (action) {
      // ──────────────────────────────────────────────────────────
      // APPROVALS
      // ──────────────────────────────────────────────────────────

            case "execute-session-rollover": {
        if (!callerIsOwner) {
          return NextResponse.json({ error: "Only the owner can roll over the session." }, { status: 403 });
        }

        const { newSessionName, decisions } = body;

        if (!newSessionName || !Array.isArray(decisions)) {
          return NextResponse.json({ error: "Missing session name or decisions." }, { status: 400 });
        }

        // Get the current active term
        const { data: currentTerm } = await supabaseAdmin
          .from("terms")
          .select("id")
          .eq("school_id", callerSchoolId)
          .eq("is_current", true)
          .maybeSingle();

        if (!currentTerm) {
          return NextResponse.json({ error: "No active term found." }, { status: 404 });
        }

        const { data, error } = await supabaseAdmin.rpc("execute_session_rollover_atomic", {
          p_school_id: callerSchoolId,
          p_current_term_id: currentTerm.id,
          p_new_session_name: newSessionName,
          p_decisions: decisions,
          p_user_id: user.id,
        });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId,
          actorId: user.id,
          actorName: callerName,
          action: "session.rollover_executed",
          targetTable: "sessions",
          targetId: data.new_session_id,
          targetLabel: `Rolled over into ${newSessionName}`,
        });

        return NextResponse.json({ success: true, newSessionId: data.new_session_id });
      }

      
      case "approve-student": {
        const { enrolmentId, termId, headComment, promotion } = body;
        if (!enrolmentId || !termId) {
          return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const { data: enrol } = await supabaseAdmin
          .from("enrolments")
          .select("id, student:students (name)")
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
              promotion_status: promotion || null, // 🚨 SAVE THE STATUS HERE
              approved_by: user.id,
              approved_at: new Date().toISOString(),
              server_updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "enrolment_id,term_id" }
        );

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId,
          actorId: user.id,
          actorName: callerName,
          action: "result.approved",
          targetTable: "term_records",
          targetId: enrolmentId,
          targetLabel: (enrol as any).student?.name || null,
        });

        return NextResponse.json({ success: true });
      }

      case "reopen-student": {
        const { enrolmentId, termId } = body;
        if (!enrolmentId || !termId) {
          return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const { data: enrol } = await supabaseAdmin
          .from("enrolments")
          .select("id, student:students (name)")
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

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId,
          actorId: user.id,
          actorName: callerName,
          action: "result.reopened",
          targetTable: "term_records",
          targetId: enrolmentId,
          targetLabel: (enrol as any).student?.name || null,
        });

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

        // 1. Initial check (Fast path for obvious duplicates)
        const { data: existing } = await supabaseAdmin
          .from("sessions")
          .select("id")
          .eq("school_id", callerSchoolId)
          .ilike("name", trimmed)
          .maybeSingle();

        if (existing) {
          return NextResponse.json(
            { error: `Session "${trimmed}" already exists` },
            { status: 400 }
          );
        }

        // 2. Insert the session
        const { data: newSession, error: sessErr } = await supabaseAdmin
          .from("sessions")
          .insert([
            { school_id: callerSchoolId, name: trimmed, is_current: false },
          ])
          .select()
          .single();

        // 3. 🚨 THE RACE CONDITION FIX
        if (sessErr) {
          // 23505 is the Postgres error code for "unique_violation"
          if (sessErr.code === "23505") {
            return NextResponse.json(
              { error: `Session "${trimmed}" already exists.` },
              { status: 400 }
            );
          }
          return NextResponse.json(
            { error: sessErr.message || "Session creation failed" },
            { status: 500 }
          );
        }

        if (!newSession) {
          return NextResponse.json(
            { error: "Session creation failed" },
            { status: 500 }
          );
        }

        // 4. Create the 3 terms
        const { error: termErr } = await supabaseAdmin.from("terms").insert([
          { school_id: callerSchoolId, session_id: newSession.id, name: "First", sequence: 1, is_current: false },
          { school_id: callerSchoolId, session_id: newSession.id, name: "Second", sequence: 2, is_current: false },
          { school_id: callerSchoolId, session_id: newSession.id, name: "Third", sequence: 3, is_current: false },
        ]);

        if (termErr) {
          // If terms fail, we should ideally delete the session, but let's log it for now
          return NextResponse.json({ error: termErr.message }, { status: 500 });
        }

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId,
          actorId: user.id,
          actorName: callerName,
          action: "session.created",
          targetTable: "sessions",
          targetId: newSession.id,
          targetLabel: trimmed,
        });

        return NextResponse.json({ session: newSession });
      }

      case "rollover-classes": {
        const { fromSessionId, toSessionId } = body;
        if (!fromSessionId || !toSessionId) {
          return NextResponse.json({ error: "Missing session IDs" }, { status: 400 });
        }

        // 1. Fetch the new session name
        const { data: newSession } = await supabaseAdmin
          .from("sessions")
          .select("name")
          .eq("id", toSessionId)
          .eq("school_id", callerSchoolId)
          .single();

        if (!newSession) return NextResponse.json({ error: "Target session not found" }, { status: 404 });

        // 🚨 IDEMPOTENCY GUARD: Check if classes already exist in the target session
        const { count: existingCount } = await supabaseAdmin
          .from("classes")
          .select("*", { count: "exact", head: true })
          .eq("session_id", toSessionId)
          .eq("school_id", callerSchoolId);

        if (existingCount && existingCount > 0) {
          return NextResponse.json(
            { error: `Classes already exist for ${newSession.name}. Rollover aborted to prevent duplicates.` },
            { status: 400 }
          );
        }

        // 2. Fetch old classes and their subjects
        const { data: oldClasses } = await supabaseAdmin
          .from("classes")
          .select("id, name, sort_order")
          .eq("session_id", fromSessionId)
          .eq("school_id", callerSchoolId);

        if (!oldClasses || oldClasses.length === 0) {
          return NextResponse.json({ error: "No classes found in the previous session to copy." }, { status: 400 });
        }

        const oldClassIds = oldClasses.map(c => c.id);
        const { data: oldClassSubjects } = await supabaseAdmin
          .from("class_subjects")
          .select("subject_id, class_id")
          .in("class_id", oldClassIds)
          .eq("school_id", callerSchoolId);

        // 3. Insert new classes
        const newClassesToInsert = oldClasses.map(c => ({
          school_id: callerSchoolId,
          name: c.name,
          session: newSession.name,
          session_id: toSessionId,
          teacher_id: null, 
          sort_order: c.sort_order || 0
        }));

        // 🚨 CATCH UNIQUE VIOLATION: If two requests hit at the exact same millisecond
        const { data: createdClasses, error: classErr } = await supabaseAdmin
          .from("classes")
          .insert(newClassesToInsert)
          .select();

        if (classErr) {
          if (classErr.code === '23505') { // Postgres unique violation code
             return NextResponse.json({ error: "Classes were already being copied by another request. Please refresh." }, { status: 400 });
          }
          return NextResponse.json({ error: `Failed to rollover classes: ${classErr.message}` }, { status: 500 });
        }

        if (!createdClasses) {
          return NextResponse.json({ error: "Failed to create classes." }, { status: 500 });
        }

        // 4. Map old class IDs to new class IDs
        const classIdMap: Record<string, string> = {};
        oldClasses.forEach((oldC) => {
          const newC = createdClasses.find(nc => nc.name === oldC.name);
          if (newC) classIdMap[oldC.id] = newC.id;
        });

        // 5. Insert new class_subjects
        if (oldClassSubjects && oldClassSubjects.length > 0) {
          const newClassSubjectsToInsert = oldClassSubjects
            .map(cs => {
              const newClassId = classIdMap[cs.class_id];
              if (!newClassId) return null;
              return {
                school_id: callerSchoolId,
                class_id: newClassId,
                subject_id: cs.subject_id,
                session_id: toSessionId,
                staff_id: null
              };
            }).filter((x): x is NonNullable<typeof x> => x !== null);

          if (newClassSubjectsToInsert.length > 0) {
            await supabaseAdmin.from("class_subjects").insert(newClassSubjectsToInsert);
          }
        }

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "session.rolled_over", targetTable: "classes", targetId: toSessionId, 
          targetLabel: `Copied ${createdClasses.length} classes to ${newSession.name}`,
        });

        return NextResponse.json({ success: true, copied: createdClasses.length });
      }

      case "set-current-session": {
        const { sessionId } = body;
        if (!sessionId) {
          return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        // 🚨 THE GATEKEEPER: Prevent session switch if students are left behind
        const { data: currentSession } = await supabaseAdmin
          .from("sessions")
          .select("id, name")
          .eq("school_id", callerSchoolId)
          .eq("is_current", true)
          .maybeSingle();

        if (currentSession && currentSession.id !== sessionId) {
          // 1. Get all active student IDs in the current session
          const { data: currentEnrolments } = await supabaseAdmin
            .from("enrolments")
            .select("student_id")
            .eq("session_id", currentSession.id)
            .eq("status", "active");

          // 2. Get all active student IDs in the target session
          const { data: targetEnrolments } = await supabaseAdmin
            .from("enrolments")
            .select("student_id")
            .eq("session_id", sessionId)
            .eq("status", "active");

          const currentStudentIds = new Set(currentEnrolments?.map(e => e.student_id) || []);
          const targetStudentIds = new Set(targetEnrolments?.map(e => e.student_id) || []);

          // 3. Find students who exist in the old session but NOT in the new one
          let unPromotedCount = 0;
          currentStudentIds.forEach((id) => {
            if (!targetStudentIds.has(id)) {
              unPromotedCount++;
            }
          });

          // 4. If we found any, block the rollover.
          if (unPromotedCount > 0) {
            return NextResponse.json(
              { 
                error: `Cannot switch sessions yet. You have ${unPromotedCount} student(s) from ${currentSession.name} who have not been enrolled in the new session. Please go to the Promotion tab and process them first.` 
              },
              { status: 400 }
            );
          }
        }

        // --- PROCEED WITH SESSION SWITCH ---

        // 1. Clear ALL current sessions for this school
        const { error: clearErr } = await supabaseAdmin
          .from("sessions")
          .update({ is_current: false })
          .eq("school_id", callerSchoolId);

        if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 });

        // 2. Set the specific session as current
        const { error: setErr } = await supabaseAdmin
          .from("sessions")
          .update({ is_current: true })
          .eq("id", sessionId)
          .eq("school_id", callerSchoolId);

        if (setErr) return NextResponse.json({ error: setErr.message }, { status: 500 });

        // 3. Clear ALL current terms across the school
        await supabaseAdmin
          .from("terms")
          .update({ is_current: false })
          .eq("school_id", callerSchoolId);

        // 4. Set the First Term of this new session as current
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
            .eq("id", firstTerm.id);
        }

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId,
          actorId: user.id,
          actorName: callerName,
          action: "session.current_changed",
          targetTable: "sessions",
          targetId: sessionId,
        });

        return NextResponse.json({ success: true });
      }

      case "set-current-term": {
        const { termId } = body;
        if (!termId) return NextResponse.json({ error: "Missing termId" }, { status: 400 });

        const { data: term } = await supabaseAdmin
          .from("terms")
          .select("id, session_id")
          .eq("id", termId)
          .eq("school_id", callerSchoolId)
          .maybeSingle();

        if (!term) return NextResponse.json({ error: "Term not found" }, { status: 404 });

        // 🚨 CLEAR ALL TERMS FOR THIS SESSION
        await supabaseAdmin
          .from("terms")
          .update({ is_current: false })
          .eq("session_id", term.session_id);

        // 🚨 SET THE NEW ONE
        await supabaseAdmin
          .from("terms")
          .update({ is_current: true })
          .eq("id", termId);

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

        const { data: term } = await supabaseAdmin
          .from("terms")
          .select("name")
          .eq("id", termId)
          .eq("school_id", callerSchoolId)
          .maybeSingle();

        const { error } = await supabaseAdmin
          .from("terms")
          .update(updates)
          .eq("id", termId)
          .eq("school_id", callerSchoolId);

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId,
          actorId: user.id,
          actorName: callerName,
          action: "term.updated",
          targetTable: "terms",
          targetId: termId,
          targetLabel: term?.name ? `${term.name} Term` : null,
        });

        return NextResponse.json({ success: true });
      }

      // ──────────────────────────────────────────────────────────
      // ADMINS (owner-only)
      // ──────────────────────────────────────────────────────────
      case "create-admin": {
        if (!callerIsOwner) {
          return NextResponse.json(
            { error: "Only the owner can create admins" },
            { status: 403 }
          );
        }

        const { name, email } = body;
        if (!name || !email) {
          return NextResponse.json(
            { error: "Name and email required" },
            { status: 400 }
          );
        }

        const tempPin = Math.floor(100000 + Math.random() * 900000).toString();
        const tempPassword = `Admin#${tempPin}`;

        const { data: newUser, error: createUserError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { name },
            app_metadata: { role: "admin", school_id: callerSchoolId },
          });

        if (createUserError || !newUser.user) {
          console.error("create-admin auth error:", createUserError);
          return NextResponse.json(
            { error: createUserError?.message || "User creation failed" },
            { status: 500 }
          );
        }

        const { error: profileErr } = await supabaseAdmin
          .from("profiles")
          .insert([{ id: newUser.user.id, name, email, role: "admin", school_id: callerSchoolId }]);

        if (profileErr) {
          console.error("create-admin profile error:", profileErr);
          await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
          return NextResponse.json({ error: profileErr.message }, { status: 500 });
        }

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "admin.created", targetTable: "profiles", targetId: newUser.user.id, targetLabel: name,
        });

        return NextResponse.json({ email, pin: tempPassword });
      }

      // ──────────────────────────────────────────────────────────
      // PASSWORD RESET
      // ──────────────────────────────────────────────────────────
      case "reset-password": {
        const { id } = body;
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

        const { data: target } = await supabaseAdmin
          .from("profiles")
          .select("id, name, email, role")
          .eq("id", id)
          .eq("school_id", callerSchoolId)
          .maybeSingle();

        if (!target) return NextResponse.json({ error: "User not found in this school" }, { status: 404 });
        if (!callerIsOwner && (target.role === "admin" || target.role === "owner")) {
          return NextResponse.json({ error: "Only the owner can reset admin passwords" }, { status: 403 });
        }

        const tempPin = Math.floor(100000 + Math.random() * 900000).toString();
        const tempPassword = `Reset#${tempPin}`;

        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(id, { password: tempPassword });

        if (updateErr) {
          console.error("reset-password error:", updateErr);
          return NextResponse.json({ error: updateErr.message || "Password reset failed" }, { status: 500 });
        }

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "password.reset", targetTable: "profiles", targetId: id, targetLabel: `${target.name} (${target.role})`,
        });

        return NextResponse.json({ email: target.email, pin: tempPassword });
      }

      // ──────────────────────────────────────────────────────────
      // TEACHERS
      // ──────────────────────────────────────────────────────────
      case "create-teacher": {
        const { name, email } = body;
        if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const tempPin = Math.floor(100000 + Math.random() * 900000).toString();
        const tempPassword = `Teacher#${tempPin}`;
        
        // Use internal UUID if email is missing to satisfy Supabase Auth
        const authEmail = email || `${crypto.randomUUID()}@internal.naijaschool.local`;

        const { data: newUser, error: createUserError } =
          await supabaseAdmin.auth.admin.createUser({
            email: authEmail, 
            password: tempPassword, 
            email_confirm: true,
            user_metadata: { name },
            app_metadata: { role: "teacher", school_id: callerSchoolId },
          });

        if (createUserError || !newUser.user) {
          console.error("create-teacher auth error:", createUserError);
          return NextResponse.json({ error: createUserError?.message || "User creation failed" }, { status: 500 });
        }

        const { error: profileErr } = await supabaseAdmin
          .from("profiles")
          .insert([{ id: newUser.user.id, name, email: email || null, role: "teacher", school_id: callerSchoolId }]);

        if (profileErr) {
          console.error("create-teacher profile error:", profileErr);
          await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
          return NextResponse.json({ error: profileErr.message }, { status: 500 });
        }

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "teacher.created", targetTable: "profiles", targetId: newUser.user.id, targetLabel: name,
        });

        return NextResponse.json({ email: email || null, pin: tempPassword });
      }

      case "update-teacher": {
        const { id, name, email } = body;
        if (!id || !name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        // 🚨 FETCH ROLE TO ENFORCE SECURITY
        const { data: target } = await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", id)
          .eq("school_id", callerSchoolId)
          .maybeSingle();

        if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

        // 🚨 SECURITY GUARD: Only Owner can edit Admins/Owners
        if (!callerIsOwner && (target.role === "admin" || target.role === "owner")) {
          return NextResponse.json(
            { error: "Only the owner can edit admin accounts." },
            { status: 403 }
          );
        }

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ name, email: email || null })
          .eq("id", id)
          .eq("school_id", callerSchoolId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "teacher.updated", targetTable: "profiles", targetId: id, targetLabel: name,
        });

        return NextResponse.json({ success: true });
      }

      case "delete-teacher": {
        const { id } = body;
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

        // 🚨 FETCH ROLE TO ENFORCE SECURITY
        const { data: target } = await supabaseAdmin
          .from("profiles")
          .select("id, name, role")
          .eq("id", id)
          .eq("school_id", callerSchoolId)
          .maybeSingle();

        if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

        // 🚨 SECURITY GUARD: Only Owner can delete Admins/Owners
        if (!callerIsOwner && (target.role === "admin" || target.role === "owner")) {
          return NextResponse.json(
            { error: "Only the owner can delete admin accounts." },
            { status: 403 }
          );
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "teacher.deleted", targetTable: "profiles", targetId: id, targetLabel: target.name,
        });

        return NextResponse.json({ success: true });
      }

      // ──────────────────────────────────────────────────────────
      // SUBJECTS
      // ──────────────────────────────────────────────────────────
      case "add-subject": {
        const { name } = body;
        if (!name || !name.trim()) return NextResponse.json({ error: "Subject name required" }, { status: 400 });

        const { data, error } = await supabaseAdmin
          .from("subjects")
          .insert([{ school_id: callerSchoolId, name: name.trim(), display_order: 0 }])
          .select().single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "subject.created", targetTable: "subjects", targetId: data.id, targetLabel: name.trim(),
        });

        return NextResponse.json({ subject: data });
      }

      case "delete-subject": {
        const { id, force } = body;
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

        const { data: subject } = await supabaseAdmin
          .from("subjects").select("id, name").eq("id", id).eq("school_id", callerSchoolId).maybeSingle();

        if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

        const { count } = await supabaseAdmin
          .from("class_subjects").select("id", { count: "exact", head: true }).eq("subject_id", id).eq("school_id", callerSchoolId);

        if (count && count > 0 && !force) {
          return NextResponse.json(
            { error: `This subject is linked to ${count} class${count > 1 ? "es" : ""}. Pass force: true to delete anyway.`, requiresForce: true, classCount: count },
            { status: 400 }
          );
        }

        if (force) {
          const { data: links } = await supabaseAdmin
            .from("class_subjects").select("id").eq("subject_id", id).eq("school_id", callerSchoolId);

          const linkIds = (links || []).map((l) => l.id);
          if (linkIds.length > 0) {
            await supabaseAdmin.from("scores").delete().in("class_subject_id", linkIds);
            await supabaseAdmin.from("class_subjects").delete().eq("subject_id", id).eq("school_id", callerSchoolId);
          }
        }

        const { error } = await supabaseAdmin.from("subjects").delete().eq("id", id).eq("school_id", callerSchoolId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "subject.deleted", targetTable: "subjects", targetId: id, targetLabel: subject.name,
        });

        return NextResponse.json({ success: true });
      }

      case "set-class-subjects": {
        const { classId, subjectIds } = body as { classId: string; subjectIds: string[] };
        if (!classId || !Array.isArray(subjectIds)) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

        const { data: cls } = await supabaseAdmin
          .from("classes").select("id, session_id, name").eq("id", classId).eq("school_id", callerSchoolId).maybeSingle();

        if (!cls || !cls.session_id) return NextResponse.json({ error: "Class not found or has no session" }, { status: 400 });

        const { data: existing } = await supabaseAdmin
          .from("class_subjects").select("id, subject_id").eq("class_id", classId).eq("session_id", cls.session_id);

        const existingBySubjectId = new Map<string, string>();
        (existing || []).forEach((row) => existingBySubjectId.set(row.subject_id, row.id));

        // 🚨 FIX: Deduplicate incoming subjectIds to prevent double inserts
        const uniqueSubjectIds = Array.from(new Set(subjectIds));
        const desired = new Set(uniqueSubjectIds);

        const toInsert = uniqueSubjectIds
          .filter((sid) => !existingBySubjectId.has(sid))
          .map((sid) => ({
            school_id: callerSchoolId, class_id: classId, subject_id: sid, session_id: cls.session_id, staff_id: null,
          }));

        if (toInsert.length > 0) {
          const { error } = await supabaseAdmin.from("class_subjects").insert(toInsert);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const toRemove = (existing || []).filter((row) => !desired.has(row.subject_id));
        for (const row of toRemove) {
          await supabaseAdmin.from("scores").delete().eq("class_subject_id", row.id);
          await supabaseAdmin.from("class_subjects").delete().eq("id", row.id);
        }

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "class.subjects_changed", targetTable: "classes", targetId: classId, targetLabel: cls.name,
        });

        return NextResponse.json({ success: true });
      }

      // ──────────────────────────────────────────────────────────
      // CLASSES
      // ──────────────────────────────────────────────────────────
      case "create-class": {
        const { name, session: sessionName, subject_ids } = body;
        if (!name || !sessionName) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

        const trimmedSession = String(sessionName).trim();
        let sessionId: string;

        const { data: existingSession } = await supabaseAdmin
          .from("sessions").select("id").eq("school_id", callerSchoolId).eq("name", trimmedSession).maybeSingle();

        if (existingSession) {
          sessionId = existingSession.id;
        } else {
          const { data: newSession, error: sessErr } = await supabaseAdmin
            .from("sessions").insert([{ school_id: callerSchoolId, name: trimmedSession, is_current: false }]).select().single();

          if (sessErr || !newSession) return NextResponse.json({ error: sessErr?.message || "Session creation failed" }, { status: 500 });

          sessionId = newSession.id;

          await supabaseAdmin.from("terms").insert([
            { school_id: callerSchoolId, session_id: sessionId, name: "First", sequence: 1, is_current: false },
            { school_id: callerSchoolId, session_id: sessionId, name: "Second", sequence: 2, is_current: false },
            { school_id: callerSchoolId, session_id: sessionId, name: "Third", sequence: 3, is_current: false },
          ]);
        }

        const { data: createdClass, error: classErr } = await supabaseAdmin
          .from("classes").insert([{ school_id: callerSchoolId, name, session: trimmedSession, session_id: sessionId, teacher_id: null }]).select().single();

        if (classErr || !createdClass) return NextResponse.json({ error: classErr?.message || "Class creation failed" }, { status: 500 });

        if (Array.isArray(subject_ids) && subject_ids.length > 0) {
          const links = subject_ids.map((sid: string) => ({
            school_id: callerSchoolId, class_id: createdClass.id, subject_id: sid, session_id: sessionId, staff_id: null,
          }));
          const { error: linkErr } = await supabaseAdmin.from("class_subjects").insert(links);

          if (linkErr) {
            await supabaseAdmin.from("classes").delete().eq("id", createdClass.id);
            return NextResponse.json({ error: linkErr.message }, { status: 500 });
          }
        }

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "class.created", targetTable: "classes", targetId: createdClass.id, targetLabel: name,
        });

        return NextResponse.json({ class: createdClass });
      }

      case "update-class": {
        const { id, name, session: sessionName } = body;
        if (!id || !name || !sessionName) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

        const trimmedSession = String(sessionName).trim();
        const { data: existingClass } = await supabaseAdmin
          .from("classes").select("id").eq("id", id).eq("school_id", callerSchoolId).maybeSingle();

        if (!existingClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });

        let sessionId: string;
        const { data: existingSession } = await supabaseAdmin
          .from("sessions").select("id").eq("school_id", callerSchoolId).eq("name", trimmedSession).maybeSingle();

        if (existingSession) {
          sessionId = existingSession.id;
        } else {
          const { data: newSession, error: sessErr } = await supabaseAdmin
            .from("sessions").insert([{ school_id: callerSchoolId, name: trimmedSession, is_current: false }]).select().single();

          if (sessErr || !newSession) return NextResponse.json({ error: sessErr?.message || "Session creation failed" }, { status: 500 });

          sessionId = newSession.id;

          await supabaseAdmin.from("terms").insert([
            { school_id: callerSchoolId, session_id: sessionId, name: "First", sequence: 1, is_current: false },
            { school_id: callerSchoolId, session_id: sessionId, name: "Second", sequence: 2, is_current: false },
            { school_id: callerSchoolId, session_id: sessionId, name: "Third", sequence: 3, is_current: false },
          ]);
        }

        const { error } = await supabaseAdmin
          .from("classes").update({ name, session: trimmedSession, session_id: sessionId }).eq("id", id).eq("school_id", callerSchoolId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "class.updated", targetTable: "classes", targetId: id, targetLabel: name,
        });

        return NextResponse.json({ success: true });
      }

      case "delete-class": {
        const { id } = body;
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

        const { data: target } = await supabaseAdmin
          .from("classes").select("id, name").eq("id", id).eq("school_id", callerSchoolId).maybeSingle();

        const { error } = await supabaseAdmin.from("classes").delete().eq("id", id).eq("school_id", callerSchoolId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "class.deleted", targetTable: "classes", targetId: id, targetLabel: target?.name || null,
        });

        return NextResponse.json({ success: true });
      }

      case "assign-teacher": {
        const { classId, teacherId } = body;
        if (!classId) return NextResponse.json({ error: "Missing classId" }, { status: 400 });

        const { data: cls } = await supabaseAdmin
          .from("classes").select("id, name").eq("id", classId).eq("school_id", callerSchoolId).maybeSingle();

        if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

        let teacherName: string | null = null;
        if (teacherId) {
          const { data: teacher } = await supabaseAdmin
            .from("profiles").select("id, name").eq("id", teacherId).eq("school_id", callerSchoolId).maybeSingle();

          if (!teacher) return NextResponse.json({ error: "Teacher not found in this school" }, { status: 404 });
          teacherName = teacher.name;
        }

        const { error } = await supabaseAdmin
          .from("classes").update({ teacher_id: teacherId || null }).eq("id", classId).eq("school_id", callerSchoolId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "class.teacher_assigned", targetTable: "classes", targetId: classId,
          targetLabel: teacherName ? `${cls.name} ← ${teacherName}` : `${cls.name} (unassigned)`,
        });

        return NextResponse.json({ success: true });
      }

      // ──────────────────────────────────────────────────────────
      // STUDENTS (UPDATED FOR PHONE-CENTRIC FLOW)
      // ──────────────────────────────────────────────────────────
      case "create-student": {
        const {
          name,
          reg_no,
          class_id,
          familyId,
          newFamilyGuardianName,
          guardianPhone1,
          guardianPhone2,
          gender,
          age
        } = body;

        if (!name || !reg_no) {
          return NextResponse.json({ error: "Name and reg_no required" }, { status: 400 });
        }

        let finalFamilyId = familyId || null;

        // If no family ID was sent, but phones are provided, we need to find or create the family.
        if (!finalFamilyId && (guardianPhone1 || guardianPhone2)) {
          const normPhone1 = normalizePhone(guardianPhone1);
          const normPhone2 = normalizePhone(guardianPhone2);
          const raw1 = guardianPhone1?.replace(/\D/g, "");
          const raw2 = guardianPhone2?.replace(/\D/g, "");

          let familyQuery = supabaseAdmin
            .from("families")
            .select("id")
            .eq("school_id", callerSchoolId)
            .is("deleted_at", null);

          // 🚨 BULLETPROOF SEARCH: Check normalized, raw, and both columns
          const searchTerms = Array.from(new Set([normPhone1, raw1, normPhone2, raw2])).filter(Boolean);
          
          if (searchTerms.length > 0) {
            const orConditions = searchTerms.map(term => 
              `phone_normalized.eq.${term},phone_normalized_2.eq.${term},guardian_phone.eq.${term},guardian_phone_2.eq.${term}`
            ).join(",");
            familyQuery = familyQuery.or(orConditions);
          }

          const { data: existingFamilies } = await familyQuery.limit(1);
          const existingFamily = existingFamilies && existingFamilies.length > 0 ? existingFamilies[0] : null;

          if (existingFamily) {
            finalFamilyId = existingFamily.id;
          } else if (newFamilyGuardianName) {
            // Create a new family if one doesn't exist
            const { data: newFamily, error: famError } = await supabaseAdmin
              .from("families")
              .insert({
                school_id: callerSchoolId,
                name: `${newFamilyGuardianName} Family`,
                guardian_name: newFamilyGuardianName,
                guardian_phone: guardianPhone1 || null,
                guardian_phone_2: guardianPhone2 || null,
                phone_normalized: normPhone1 || null,
                phone_normalized_2: normPhone2 || null,
              })
              .select("id")
              .single();

            if (famError) throw new Error(`Family creation failed: ${famError.message}`);
            finalFamilyId = newFamily.id;
          }
        }

        // Validate finalFamilyId if it was passed directly
        if (familyId) {
          const { data: familyCheck } = await supabaseAdmin
            .from("families")
            .select("id")
            .eq("id", familyId)
            .eq("school_id", callerSchoolId)
            .is("deleted_at", null)
            .maybeSingle();

          if (!familyCheck) {
            return NextResponse.json({ error: "Invalid family ID or unauthorized access." }, { status: 403 });
          }
        }

        const { data: student, error } = await supabaseAdmin
          .from("students")
          .insert([
            {
              school_id: callerSchoolId,
              name,
              reg_no,
              class_id: class_id || null,
              family_id: finalFamilyId,
              gender,
              age,
            },
          ])
          .select()
          .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        if (class_id) {
          const { data: cls } = await supabaseAdmin
            .from("classes").select("session_id").eq("id", class_id).eq("school_id", callerSchoolId).maybeSingle();

          if (cls?.session_id) {
            await supabaseAdmin.from("enrolments").upsert(
              [{ school_id: callerSchoolId, student_id: student.id, class_id, session_id: cls.session_id, status: "active" }],
              { onConflict: "student_id,session_id" }
            );
          }
        }

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "student.created", targetTable: "students", targetId: student.id, targetLabel: name,
        });

        return NextResponse.json({ student });
      }

      case "update-student": {
        const {
          id,
          name,
          reg_no,
          class_id,
          familyId,
          newFamilyGuardianName,
          guardianPhone1,
          guardianPhone2,
          gender,
          age
        } = body;

        if (!id || !name || !reg_no) {
          return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        let finalFamilyId = familyId || null;

        // Same phone-centric logic for update
        if (!finalFamilyId && (guardianPhone1 || guardianPhone2)) {
          const normPhone1 = normalizePhone(guardianPhone1);
          const normPhone2 = normalizePhone(guardianPhone2);
          const raw1 = guardianPhone1?.replace(/\D/g, "");
          const raw2 = guardianPhone2?.replace(/\D/g, "");

          let familyQuery = supabaseAdmin
            .from("families")
            .select("id")
            .eq("school_id", callerSchoolId)
            .is("deleted_at", null);

          // 🚨 BULLETPROOF SEARCH: Check normalized, raw, and both columns
          const searchTerms = Array.from(new Set([normPhone1, raw1, normPhone2, raw2])).filter(Boolean);
          
          if (searchTerms.length > 0) {
            const orConditions = searchTerms.map(term => 
              `phone_normalized.eq.${term},phone_normalized_2.eq.${term},guardian_phone.eq.${term},guardian_phone_2.eq.${term}`
            ).join(",");
            familyQuery = familyQuery.or(orConditions);
          }

          const { data: existingFamilies } = await familyQuery.limit(1);
          const existingFamily = existingFamilies && existingFamilies.length > 0 ? existingFamilies[0] : null;

          if (existingFamily) {
            finalFamilyId = existingFamily.id;
          } else if (newFamilyGuardianName) {
            const { data: newFamily, error: famError } = await supabaseAdmin
              .from("families")
              .insert({
                school_id: callerSchoolId,
                name: `${newFamilyGuardianName} Family`,
                guardian_name: newFamilyGuardianName,
                guardian_phone: guardianPhone1 || null,
                guardian_phone_2: guardianPhone2 || null,
                phone_normalized: normPhone1 || null,
                phone_normalized_2: normPhone2 || null,
              })
              .select("id")
              .single();

            if (famError) throw new Error(`Family creation failed: ${famError.message}`);
            finalFamilyId = newFamily.id;
          }
        }

        if (familyId) {
          const { data: familyCheck, error: familyError } = await supabaseAdmin
            .from("families")
            .select("id")
            .eq("id", familyId)
            .eq("school_id", callerSchoolId)
            .is("deleted_at", null)
            .maybeSingle();
            
          if (familyError) {
            console.error("Family check failed:", familyError);
            return NextResponse.json({ error: familyError.message }, { status: 500 });
          }
          
          if (!familyCheck) {
            return NextResponse.json({ error: "Invalid family ID or unauthorized access." }, { status: 403 });
          }
        }

        const { error } = await supabaseAdmin
          .from("students")
          .update({
            name,
            reg_no,
            class_id: class_id || null,
            family_id: finalFamilyId,
            gender,
            age,
          })
          .eq("id", id)
          .eq("school_id", callerSchoolId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        if (class_id) {
          const { data: cls } = await supabaseAdmin
            .from("classes").select("session_id").eq("id", class_id).eq("school_id", callerSchoolId).maybeSingle();

          if (cls?.session_id) {
            await supabaseAdmin.from("enrolments").upsert(
              [{ school_id: callerSchoolId, student_id: id, class_id, session_id: cls.session_id, status: "active" }],
              { onConflict: "student_id,session_id" }
            );
          }
        }

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "student.updated", targetTable: "students", targetId: id, targetLabel: name,
        });

        return NextResponse.json({ success: true });
      }

      case "delete-student": {
        const { id } = body;
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

        const { data: target } = await supabaseAdmin
          .from("students").select("id, name").eq("id", id).eq("school_id", callerSchoolId).maybeSingle();

        const { error } = await supabaseAdmin.from("students").delete().eq("id", id).eq("school_id", callerSchoolId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "student.deleted", targetTable: "students", targetId: id, targetLabel: target?.name || null,
        });

        return NextResponse.json({ success: true });
      }


      // ──────────────────────────────────────────────────────────
      // BULK IMPORT (ZERO-COST MIGRATION)
      // ──────────────────────────────────────────────────────────
      case "import-students-bulk": {
        const { rows, classesToCreate, sessionId } = body;

        if (!sessionId) {
          return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        // 1. Auto-Create Missing Classes
                // 1. Auto-Create Missing Classes Safely
        if (classesToCreate && classesToCreate.length > 0) {
          const { data: sessionData } = await supabaseAdmin
            .from("sessions")
            .select("name")
            .eq("id", sessionId)
            .single();

          const sessionName = sessionData?.name || "Current Session";

          // 🚨 Check which classes already exist to prevent batch failure
          const { data: existingClasses } = await supabaseAdmin
            .from("classes")
            .select("name")
            .eq("school_id", callerSchoolId)
            .eq("session_id", sessionId);

          const existingNames = new Set((existingClasses || []).map((c: any) => c.name.toLowerCase()));

          // Only insert the classes that are truly missing
          const newClassesToInsert = classesToCreate
            .filter((className: string) => !existingNames.has(className.toLowerCase()))
            .map((className: string) => ({
              school_id: callerSchoolId,
              name: className,
              session: sessionName,
              session_id: sessionId,
              teacher_id: null,
            }));

          if (newClassesToInsert.length > 0) {
            const { error: classErr } = await supabaseAdmin.from("classes").insert(newClassesToInsert);
            if (classErr) {
              return NextResponse.json(
                { error: `Failed to create classes: ${classErr.message}` },
                { status: 500 }
              );
            }
          }
        }

        // 2. Format Payload for the RPC
        const rpcPayload = rows.map((r: any) => ({
          studentName: r.studentName,
          className: r.className,
          regNo: r.regNo || null,
          age: r.age || null,
          gender: r.gender || null,
          guardianName: r.guardianName || null,
          phone1: r.phone1 || null,
          phone2: r.phone2 || null,
        }));

        // 3. Call the existing RPC
        const { data, error } = await supabaseAdmin.rpc("import_students_atomic", {
          p_school_id: callerSchoolId,
          p_session_id: sessionId,
          p_user_id: user.id,
          p_students: rpcPayload,
        });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // 4. Audit Log
        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId,
          actorId: user.id,
          actorName: callerName,
          action: "students.bulk_imported",
          targetTable: "students",
          targetId: "bulk",
          targetLabel: `Imported ${data.inserted} students`,
          metadata: {
            inserted: data.inserted,
            skipped: data.skipped,
            createdClasses: classesToCreate,
          },
        });

        return NextResponse.json({
          success: true,
          inserted: data.inserted,
          skipped: data.skipped,
        });
      }

      // ──────────────────────────────────────────────────────────
      // BULK IMPORT TEACHERS
      // ──────────────────────────────────────────────────────────
      case "import-teachers-bulk": {
        const { rows } = body;

        // 🚨 SECURITY GUARD: Prevent non-owners from sneaking in Admin roles via API manipulation
        if (!callerIsOwner) {
          const containsElevatedRole = rows.some((r: any) => r.role && r.role !== "teacher");
          if (containsElevatedRole) {
            return NextResponse.json(
              { error: "Only the owner can import admin accounts." },
              { status: 403 }
            );
          }
        }

        let inserted = 0;
        const skippedDetails: { name: string; reason: string }[] = [];

        for (const row of rows) {
          try {
            // 🚨 FIX: Prevent duplicate names if there is no email
            if (!row.email) {
              const { data: existingProfile } = await supabaseAdmin
                .from("profiles")
                .select("id")
                .eq("school_id", callerSchoolId)
                .ilike("name", row.teacherName)
                .is("email", null)
                .maybeSingle();

              if (existingProfile) {
                skippedDetails.push({ name: row.teacherName, reason: "Teacher with this exact name and no email already exists." });
                continue; // Skip creating a duplicate
              }
            }

            const authEmail = row.email || `${crypto.randomUUID()}@internal.naijaschool.local`;
            const tempPin = Math.floor(100000 + Math.random() * 900000).toString();
            const tempPassword = `Teacher#${tempPin}`;

            const { data: newUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
              email: authEmail,
              password: tempPassword,
              email_confirm: true,
              user_metadata: { name: row.teacherName },
              app_metadata: { role: "teacher", school_id: callerSchoolId },
            });

            if (authErr || !newUser.user) {
              console.error("Auth error:", authErr);
              skippedDetails.push({ name: row.teacherName, reason: authErr?.message || "Failed to create auth user" });
              continue;
            }

            await supabaseAdmin.from("profiles").insert([{
              id: newUser.user.id,
              name: row.teacherName,
              email: row.email || null,
              phone: row.phone || null,
              role: "teacher", // 🚨 FORCE TEACHER
              school_id: callerSchoolId,
            }]);

            if (row.assignedClass) {
              const { data: cls } = await supabaseAdmin
                .from("classes")
                .select("id")
                .eq("school_id", callerSchoolId)
                .ilike("name", row.assignedClass)
                .maybeSingle();
              
              if (cls) {
                await supabaseAdmin.from("classes").update({ teacher_id: newUser.user.id }).eq("id", cls.id);
              }
            }

            inserted++;
          } catch (err: any) {
            console.error("Teacher import error:", err);
            skippedDetails.push({ name: row.teacherName, reason: err.message || "Unknown error" });
          }
        }

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "teacher.bulk_imported", targetTable: "profiles", targetId: "bulk", targetLabel: `Imported ${inserted} teachers`,
        });

        return NextResponse.json({ success: true, inserted, skipped: skippedDetails.length, skippedDetails });
      }

            // ──────────────────────────────────────────────────────────
      // REORDER CLASSES (LADDER)
      // ──────────────────────────────────────────────────────────
      case "reorder-classes": {
        const { updates } = body;
        if (!updates || !Array.isArray(updates)) {
          return NextResponse.json({ error: "Invalid updates payload" }, { status: 400 });
        }

        for (const item of updates) {
          await supabaseAdmin
            .from("classes")
            .update({ sort_order: item.sort_order })
            .eq("id", item.id)
            .eq("school_id", callerSchoolId);
        }

        return NextResponse.json({ success: true });
      }

            // ──────────────────────────────────────────────────────────
      // PROMOTE CLASS (END OF SESSION)
      // ──────────────────────────────────────────────────────────
      case "promote-class": {
        const { classId, currentSessionId, nextSessionId, decisions } = body;
        
        for (const decision of decisions) {
          const { student_id, action, next_class_id } = decision;

          try {
            // 1. Find the student's current enrolment in the old session
            const { data: currentEnrolment } = await supabaseAdmin
              .from("enrolments")
              .select("id")
              .eq("student_id", student_id)
              .eq("session_id", currentSessionId)
              .eq("status", "active")
              .maybeSingle();

            if (!currentEnrolment) continue;

            if (action === "graduate" || action === "withdrawn") {
              const newStatus = action === "graduate" ? "graduated" : "withdrawn";
              
              // Mark old enrolment as completed
              await supabaseAdmin
                .from("enrolments")
                .update({ status: newStatus })
                .eq("id", currentEnrolment.id);
                
              // Remove from active roster and update status
              await supabaseAdmin
                .from("students")
                .update({ class_id: null, status: newStatus })
                .eq("id", student_id);

            } else {
              // Mark old enrolment as inactive
              await supabaseAdmin
                .from("enrolments")
                .update({ status: "inactive" })
                .eq("id", currentEnrolment.id);
                
              // Create new enrolment for the new session
              await supabaseAdmin.from("enrolments").insert({
                school_id: callerSchoolId,
                student_id: student_id,
                class_id: next_class_id, // For "repeat", this is the current class. For "promote", it's the next.
                session_id: nextSessionId,
                status: "active"
              });
              
              // Update student's current class and ensure status is active
              await supabaseAdmin
                .from("students")
                .update({ class_id: next_class_id, status: "active" })
                .eq("id", student_id);
            }
          } catch (err) {
            console.error(`Failed to process promotion for student ${student_id}:`, err);
          }
        }

        await logAudit(supabaseAdmin, {
          schoolId: callerSchoolId, actorId: user.id, actorName: callerName,
          action: "class.promoted", targetTable: "classes", targetId: classId, 
          targetLabel: `Processed rollover for class`,
        });

        return NextResponse.json({ success: true });
      }

      case "start-next-term": {
        if (!callerIsOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        // 1. Get current term and session
        const { data: currentTerm } = await supabaseAdmin
          .from("terms")
          .select("id, session_id, sequence")
          .eq("school_id", callerSchoolId)
          .eq("is_current", true)
          .maybeSingle();

        if (!currentTerm) return NextResponse.json({ error: "No current term found." }, { status: 404 });

        // 🚨 BRANCHING LOGIC: Is it Term 3?
        if (currentTerm.sequence === 3) {
          // --- SESSION ROLLOVER ---
          
          // Find the next session (the one created by the user in the UI)
          const { data: currentSession } = await supabaseAdmin
            .from("sessions").select("name").eq("id", currentTerm.session_id).single();
            
          const { data: nextSession } = await supabaseAdmin
            .from("sessions")
            .select("id, name")
            .eq("school_id", callerSchoolId)
            .gt("name", currentSession?.name || "") // Alphabetical next
            .order("name", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (!nextSession) {
            return NextResponse.json({ 
              error: "Please create the new Session (e.g., 2026/2027) in the Settings tab before starting." 
            }, { status: 400 });
          }

          // Call the new atomic RPC
          const { error } = await supabaseAdmin.rpc("start_next_session_atomic", {
            p_school_id: callerSchoolId,
            p_current_term_id: currentTerm.id,
            p_next_session_id: nextSession.id,
            p_user_id: user.id,
          });

          if (error) return NextResponse.json({ error: error.message }, { status: 400 });

          return NextResponse.json({ success: true, message: "Next session started." });

        } else {
          // --- NORMAL TERM ROLLOVER ---
          
          const { data: nextTerm } = await supabaseAdmin
            .from("terms")
            .select("id")
            .eq("session_id", currentTerm.session_id)
            .eq("sequence", currentTerm.sequence + 1)
            .maybeSingle();

          if (!nextTerm) return NextResponse.json({ error: "Next term not found." }, { status: 400 });

          const { error } = await supabaseAdmin.rpc("start_next_term_atomic", {
            p_school_id: callerSchoolId,
            p_current_term_id: currentTerm.id,
            p_next_term_id: nextTerm.id,
            p_user_id: user.id,
          });

          if (error) return NextResponse.json({ error: error.message }, { status: 400 });

          return NextResponse.json({ success: true, message: "Next term started." });
        }
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}