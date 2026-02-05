import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapClient } from "@/lib/keap-client"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken) {
      console.error("[Opportunities API] No access token found")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const client = new KeapClient(accessToken.value)
    const opportunities = await client.getOpportunities()

    return NextResponse.json(opportunities)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Opportunities API] Error:", errorMessage)
    return NextResponse.json({ 
      error: "Failed to fetch opportunities",
      details: errorMessage 
    }, { status: 500 })
  }
}
