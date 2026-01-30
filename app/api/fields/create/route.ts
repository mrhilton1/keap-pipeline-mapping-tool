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
    const { label, field_type } = body

    if (!label) {
      return NextResponse.json({ error: "Field label is required" }, { status: 400 })
    }

    const client = new KeapClient(accessToken.value)
    const result = await client.createCustomField({ label, field_type })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Error creating custom field:", error)
    return NextResponse.json({ error: "Failed to create custom field" }, { status: 500 })
  }
}
