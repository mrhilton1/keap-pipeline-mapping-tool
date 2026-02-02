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
    console.log("[Keap OAuth Callback] Expires in:", tokenData.expires_in, "seconds")

    // Build Set-Cookie headers
    const accessTokenCookie = [
      `keap_access_token=${tokenData.access_token}`,
      `Path=/`,
      `HttpOnly`,
      `Secure`,
      `SameSite=Lax`,
      `Max-Age=${tokenData.expires_in || 86400}`
    ].join("; ")

    const refreshTokenCookie = tokenData.refresh_token ? [
      `keap_refresh_token=${tokenData.refresh_token}`,
      `Path=/`,
      `HttpOnly`,
      `Secure`,
      `SameSite=Lax`,
      `Max-Age=${60 * 60 * 24 * 30}`
    ].join("; ") : null

    console.log("[Keap OAuth Callback] Cookie header:", accessTokenCookie.substring(0, 50) + "...")
    console.log("[Keap OAuth Callback] ========== END ==========")

    // Return an HTML page that redirects via JavaScript
    // This ensures the browser processes the Set-Cookie headers before navigation
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authenticating...</title>
  <meta http-equiv="refresh" content="0;url=${origin}/dashboard?auth=success">
</head>
<body>
  <p>Authentication successful! Redirecting...</p>
  <script>
    // Backup redirect in case meta refresh doesn't work
    setTimeout(function() {
      window.location.href = "${origin}/dashboard?auth=success";
    }, 100);
  </script>
</body>
</html>`

    const headers = new Headers()
    headers.set("Content-Type", "text/html; charset=utf-8")
    headers.append("Set-Cookie", accessTokenCookie)
    if (refreshTokenCookie) {
      headers.append("Set-Cookie", refreshTokenCookie)
    }
    // Add cache control to prevent caching
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate")

    return new Response(html, {
      status: 200,
      headers
    })

  } catch (err) {
    console.error("[Keap OAuth Callback] Exception:", err)
    const errorMsg = err instanceof Error ? err.message : "Authentication failed"
    return Response.redirect(`${origin}/auth/error?message=${encodeURIComponent(errorMsg)}`)
  }
}
