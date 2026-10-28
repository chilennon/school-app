import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tables, cursors } = await req.json();
    if (!tables || !Array.isArray(tables)) {
      return NextResponse.json({ error: "Invalid tables parameter" }, { status: 400 });
    }

    const results: Record<string, { rows: any[]; next_cursor: string | null }> = {};

    // We iterate through each table the client requested
    for (const table of tables) {
      const cursor = cursors[table] || "1970-01-01T00:00:00Z";

      // RLS is automatically applied here because we use the user-scoped client!
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .gt("server_updated_at", cursor)
        .order("server_updated_at", { ascending: true })
        .limit(500); // Page size

      if (error) {
        console.error(`Sync pull error for ${table}:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (data && data.length > 0) {
        // The new cursor is the server_updated_at of the last row
        const nextCursor = data[data.length - 1].server_updated_at;
        results[table] = { rows: data, next_cursor: nextCursor };
      } else {
        results[table] = { rows: [], next_cursor: cursor };
      }
    }

    return NextResponse.json({ tables: results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}