import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8080";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/commitments`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([], { status: 502 });
  }
}
