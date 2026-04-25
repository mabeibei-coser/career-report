import { NextRequest, NextResponse } from "next/server";

// Temporary debug endpoint – remove after diagnosis
export async function GET(_req: NextRequest) {
  return NextResponse.json({
    ok: true,
    // proxy let us through → session was valid
    timestamp: Date.now(),
  });
}
