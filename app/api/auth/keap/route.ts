import { type NextRequest, NextResponse } from "next/server"

// Helper to get origin from request headers
function getOrigin(request: NextRequest): string {
  // Use request.headers directly (more reliable than headers() function)
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https"
  
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }
  
  const host = request.headers.get("host")
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https"
    return `${proto}://${host}`
  }
  
  // Fall back to env var
  return process.env.KEAP_REDIRECT_URI?.replace("/api/auth/keap/callback", "") 
    || "https://v0-opps2pipelines.vercel.app"
}

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.KEAP_CLIENT_ID
    
    // Build redirect URI - prefer env var for consistency
    const origin = getOrigin(request)
    const redirectUri = process.env.KEAP_REDIRECT_URI || `${origin}/api/auth/keap/callback`

    if (!clientId) {
      console.error("[Keap OAuth] Missing KEAP_CLIENT_ID")
      return NextResponse.json({ 
        error: "Keap client ID not configured",
        help: "Set KEAP_CLIENT_ID in Vercel environment variables"
      }, { status: 500 })
    }


    // Build Keap OAuth authorization URL
    // Per docs: https://developer.infusionsoft.com/getting-started-oauth-keys/
    // v1 API needs "full" scope, v2 Pipelines API (slaapi) needs "api" scope
    // Request both to access all APIs
    const authUrl = new URL("https://accounts.infusionsoft.com/app/oauth/authorize")
    authUrl.searchParams.set("client_id", clientId)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", "full api")

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    console.error("[Keap OAuth] Error:", error)
    return NextResponse.json({ 
      error: "OAuth initialization failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
