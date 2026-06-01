import { NextResponse, NextRequest } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  
  const cookieStore = await cookies()
  
  // Log what we're deleting
  const hadAccessToken = !!cookieStore.get("keap_access_token")
  const hadRefreshToken = !!cookieStore.get("keap_refresh_token")
  
  // Clear auth cookies
  cookieStore.delete("keap_access_token")
  cookieStore.delete("keap_refresh_token")
  
  
  // Redirect to home
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL || "/"))
}
