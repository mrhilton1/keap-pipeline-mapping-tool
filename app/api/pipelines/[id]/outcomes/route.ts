import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapClient } from "@/lib/keap-client"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { id } = await params

    const client = new KeapClient(accessToken.value)
    
    try {
      const outcomes = await client.getPipelineOutcomes(id)
      return NextResponse.json(outcomes)
    } catch (err) {
      // If no outcomes configured, return empty array
      return NextResponse.json({ outcomes: [] })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Outcomes API] Error:", errorMessage)
    return NextResponse.json({ 
      error: "Failed to fetch pipeline outcomes",
      details: errorMessage 
    }, { status: 500 })
  }
}
