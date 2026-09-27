"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export interface TeacherSession {
  loading: boolean;
  userEmail: string;
  teacherName: string;
  schoolId: string | null;
  userId: string | null;
}

export function useTeacherSession(): TeacherSession {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/sign-in/staff");
        return;
      }
      if (cancelled) return;

      setUserId(user.id);
      setUserEmail(user.email || "");

      const [profileRes, schoolRes] = await Promise.all([
        supabase.from("profiles").select("name").eq("id", user.id).single(),
        supabase.from("schools").select("id").limit(1).single(),
      ]);

      if (cancelled) return;
      if (profileRes.data) setTeacherName(profileRes.data.name);
      if (schoolRes.data) setSchoolId(schoolRes.data.id);

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return { loading, userEmail, teacherName, schoolId, userId };
}