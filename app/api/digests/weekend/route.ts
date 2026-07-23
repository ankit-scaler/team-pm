import { NextResponse } from "next/server";
import { postCompletionDigest_range, istNow, ymd, shiftDays } from "@/lib/digests";

// Monday morning (Vercel Cron). Posts a per-person summary of everything
// completed over the weekend just gone (Saturday + Sunday).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  }

  const ist = istNow();
  const from = ymd(shiftDays(ist, -2)); // Saturday
  const to = ymd(shiftDays(ist, -1)); // Sunday

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const appUrl = host ? `${proto}://${host}` : undefined;

  try {
    const res = await postCompletionDigest_range({
      from,
      to,
      label: "Completed over the weekend (Sat–Sun)",
      appUrl,
    });
    return NextResponse.json({ ok: true, window: { from, to }, ...res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
