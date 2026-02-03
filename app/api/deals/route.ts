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
    const { name, stage_id, contact_id, owner_id, value, currency, estimated_close_time } = body

    if (!name || !stage_id) {
      return NextResponse.json({ 
        error: "Invalid request body",
        details: "Required: { name: string, stage_id: string }"
      }, { status: 400 })
    }

    console.log(`[Deals API] Creating deal: ${name} in stage ${stage_id}`)
    
    // Build v2 API request - ALL fields are REQUIRED per API errors
    const dealRequest: any = { 
      name, 
      stage_id,
      status: "OPEN",                    // REQUIRED: OPEN, WON, LOST
      owners: [],                        // REQUIRED: array (can be empty)
      contacts: [],                      // REQUIRED: array (can be empty)
      taskIds: [],                       // REQUIRED: array (can be empty)
      value: {                           // REQUIRED: value object
        amount: value ? Number(value) : 0,
        currency: currency || "USD"
      }
    }
    
    // Add contact to contacts array if provided
    if (contact_id) {
      dealRequest.contacts = [{ id: String(contact_id) }]
    }
    
    // Add owner to owners array if provided
    if (owner_id) {
      dealRequest.owners = [{ id: Number(owner_id) }]
    }
    
    // Add estimated close time if provided
    if (estimated_close_time) {
      dealRequest.estimated_close_time = estimated_close_time
    }

    console.log("[Deals API] Request body:", JSON.stringify(dealRequest))
    console.log("[Deals API] Version: 2024-02-03-v2")  // Version marker to verify deploy
    
    const client = new KeapClient(accessToken.value)
    const deal = await client.createDeal(dealRequest)

    console.log("[Deals API] Deal created:", deal.id)
    return NextResponse.json(deal)
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Deals API] Error creating deal:", errorMessage)
    console.error("[Deals API] Full error:", JSON.stringify(error, null, 2))
    
    // Try to extract more details from the error
    let details = errorMessage
    if (error?.response) {
      details = JSON.stringify(error.response)
    }
    
    return NextResponse.json({ 
      error: "Failed to create deal",
      details: details,
      raw: String(error)
    }, { status: 500 })
  }
}
