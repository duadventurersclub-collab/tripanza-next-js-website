import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { updateUserProfile, type ProfileUpdate } from "@/lib/wp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ message: "Please log in again." }, { status: 401 });

  try {
    const input = (await request.json()) as ProfileUpdate;
    const profile = await updateUserProfile(token, input);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not update your profile." },
      { status: 400 },
    );
  }
}
