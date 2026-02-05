import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapClient } from "@/lib/keap-client"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const client = new KeapClient(accessToken.value)
    const users = await client.getUsers()

    return NextResponse.json({ users })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Users API] Error fetching users:", errorMessage)
    return NextResponse.json({ 
      error: "Failed to fetch users",
      details: errorMessage 
    }, { status: 500 })
  }
}
