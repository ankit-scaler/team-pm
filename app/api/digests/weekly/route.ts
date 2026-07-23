import { NextResponse } from "next/server";
import { postCompletionDigest_range, istNow, ymd, shiftDays, istDayOfWeek } from "@/lib/digests";

// Friday EOD (Vercel Cron). Posts a per-person summary of everything completed
// Monday → today (Friday) this week. Cron sends Authorization: Bearer <CRON_SECRET>.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  }

  const ist = istNow();
  const dow = istDayOfWeek(ist); // Sun=0 … Sat=6
  const backToMonday = dow === 0 ? 6 : dow - 1;
  const from = ymd(shiftDays(ist, -backToMonday)); // Monday of this week
  const to = ymd(ist); // today (Friday when scheduled)

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const appUrl = host ? `${proto}://${host}` : undefined;

  try {
    const res = await postCompletionDigest_range({
      from,
      to,
      label: "Completed this week (Mon–Fri)",
      appUrl,
    });
    return NextResponse.json({ ok: true, window: { from, to }, ...res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
