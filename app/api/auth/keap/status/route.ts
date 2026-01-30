import { type NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"

// Helper to get origin from request
function getOrigin(request: NextRequest): string {
  const headersList = headers()
  const forwardedHost = headersList.get("x-forwarded-host")
  const forwardedProto = headersList.get("x-forwarded-proto") || "https"
  
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }
  
  const host = headersList.get("host")
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https"
    return `${proto}://${host}`
  }
  
  if (request.nextUrl?.origin) {
    return request.nextUrl.origin
  }
  
  return process.env.NEXT_PUBLIC_APP_URL || "https://v0-opp2pipelines.vercel.app"
}

// Debug endpoint to check OAuth configuration
export async function GET(request: NextRequest) {
  const origin = getOrigin(request)
  const dynamicRedirectUri = `${origin}/api/auth/keap/callback`
  
  const clientId = process.env.KEAP_CLIENT_ID
  const clientSecret = process.env.KEAP_CLIENT_SECRET
  const envRedirectUri = process.env.KEAP_REDIRECT_URI
  
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    origin: origin,
    configuration: {
      clientId: clientId ? `${clientId.substring(0, 8)}...` : "NOT SET",
      clientSecret: clientSecret ? "SET (hidden)" : "NOT SET",
      redirectUri: {
        env: envRedirectUri || "NOT SET (using dynamic)",
        dynamic: dynamicRedirectUri,
        active: envRedirectUri || dynamicRedirectUri,
      },
    },
    keapDeveloperPortalInstructions: {
      step1: "Go to https://keys.developer.keap.com/my-apps",
      step2: "Select your app (or create one)",
      step3: "In 'Redirect URIs', add:",
      redirectUri: envRedirectUri || dynamicRedirectUri,
      note: "The redirect URI in Keap MUST exactly match the 'active' URI above",
    },
    cookies: {
      hasAccessToken: !!request.cookies.get("keap_access_token"),
      hasRefreshToken: !!request.cookies.get("keap_refresh_token"),
    },
  })
}
