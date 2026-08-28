import { draftMode } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/** Cleanly leaves draft mode and returns to the page being previewed. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  (await draftMode()).disable();
  const redirectTo = request.nextUrl.searchParams.get("to") ?? "/";
  // Only allow same-origin paths to avoid an open redirect.
  const safeTarget = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/";
  return NextResponse.redirect(new URL(safeTarget, request.url));
}
