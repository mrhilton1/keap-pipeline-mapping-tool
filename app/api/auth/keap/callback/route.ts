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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")
  const origin = getOrigin(request)

  console.log("[Keap OAuth Callback] Processing callback")
  console.log("[Keap OAuth Callback] Origin:", origin)
  console.log("[Keap OAuth Callback] Code received:", code ? "Yes" : "No")
  
  // Handle OAuth errors from Keap
  if (error) {
    console.error("[Keap OAuth Callback] Error from Keap:", error, errorDescription)
    const errorMsg = errorDescription || error
    return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(errorMsg)}`)
  }

  if (!code) {
    console.error("[Keap OAuth Callback] No code received")
    return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent("No authorization code received")}`)
  }

  const clientId = process.env.KEAP_CLIENT_ID
  const clientSecret = process.env.KEAP_CLIENT_SECRET
  
  // Build redirect URI - MUST match what was sent in the initial auth request
  const redirectUri = process.env.KEAP_REDIRECT_URI || `${origin}/api/auth/keap/callback`

  console.log("[Keap OAuth Callback] Redirect URI for token exchange:", redirectUri)

  if (!clientId || !clientSecret) {
    console.error("[Keap OAuth Callback] Missing credentials")
    return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent("Server configuration error: Missing Keap credentials")}`)
  }

  try {
    console.log("[Keap OAuth Callback] Exchanging code for token...")
    
    // Exchange authorization code for access token
    const tokenResponse = await fetch("https://api.infusionsoft.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    })

    const responseText = await tokenResponse.text()
    console.log("[Keap OAuth Callback] Token response status:", tokenResponse.status)
    
    if (!tokenResponse.ok) {
      console.error("[Keap OAuth Callback] Token exchange failed:", responseText)
      
      let errorMsg = "Failed to exchange authorization code"
      try {
        const errorJson = JSON.parse(responseText)
        errorMsg = errorJson.error_description || errorJson.error || errorMsg
      } catch {
        if (responseText) errorMsg = responseText.substring(0, 200)
      }
      
      return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(errorMsg)}`)
    }

    const tokenData = JSON.parse(responseText)

    console.log("[Keap OAuth Callback] Token received! Expires in:", tokenData.expires_in, "seconds")

    // Create redirect response with cookies
    const dashboardUrl = new URL("/dashboard", origin)
    dashboardUrl.searchParams.set("auth", "success")
    
    const response = NextResponse.redirect(dashboardUrl.toString())

    // Set access token cookie - be explicit about all options
    response.cookies.set({
      name: "keap_access_token",
      value: tokenData.access_token,
      httpOnly: true,
      secure: true, // Always secure for production
      sameSite: "lax",
      maxAge: tokenData.expires_in || 86400,
      path: "/",
    })

    // Set refresh token cookie
    if (tokenData.refresh_token) {
      response.cookies.set({
        name: "keap_refresh_token",
        value: tokenData.refresh_token,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      })
    }

    console.log("[Keap OAuth Callback] Cookies set, redirecting to dashboard")
    return response

  } catch (err) {
    console.error("[Keap OAuth Callback] Exception:", err)
    const errorMsg = err instanceof Error ? err.message : "Authentication failed"
    return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(errorMsg)}`)
  }
}
