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
    const deals = await client.getDeals()

    return NextResponse.json(deals)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Deals API] Error:", errorMessage)
    return NextResponse.json({ 
      error: "Failed to fetch deals",
      details: errorMessage 
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { name, stage_id, contact_id, value, currency } = body

    if (!name || !stage_id) {
      return NextResponse.json({ 
        error: "Invalid request body",
        details: "Required: { name: string, stage_id: string }"
      }, { status: 400 })
    }

    console.log(`[Deals API] Creating deal: ${name} in stage ${stage_id}`)
    const client = new KeapClient(accessToken.value)
    const deal = await client.createDeal({ 
      name, 
      stage_id, 
      contact_id, 
      value,
      currency 
    })

    console.log("[Deals API] Deal created:", deal.id)
    return NextResponse.json(deal)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Deals API] Error creating deal:", errorMessage)
    return NextResponse.json({ 
      error: "Failed to create deal",
      details: errorMessage 
    }, { status: 500 })
  }
}
