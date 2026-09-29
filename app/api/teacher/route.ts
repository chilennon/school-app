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

    if (
      !profile ||
      (profile.role !== "teacher" && profile.role !== "admin") ||
      !profile.school_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const callerSchoolId = profile.school_id;

    switch (action) {
      case "submit-class-results": {
        const { classId, termId } = body;
        if (!classId || !termId) {
          return NextResponse.json(
            { error: "Missing classId or termId" },
            { status: 400 }
          );
        }

        // Scope class to the caller's school, and load teacher_id for
        // the ownership check below.
        const { data: cls } = await supabaseAdmin
          .from("classes")
          .select("id, teacher_id")
          .eq("id", classId)
          .eq("school_id", callerSchoolId)
          .single();

        if (!cls) {
          return NextResponse.json({ error: "Class not found" }, { status: 404 });
        }

        if (profile.role === "teacher" && cls.teacher_id !== user.id) {
          return NextResponse.json({ error: "Not your class" }, { status: 403 });
        }

        // Find every active enrolment in this class — scoped by school
        const { data: enrolments } = await supabaseAdmin
          .from("enrolments")
          .select("id")
          .eq("class_id", classId)
          .eq("school_id", callerSchoolId)
          .eq("status", "active");

        if (!enrolments || enrolments.length === 0) {
          return NextResponse.json(
            { error: "No students in this class" },
            { status: 400 }
          );
        }

        const enrolmentIds = enrolments.map((e) => e.id);

        // Existing term_records for this class + term
        const { data: existing } = await supabaseAdmin
          .from("term_records")
          .select("enrolment_id, status")
          .in("enrolment_id", enrolmentIds)
          .eq("term_id", termId);

        const statusByEnrolment: Record<string, string> = {};
        (existing || []).forEach((r: any) => {
          statusByEnrolment[r.enrolment_id] = r.status;
        });

        // Only flip rows that are currently draft (or missing)
        const toSubmit = enrolmentIds.filter((id) => {
          const s = statusByEnrolment[id];
          return !s || s === "draft";
        });

        if (toSubmit.length === 0) {
          return NextResponse.json(
            {
              error:
                "Nothing to submit. All students are already submitted or approved.",
            },
            { status: 400 }
          );
        }

        const records = toSubmit.map((id) => ({
          school_id: callerSchoolId,
          enrolment_id: id,
          term_id: termId,
          status: "submitted",
          server_updated_at: new Date().toISOString(),
        }));

        const { error } = await supabaseAdmin
          .from("term_records")
          .upsert(records, { onConflict: "enrolment_id,term_id" });

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, count: records.length });
      }

      case "reopen-class-results": {
        const { classId, termId } = body;
        if (!classId || !termId) {
          return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        // Scope class to the caller's school and check ownership
        const { data: cls } = await supabaseAdmin
          .from("classes")
          .select("id, teacher_id")
          .eq("id", classId)
          .eq("school_id", callerSchoolId)
          .single();

        if (!cls) {
          return NextResponse.json({ error: "Class not found" }, { status: 404 });
        }

        if (profile.role === "teacher" && cls.teacher_id !== user.id) {
          return NextResponse.json({ error: "Not your class" }, { status: 403 });
        }

        const { data: enrolments } = await supabaseAdmin
          .from("enrolments")
          .select("id")
          .eq("class_id", classId)
          .eq("school_id", callerSchoolId)
          .eq("status", "active");

        if (!enrolments || enrolments.length === 0) {
          return NextResponse.json({ error: "No students" }, { status: 400 });
        }

        const ids = enrolments.map((e) => e.id);

        const { error } = await supabaseAdmin
          .from("term_records")
          .update({
            status: "draft",
            server_updated_at: new Date().toISOString(),
          })
          .eq("school_id", callerSchoolId)
          .in("enrolment_id", ids)
          .eq("term_id", termId);

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      case "add-class-subject": {
        const { classId, subjectId } = body;
        if (!classId || !subjectId) {
          return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        // Scope class to the caller's school
        const { data: cls } = await supabaseAdmin
          .from("classes")
          .select("id, session_id, teacher_id")
          .eq("id", classId)
          .eq("school_id", callerSchoolId)
          .single();

        if (!cls) {
          return NextResponse.json({ error: "Class not found" }, { status: 404 });
        }

        if (profile.role === "teacher" && cls.teacher_id !== user.id) {
          return NextResponse.json({ error: "Not your class" }, { status: 403 });
        }

        if (!cls.session_id) {
          return NextResponse.json(
            { error: "Class has no session" },
            { status: 400 }
          );
        }

        // Already linked?
        const { data: existing } = await supabaseAdmin
          .from("class_subjects")
          .select("id")
          .eq("class_id", classId)
          .eq("subject_id", subjectId)
          .eq("session_id", cls.session_id)
          .maybeSingle();

        if (existing) {
          return NextResponse.json({ classSubjectId: existing.id });
        }

        const { data: created, error } = await supabaseAdmin
          .from("class_subjects")
          .insert([
            {
              school_id: callerSchoolId,
              class_id: classId,
              subject_id: subjectId,
              session_id: cls.session_id,
              staff_id: user.id,
            },
          ])
          .select()
          .single();

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ classSubjectId: created.id });
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