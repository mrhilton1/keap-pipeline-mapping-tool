import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { KeapClient } from "@/lib/keap-client"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { name, stages } = body

    if (!name) {
      return NextResponse.json({ error: "Pipeline name is required" }, { status: 400 })
    }

    const client = new KeapClient(accessToken.value)
    const result = await client.createPipeline({ name, stages })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Error creating pipeline:", error)
    return NextResponse.json({ error: "Failed to create pipeline" }, { status: 500 })
  }
}
