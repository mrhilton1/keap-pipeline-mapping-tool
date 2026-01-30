import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // Keap OAuth configuration
  const clientId = process.env.KEAP_CLIENT_ID
  const redirectUri = process.env.KEAP_REDIRECT_URI || "https://v0-opp2pipelines.vercel.app/api/auth/keap/callback"

  if (!clientId) {
    return NextResponse.json({ error: "Keap client ID not configured" }, { status: 500 })
  }

  console.log("[v0] OAuth Init - Client ID:", clientId?.substring(0, 10) + "...")
  console.log("[v0] OAuth Init - Redirect URI:", redirectUri)

  // Build Keap OAuth authorization URL
  const authUrl = new URL("https://accounts.infusionsoft.com/app/oauth/authorize")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", "full")

  console.log("[v0] OAuth Init - Full Auth URL:", authUrl.toString())

  return NextResponse.redirect(authUrl.toString())
}
