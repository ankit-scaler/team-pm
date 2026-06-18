import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Hit by Vercel Cron (see vercel.json) to keep the free Supabase project from
// auto-pausing after 7 days of inactivity. Vercel sends Authorization: Bearer <CRON_SECRET>.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  try {
    const supabase = createAdminClient();
    await supabase.from("profiles").select("id", { count: "exact", head: true });
    return NextResponse.json({ ok: true, ranAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
