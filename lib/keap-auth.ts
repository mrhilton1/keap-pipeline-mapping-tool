import { cookies } from "next/headers"

interface TokenData {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
}

export async function getValidAccessToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("keap_access_token")
  const refreshToken = cookieStore.get("keap_refresh_token")

  console.log("[Keap Auth] Checking tokens - access:", !!accessToken?.value, "refresh:", !!refreshToken?.value)

  // If we have an access token, try to use it
  if (accessToken?.value) {
    return accessToken.value
  }

  // If no access token but we have refresh token, try to refresh
  if (refreshToken?.value) {
    console.log("[Keap Auth] Access token missing, attempting refresh...")
    const newTokens = await refreshAccessToken(refreshToken.value)
    if (newTokens) {
      return newTokens.access_token
    }
  }

  console.log("[Keap Auth] No valid tokens available")
  return null
}

async function refreshAccessToken(refreshToken: string): Promise<TokenData | null> {
  const clientId = process.env.KEAP_CLIENT_ID
  const clientSecret = process.env.KEAP_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error("[Keap Auth] Cannot refresh - missing client credentials")
    return null
  }

  try {
    console.log("[Keap Auth] Refreshing access token...")
    
    const response = await fetch("https://api.infusionsoft.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Keap Auth] Token refresh failed:", response.status, errorText)
      return null
    }

    const tokenData: TokenData = await response.json()
    console.log("[Keap Auth] Token refreshed successfully!")

    // Note: We can't set cookies here directly since this is a library function
    // The calling code needs to handle updating cookies if needed
    return tokenData

  } catch (error) {
    console.error("[Keap Auth] Token refresh error:", error)
    return null
  }
}

export async function refreshAndSetTokens(): Promise<{ accessToken: string; refreshToken?: string } | null> {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get("keap_refresh_token")

  if (!refreshToken?.value) {
    return null
  }

  const newTokens = await refreshAccessToken(refreshToken.value)
  if (!newTokens) {
    return null
  }

  // Return the new tokens - caller is responsible for setting cookies in the response
  return {
    accessToken: newTokens.access_token,
    refreshToken: newTokens.refresh_token,
  }
}
