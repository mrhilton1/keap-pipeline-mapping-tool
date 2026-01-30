import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
  const cookieStore = await cookies()
  
  // Clear auth cookies
  cookieStore.delete("keap_access_token")
  cookieStore.delete("keap_refresh_token")
  
  // Redirect to home
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL || "https://v0-opps2pipelines.vercel.app"))
}
