import { NextResponse, NextRequest } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  console.log("[Logout API] ========== LOGOUT CALLED ==========")
  console.log("[Logout API] Referer:", request.headers.get("referer"))
  console.log("[Logout API] User-Agent:", request.headers.get("user-agent")?.substring(0, 50))
  
  const cookieStore = await cookies()
  
  // Log what we're deleting
  const hadAccessToken = !!cookieStore.get("keap_access_token")
  const hadRefreshToken = !!cookieStore.get("keap_refresh_token")
  console.log("[Logout API] Had access token:", hadAccessToken)
  console.log("[Logout API] Had refresh token:", hadRefreshToken)
  
  // Clear auth cookies
  cookieStore.delete("keap_access_token")
  cookieStore.delete("keap_refresh_token")
  
  console.log("[Logout API] Cookies cleared, redirecting to home")
  console.log("[Logout API] ========== END ==========")
  
  // Redirect to home
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL || "https://v0-opps2pipelines.vercel.app"))
}
