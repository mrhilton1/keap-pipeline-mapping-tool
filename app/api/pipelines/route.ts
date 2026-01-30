import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapClient } from "@/lib/keap-client"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken) {
      console.error("[Pipelines API] No access token found")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    console.log("[Pipelines API] Fetching pipelines...")
    const client = new KeapClient(accessToken.value)
    const pipelines = await client.getPipelines()

    console.log("[Pipelines API] Success, count:", pipelines?.pipelines?.length || 0)
    return NextResponse.json(pipelines)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Pipelines API] Error:", errorMessage)
    return NextResponse.json({ 
      error: "Failed to fetch pipelines",
      details: errorMessage 
    }, { status: 500 })
  }
}
