import { type NextRequest } from "next/server"

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

// Build a Set-Cookie header value
function buildCookie(name: string, value: string, maxAge: number): string {
  const parts = [
    `${name}=${value}`,
    `Path=/`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`
  ]
  return parts.join("; ")
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")
  const origin = getOrigin(request)

  console.log("[Keap OAuth Callback] ========== START ==========")
  console.log("[Keap OAuth Callback] Origin:", origin)
  console.log("[Keap OAuth Callback] Code received:", code ? "Yes" : "No")
  
  // Handle OAuth errors from Keap
  if (error) {
    console.error("[Keap OAuth Callback] Error from Keap:", error, errorDescription)
    const errorMsg = errorDescription || error
    return Response.redirect(`${origin}/auth/error?message=${encodeURIComponent(errorMsg)}`)
  }

  if (!code) {
    console.error("[Keap OAuth Callback] No code received")
    return Response.redirect(`${origin}/auth/error?message=${encodeURIComponent("No authorization code received")}`)
  }

  const clientId = process.env.KEAP_CLIENT_ID
  const clientSecret = process.env.KEAP_CLIENT_SECRET
  const redirectUri = process.env.KEAP_REDIRECT_URI || `${origin}/api/auth/keap/callback`

  console.log("[Keap OAuth Callback] Redirect URI:", redirectUri)

  if (!clientId || !clientSecret) {
    console.error("[Keap OAuth Callback] Missing credentials")
    return Response.redirect(`${origin}/auth/error?message=${encodeURIComponent("Server configuration error")}`)
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
      
      return Response.redirect(`${origin}/auth/error?message=${encodeURIComponent(errorMsg)}`)
    }

    const tokenData = JSON.parse(responseText)
    
    console.log("[Keap OAuth Callback] ✓ Token received!")
    console.log("[Keap OAuth Callback] Token type:", tokenData.token_type)
    console.log("[Keap OAuth Callback] Expires in:", tokenData.expires_in, "seconds")
    console.log("[Keap OAuth Callback] Has refresh token:", !!tokenData.refresh_token)
    console.log("[Keap OAuth Callback] Access token length:", tokenData.access_token?.length)

    // Build Set-Cookie headers manually (more reliable than NextResponse.cookies)
    const cookies: string[] = []
    
    // Access token cookie
    cookies.push(buildCookie(
      "keap_access_token",
      tokenData.access_token,
      tokenData.expires_in || 86400
    ))
    
    // Refresh token cookie (if present)
    if (tokenData.refresh_token) {
      cookies.push(buildCookie(
        "keap_refresh_token",
        tokenData.refresh_token,
        60 * 60 * 24 * 30 // 30 days
      ))
    }

    console.log("[Keap OAuth Callback] Setting", cookies.length, "cookies")
    console.log("[Keap OAuth Callback] Redirecting to dashboard...")
    console.log("[Keap OAuth Callback] ========== END ==========")

    // Use native Response with multiple Set-Cookie headers
    return new Response(null, {
      status: 302,
      headers: [
        ["Location", `${origin}/dashboard?auth=success`],
        ...cookies.map(cookie => ["Set-Cookie", cookie] as [string, string])
      ]
    })

  } catch (err) {
    console.error("[Keap OAuth Callback] Exception:", err)
    const errorMsg = err instanceof Error ? err.message : "Authentication failed"
    return Response.redirect(`${origin}/auth/error?message=${encodeURIComponent(errorMsg)}`)
  }
}
