import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // Keap OAuth configuration
  const clientId = process.env.KEAP_CLIENT_ID
  
  // Build redirect URI dynamically from the request origin
  // This ensures it works on any Vercel deployment (preview, production, etc.)
  const origin = request.nextUrl.origin
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
