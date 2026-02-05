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


  if (!clientId || !clientSecret) {
    console.error("[Keap OAuth Callback] Missing credentials")
    return Response.redirect(`${origin}/auth/error?message=${encodeURIComponent("Server configuration error")}`)
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

    const responseText = await tokenResponse.text()
    
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


    // Return an HTML page that handles both popup and redirect flows
    // This ensures the browser processes the Set-Cookie headers before navigation
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authenticating...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { margin: 0 0 0.5rem; font-weight: 500; }
    p { margin: 0; opacity: 0.9; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h2>Authentication Successful!</h2>
    <p id="status">Completing setup...</p>
  </div>
  <script>
    (function() {
      // Check if this is a popup window
      if (window.opener && !window.opener.closed) {
        // Send success message to opener
        window.opener.postMessage({ type: 'KEAP_AUTH_SUCCESS' }, '${origin}');
        document.getElementById('status').textContent = 'You can close this window.';
        // Close popup after a short delay
        setTimeout(function() {
          window.close();
        }, 1500);
      } else {
        // Not a popup - redirect normally
        document.getElementById('status').textContent = 'Redirecting to dashboard...';
        setTimeout(function() {
          window.location.href = "${origin}/dashboard?auth=success";
        }, 100);
      }
    })();
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
