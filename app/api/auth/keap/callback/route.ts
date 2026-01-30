import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  console.log("[v0] OAuth Callback - Code received:", code ? "Yes" : "No")
  console.log("[v0] OAuth Callback - Error:", error)

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(`${request.nextUrl.origin}/auth/error?message=${error}`)
  }

  if (!code) {
    return NextResponse.redirect(`${request.nextUrl.origin}/auth/error?message=No authorization code received`)
  }

  const clientId = process.env.KEAP_CLIENT_ID
  const clientSecret = process.env.KEAP_CLIENT_SECRET
  const redirectUri = process.env.KEAP_REDIRECT_URI || "https://v0-opp2pipelines.vercel.app/api/auth/keap/callback"

  console.log("[v0] OAuth Callback - Redirect URI:", redirectUri)

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${request.nextUrl.origin}/auth/error?message=Server configuration error`)
  }

  try {
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

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error("[v0] Keap token exchange failed:", errorData)
      return NextResponse.redirect(`${request.nextUrl.origin}/auth/error?message=Failed to exchange authorization code`)
    }

    const tokenData = await tokenResponse.json()

    console.log("[v0] OAuth Callback - Token received successfully")

    // Create response with redirect to dashboard
    const response = NextResponse.redirect(`${request.nextUrl.origin}/dashboard`)

    // Store tokens in HTTP-only cookies
    response.cookies.set("keap_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokenData.expires_in || 86400, // Default 24 hours
    })

    if (tokenData.refresh_token) {
      response.cookies.set("keap_refresh_token", tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    return response
  } catch (error) {
    console.error("[v0] Error during Keap authentication:", error)
    return NextResponse.redirect(`${request.nextUrl.origin}/auth/error?message=Authentication failed`)
  }
}
