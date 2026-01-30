import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get("keap_refresh_token")

    if (!refreshToken?.value) {
      return NextResponse.json({ 
        error: "No refresh token", 
        details: "Please re-authenticate with Keap" 
      }, { status: 401 })
    }

    const clientId = process.env.KEAP_CLIENT_ID
    const clientSecret = process.env.KEAP_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json({ 
        error: "Server configuration error",
        details: "Missing Keap credentials" 
      }, { status: 500 })
    }

    console.log("[Keap Refresh] Attempting token refresh...")

    const response = await fetch("https://api.infusionsoft.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken.value,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    const responseText = await response.text()

    if (!response.ok) {
      console.error("[Keap Refresh] Failed:", response.status, responseText)
      
      // Clear invalid tokens
      const errorResponse = NextResponse.json({ 
        error: "Token refresh failed",
        details: "Your session has expired. Please re-authenticate with Keap."
      }, { status: 401 })
      
      errorResponse.cookies.delete("keap_access_token")
      errorResponse.cookies.delete("keap_refresh_token")
      
      return errorResponse
    }

    const tokenData = JSON.parse(responseText)
    console.log("[Keap Refresh] Success! New token expires in:", tokenData.expires_in, "seconds")

    const jsonResponse = NextResponse.json({ 
      success: true,
      expiresIn: tokenData.expires_in 
    })

    // Update cookies with new tokens
    jsonResponse.cookies.set("keap_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokenData.expires_in || 86400,
      path: "/",
    })

    if (tokenData.refresh_token) {
      jsonResponse.cookies.set("keap_refresh_token", tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      })
    }

    return jsonResponse
  } catch (error) {
    console.error("[Keap Refresh] Error:", error)
    return NextResponse.json({ 
      error: "Refresh failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
