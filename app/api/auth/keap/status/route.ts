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
    || process.env.NEXT_PUBLIC_APP_URL
    || ""
}

// Actually test if the token works by calling Keap API
async function verifyToken(accessToken: string): Promise<{ valid: boolean; error?: string; v1Works?: boolean; v2Works?: boolean }> {
  // Test v1 API (opportunities)
  let v1Works = false
  let v1Error = ""
  try {
    const v1Response = await fetch("https://api.infusionsoft.com/crm/rest/v1/opportunities?limit=1", {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    v1Works = v1Response.ok
    if (!v1Response.ok) {
      v1Error = `v1 API: ${v1Response.status}`
    }
  } catch (e) {
    v1Error = `v1 API error: ${e}`
  }

  // Test v2 API (pipelines)
  let v2Works = false
  let v2Error = ""
  try {
    const v2Response = await fetch("https://slaapi.keapapis.com/v2/pipelines?page_size=1", {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    v2Works = v2Response.ok
    if (!v2Response.ok) {
      const errorText = await v2Response.text()
      v2Error = `v2 API: ${v2Response.status} - ${errorText.substring(0, 200)}`
    }
  } catch (e) {
    v2Error = `v2 API error: ${e}`
  }

  return {
    valid: v1Works || v2Works,
    v1Works,
    v2Works,
    error: !v1Works && !v2Works ? `${v1Error}; ${v2Error}` : undefined
  }
}

// Debug endpoint to check OAuth configuration
export async function GET(request: NextRequest) {
  try {
    const origin = getOrigin(request)
    const dynamicRedirectUri = `${origin}/api/auth/keap/callback`
    
    const clientId = process.env.KEAP_CLIENT_ID
    const clientSecret = process.env.KEAP_CLIENT_SECRET
    const envRedirectUri = process.env.KEAP_REDIRECT_URI
    
    const accessToken = request.cookies.get("keap_access_token")?.value
    const hasRefreshToken = !!request.cookies.get("keap_refresh_token")
    
    // If we have a token, verify it actually works
    let tokenStatus = null
    if (accessToken) {
      tokenStatus = await verifyToken(accessToken)
    }
    
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
        step4: "Copy Client ID and Client Secret to Cloudflare Worker secrets",
      },
      cookies: {
        hasAccessToken: !!accessToken,
        hasRefreshToken: hasRefreshToken,
      },
      tokenVerification: tokenStatus,
    })
  } catch (error) {
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}
