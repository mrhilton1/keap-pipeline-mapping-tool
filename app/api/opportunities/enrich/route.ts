import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapXmlRpcClient } from "@/lib/keap-xmlrpc"

/**
 * Batch endpoint to enrich opportunities with:
 * - Products (from ProductInterest + Product tables)
 * - Stage moves (from StageMove table) - for last updated and WON/LOST date tracking
 * 
 * New approach:
 * 1. Pull ALL ProductInterest records, filter by OpportunityId != null
 * 2. Look up Product table for name/price
 * 3. Pull ALL StageMove records
 * 4. Analyze for MAX date (last updated) and any WON/LOST moves
 * 
 * POST body: { opportunityIds: number[] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { opportunityIds } = body

    if (!Array.isArray(opportunityIds) || opportunityIds.length === 0) {
      return NextResponse.json({ 
        error: "Invalid request",
        details: "Provide opportunityIds array"
      }, { status: 400 })
    }

    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken?.value) {
      return NextResponse.json({ 
        error: "Not authenticated",
        products: {},
        stageMoves: {}
      }, { status: 401 })
    }

    console.log(`[Enrich API] Enriching ${opportunityIds.length} opportunities`)
    
    const client = new KeapXmlRpcClient(accessToken.value)
    const oppIdSet = new Set(opportunityIds.map(id => Number(id)))
    
    // Fetch ALL data first, then filter to requested IDs
    const [productMap, stageMoveMap] = await Promise.all([
      client.buildOpportunityProductMap(),
      client.buildOpportunityStageMoveMap()
    ])

    // Filter to only requested opportunity IDs
    const products: Record<string, any[]> = {}
    const stageMoves: Record<string, {
      moves: any[]
      lastUpdated: string | null
      outcomeDate: string | null
      outcome: 'WON' | 'LOST' | null
    }> = {}

    for (const oppId of oppIdSet) {
      // Products
      const oppProducts = productMap.get(oppId)
      if (oppProducts && oppProducts.length > 0) {
        products[String(oppId)] = oppProducts
      }

      // Stage moves with analysis
      const oppStageMoves = stageMoveMap.get(oppId)
      if (oppStageMoves) {
        stageMoves[String(oppId)] = oppStageMoves
      }
    }

    const productsFound = Object.keys(products).length
    const stageMovesFound = Object.keys(stageMoves).length
    
    console.log(`[Enrich API] Enriched ${opportunityIds.length} opportunities`)
    console.log(`[Enrich API] Products found for ${productsFound} opportunities`)
    console.log(`[Enrich API] Stage moves found for ${stageMovesFound} opportunities`)

    return NextResponse.json({ 
      products,
      stageMoves,
      summary: {
        requested: opportunityIds.length,
        productsFound,
        stageMovesFound
      }
    })
  } catch (error) {
    console.error("[Enrich API] Error:", error)
    return NextResponse.json({ 
      error: "Failed to enrich opportunities",
      details: error instanceof Error ? error.message : "Unknown error",
      products: {},
      stageMoves: {}
    }, { status: 500 })
  }
}
