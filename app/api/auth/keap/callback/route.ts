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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")
  const origin = getOrigin(request)

  console.log("[Keap OAuth Callback] Processing callback")
  console.log("[Keap OAuth Callback] Origin:", origin)
  console.log("[Keap OAuth Callback] Code received:", code ? "Yes" : "No")
  
  if (error) {
    console.error("[Keap OAuth Callback] Error:", error, errorDescription)
  }

  // Handle OAuth errors from Keap
  if (error) {
    const errorMsg = errorDescription || error
    return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(errorMsg)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent("No authorization code received")}`)
  }

  const clientId = process.env.KEAP_CLIENT_ID
  const clientSecret = process.env.KEAP_CLIENT_SECRET
  
  // Build redirect URI dynamically - MUST match what was sent in the initial auth request
  const dynamicRedirectUri = `${origin}/api/auth/keap/callback`
  const redirectUri = process.env.KEAP_REDIRECT_URI || dynamicRedirectUri

  console.log("[Keap OAuth Callback] Redirect URI for token exchange:", redirectUri)

  if (!clientId || !clientSecret) {
    console.error("[Keap OAuth Callback] Missing credentials - clientId:", !!clientId, "clientSecret:", !!clientSecret)
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
    
    if (!tokenResponse.ok) {
      console.error("[Keap OAuth Callback] Token exchange failed:")
      console.error("[Keap OAuth Callback] Status:", tokenResponse.status)
      console.error("[Keap OAuth Callback] Response:", responseText)
      
      // Try to parse error details
      let errorMsg = "Failed to exchange authorization code"
      try {
        const errorJson = JSON.parse(responseText)
        errorMsg = errorJson.error_description || errorJson.error || errorMsg
      } catch {
        // Use raw text if not JSON
        if (responseText) errorMsg = responseText.substring(0, 100)
      }
      
      return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(errorMsg)}`)
    }

    const tokenData = JSON.parse(responseText)

    console.log("[Keap OAuth Callback] Token received successfully!")
    console.log("[Keap OAuth Callback] Token type:", tokenData.token_type)
    console.log("[Keap OAuth Callback] Expires in:", tokenData.expires_in, "seconds")
    console.log("[Keap OAuth Callback] Has refresh token:", !!tokenData.refresh_token)

    // Create response with redirect to dashboard
    const response = NextResponse.redirect(`${origin}/dashboard`)

    // Store tokens in HTTP-only cookies
    response.cookies.set("keap_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokenData.expires_in || 86400, // Default 24 hours
      path: "/",
    })

    if (tokenData.refresh_token) {
      response.cookies.set("keap_refresh_token", tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      })
    }

    return response
  } catch (err) {
    console.error("[Keap OAuth Callback] Exception during authentication:", err)
    const errorMsg = err instanceof Error ? err.message : "Authentication failed"
    return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(errorMsg)}`)
  }
}
