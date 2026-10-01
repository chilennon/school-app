import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_GRADE_BANDS = [
  { min_score: 70, max_score: 100, grade: "A", remark: "Excellent", display_order: 1 },
  { min_score: 60, max_score: 69, grade: "B", remark: "Very Good", display_order: 2 },
  { min_score: 50, max_score: 59, grade: "C", remark: "Good", display_order: 3 },
  { min_score: 45, max_score: 49, grade: "D", remark: "Pass", display_order: 4 },
  { min_score: 40, max_score: 44, grade: "E", remark: "Fair", display_order: 5 },
  { min_score: 0, max_score: 39, grade: "F", remark: "Fail", display_order: 6 },
];

function currentSessionName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  // Nigerian academic year runs roughly August–July
  return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminName, email, password, schoolName, address, phone, motto } =
      body;

    // ── Validation ──
    if (
      !adminName?.trim() ||
      !email?.trim() ||
      !password ||
      !schoolName?.trim()
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // ── 1. Create the school row ──
    const { data: school, error: schoolErr } = await supabaseAdmin
      .from("schools")
      .insert([
        {
          name: schoolName.trim(),
          address: address?.trim() || null,
          phone: phone?.trim() || null,
          motto: motto?.trim() || null,
        },
      ])
      .select("id")
      .single();

    if (schoolErr || !school) {
      return NextResponse.json(
        { error: schoolErr?.message || "School creation failed" },
        { status: 500 }
      );
    }

    const schoolId = school.id;

    // ── 2. Seed a default session + three terms ──
    const sessionName = currentSessionName();

    const { data: newSession, error: sessErr } = await supabaseAdmin
      .from("sessions")
      .insert([
        {
          school_id: schoolId,
          name: sessionName,
          is_current: true,
        },
      ])
      .select("id")
      .single();

    if (sessErr || !newSession) {
      await supabaseAdmin.from("schools").delete().eq("id", schoolId);
      return NextResponse.json(
        { error: sessErr?.message || "Session setup failed" },
        { status: 500 }
      );
    }

    const { error: termsErr } = await supabaseAdmin.from("terms").insert([
      {
        school_id: schoolId,
        session_id: newSession.id,
        name: "First",
        sequence: 1,
        is_current: true,
      },
      {
        school_id: schoolId,
        session_id: newSession.id,
        name: "Second",
        sequence: 2,
        is_current: false,
      },
      {
        school_id: schoolId,
        session_id: newSession.id,
        name: "Third",
        sequence: 3,
        is_current: false,
      },
    ]);

    if (termsErr) {
      await supabaseAdmin.from("sessions").delete().eq("id", newSession.id);
      await supabaseAdmin.from("schools").delete().eq("id", schoolId);
      return NextResponse.json({ error: termsErr.message }, { status: 500 });
    }

    // ── 3. Seed default grade bands ──
    const { error: bandsErr } = await supabaseAdmin.from("grade_bands").insert(
      DEFAULT_GRADE_BANDS.map((b) => ({ ...b, school_id: schoolId }))
    );

    if (bandsErr) {
      await supabaseAdmin.from("terms").delete().eq("session_id", newSession.id);
      await supabaseAdmin.from("sessions").delete().eq("id", newSession.id);
      await supabaseAdmin.from("schools").delete().eq("id", schoolId);
      return NextResponse.json({ error: bandsErr.message }, { status: 500 });
    }

    // ── 4. Create the admin user — trigger creates the profile ──
    const { data: authUser, error: authErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: { name: adminName.trim() },
        app_metadata: {
          role: "admin",
          school_id: schoolId,
        },
      });

    if (authErr || !authUser.user) {
      await supabaseAdmin.from("grade_bands").delete().eq("school_id", schoolId);
      await supabaseAdmin.from("terms").delete().eq("session_id", newSession.id);
      await supabaseAdmin.from("sessions").delete().eq("id", newSession.id);
      await supabaseAdmin.from("schools").delete().eq("id", schoolId);

      return NextResponse.json(
        { error: authErr?.message || "Admin account creation failed" },
        { status: 500 }
      );
    }

    // Explicitly insert the profile row (no trigger involved)
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .insert([
        {
          id: authUser.user.id,
          name: adminName.trim(),
          email: email.trim(),
          role: "admin",
          school_id: schoolId,
        },
      ]);

    if (profileErr) {
      console.error("signup profile error:", profileErr);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin.from("grade_bands").delete().eq("school_id", schoolId);
      await supabaseAdmin.from("terms").delete().eq("session_id", newSession.id);
      await supabaseAdmin.from("sessions").delete().eq("id", newSession.id);
      await supabaseAdmin.from("schools").delete().eq("id", schoolId);

      return NextResponse.json(
        { error: profileErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      schoolId,
      email: email.trim(),
    });
  } catch (err) {
    console.error("School signup failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}