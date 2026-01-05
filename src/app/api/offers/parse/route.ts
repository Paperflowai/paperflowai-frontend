import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  return NextResponse.json(
    { ok: false, error: "PDF parsing temporarily disabled" },
    { status: 501 }
  );
}
