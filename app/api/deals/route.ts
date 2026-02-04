import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapClient, CreateDealRequest } from "@/lib/keap-client"

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

interface DealRequestBody {
  name: string
  stage_id: string
  contact_id?: string
  owner_id?: string | number
  value?: number
  currency?: string
  estimated_close_time?: string
  created_time?: string         // Original creation date from opportunity
  last_updated_time?: string    // Original last updated date from opportunity
  status?: "ACTIVE" | "WON" | "LOST"
  custom_fields?: Record<string, any>
  task_ids?: string[]
  // Notes to create after deal
  notes?: Array<{
    body: string
    created_by?: string
    created_time?: string
  }>
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body: DealRequestBody = await request.json()
    const { 
      name, 
      stage_id, 
      contact_id, 
      owner_id, 
      value, 
      currency = "USD", 
      estimated_close_time,
      created_time,
      last_updated_time,
      status = "ACTIVE",
      custom_fields,
      task_ids = [],
      notes = []
    } = body

    if (!name || !stage_id) {
      return NextResponse.json({ 
        error: "Invalid request body",
        details: "Required: { name: string, stage_id: string }"
      }, { status: 400 })
    }

    console.log(`[Deals API] Creating deal: ${name} in stage ${stage_id}`)
    console.log("[Deals API] Version: 2026-02-03-v3")  // Version marker
    
    // Build v2 API request with correct schema
    const dealRequest: CreateDealRequest = { 
      name, 
      stage_id,
      status,                                     // OPEN, WON, or LOST
      owners: [],                                 // Array of { id: string }
      contacts: [],                               // Array of { id: string, primary_contact: boolean }
      task_ids: task_ids,                         // Array of task IDs
      value: {
        amount: value ? Number(value) : 0,
        currency: currency
      }
    }
    
    // Add contact with primary_contact flag
    if (contact_id) {
      dealRequest.contacts = [{ 
        id: String(contact_id), 
        primary_contact: true 
      }]
    }
    
    // Add owner as string ID
    if (owner_id) {
      dealRequest.owners = [{ id: String(owner_id) }]
    }
    
    // Add estimated close time
    if (estimated_close_time) {
      dealRequest.estimated_close_time = estimated_close_time
    }
    
    // Add original dates from opportunity (if API supports setting these)
    if (created_time) {
      dealRequest.created_time = created_time
    }
    if (last_updated_time) {
      dealRequest.last_updated_time = last_updated_time
    }
    
    // Add custom fields
    if (custom_fields && Object.keys(custom_fields).length > 0) {
      dealRequest.custom_fields = custom_fields
    }

    console.log("[Deals API] Request body:", JSON.stringify(dealRequest, null, 2))
    
    const client = new KeapClient(accessToken.value)
    const deal = await client.createDeal(dealRequest)

    console.log("[Deals API] Deal created:", deal.id)
    
    // Create notes if provided (oldest first)
    if (notes.length > 0 && deal.id) {
      console.log(`[Deals API] Creating ${notes.length} notes for deal ${deal.id}`)
      
      // Sort notes by created_time if available (oldest first)
      const sortedNotes = [...notes].sort((a, b) => {
        if (!a.created_time || !b.created_time) return 0
        return new Date(a.created_time).getTime() - new Date(b.created_time).getTime()
      })
      
      for (const note of sortedNotes) {
        try {
          const noteRequest: any = { body: note.body }
          
          // Try to set created_by if provided
          if (note.created_by) {
            noteRequest.created_by = String(note.created_by)
          }
          
          // Try to set created_time if provided (API may or may not accept this)
          if (note.created_time) {
            noteRequest.created_time = note.created_time
          }
          
          console.log(`[Deals API] Creating note: ${note.body.substring(0, 50)}...`)
          await client.createDealNote(deal.id, noteRequest)
        } catch (noteErr) {
          console.error(`[Deals API] Failed to create note:`, noteErr)
          // Continue with other notes even if one fails
        }
      }
    }

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
