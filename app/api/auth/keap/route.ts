import { type NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"

// Helper to get origin from request
function getOrigin(request: NextRequest): string {
  // Try multiple methods to get the origin
  // 1. Check x-forwarded-host header (set by Vercel/proxies)
  const headersList = headers()
  const forwardedHost = headersList.get("x-forwarded-host")
  const forwardedProto = headersList.get("x-forwarded-proto") || "https"
  
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }
  
  // 2. Check host header
  const host = headersList.get("host")
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https"
    return `${proto}://${host}`
  }
  
  // 3. Try nextUrl.origin (may be undefined in some contexts)
  if (request.nextUrl?.origin) {
    return request.nextUrl.origin
  }
  
  // 4. Fall back to env var or default
  return process.env.NEXT_PUBLIC_APP_URL || "https://v0-opp2pipelines.vercel.app"
}

export async function GET(request: NextRequest) {
  // Keap OAuth configuration
  const clientId = process.env.KEAP_CLIENT_ID
  
  // Build redirect URI dynamically from the request origin
  const origin = getOrigin(request)
  const dynamicRedirectUri = `${origin}/api/auth/keap/callback`
  
  // Allow override via env var, but default to dynamic
  const redirectUri = process.env.KEAP_REDIRECT_URI || dynamicRedirectUri

  if (!clientId) {
    console.error("[Keap OAuth] Missing KEAP_CLIENT_ID environment variable")
    return NextResponse.json({ 
      error: "Keap client ID not configured",
      help: "Set KEAP_CLIENT_ID in your environment variables"
    }, { status: 500 })
  }

  console.log("[Keap OAuth] Starting authorization flow")
  console.log("[Keap OAuth] Origin:", origin)
  console.log("[Keap OAuth] Redirect URI:", redirectUri)
  console.log("[Keap OAuth] Client ID:", clientId.substring(0, 8) + "...")

  // Build Keap OAuth authorization URL
  const authUrl = new URL("https://accounts.infusionsoft.com/app/oauth/authorize")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", "full")

  console.log("[Keap OAuth] Redirecting to:", authUrl.toString())

  return NextResponse.redirect(authUrl.toString())
}
