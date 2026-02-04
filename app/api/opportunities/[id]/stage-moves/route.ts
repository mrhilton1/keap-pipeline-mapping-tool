import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapXmlRpcClient } from "@/lib/keap-xmlrpc"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const opportunityId = parseInt(params.id, 10)
    
    if (isNaN(opportunityId)) {
      return NextResponse.json({ error: "Invalid opportunity ID" }, { status: 400 })
    }

    // Use OAuth access token (same as REST API)
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken?.value) {
      return NextResponse.json({ 
        error: "Not authenticated",
        stageMoves: [],
        outcomeDate: null
      }, { status: 401 })
    }

    const client = new KeapXmlRpcClient(accessToken.value)
    
    // Get all stage moves and outcome date
    const [stageMoves, outcomeDate] = await Promise.all([
      client.getOpportunityStageMoves(opportunityId),
      client.getOpportunityOutcomeDate(opportunityId)
    ])

    return NextResponse.json({ 
      stageMoves,
      outcomeDate
    })
  } catch (error) {
    console.error(`[Stage Moves API] Error for opportunity ${params.id}:`, error)
    return NextResponse.json({ 
      error: "Failed to fetch stage moves",
      details: error instanceof Error ? error.message : "Unknown error",
      stageMoves: [],
      outcomeDate: null
    })
  }
}
