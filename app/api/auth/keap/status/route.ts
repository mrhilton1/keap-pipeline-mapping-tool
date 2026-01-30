import { type NextRequest, NextResponse } from "next/server"

// Helper to get origin from request headers
function getOrigin(request: NextRequest): string {
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
  
  return process.env.KEAP_REDIRECT_URI?.replace("/api/auth/keap/callback", "") 
    || "https://v0-opps2pipelines.vercel.app"
}

// Debug endpoint to check OAuth configuration
export async function GET(request: NextRequest) {
  try {
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
      keapSetup: {
        step1: "Go to https://keys.developer.keap.com/my-apps",
        step2: "Create or select your app",
        step3: "Add this EXACT redirect URI:",
        redirectUri: envRedirectUri || dynamicRedirectUri,
        step4: "Copy Client ID and Client Secret to Vercel env vars",
      },
      cookies: {
        hasAccessToken: !!request.cookies.get("keap_access_token"),
        hasRefreshToken: !!request.cookies.get("keap_refresh_token"),
      },
    })
  } catch (error) {
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}
