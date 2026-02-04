import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapXmlRpcClient } from "@/lib/keap-xmlrpc"

/**
 * Batch endpoint to enrich opportunities with:
 * - Products (from ProductInterest table)
 * - Stage moves (from StageMove table) - for WON/LOST date tracking
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

    // Use OAuth access token (same as REST API)
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
    
    // Batch fetch products and stage moves
    const [productsMap, stageMovesMap] = await Promise.all([
      client.batchGetOpportunityProducts(opportunityIds.map(id => Number(id))),
      client.batchGetStageMoves(opportunityIds.map(id => Number(id)))
    ])

    // Convert Maps to objects for JSON serialization
    const products: Record<string, any[]> = {}
    productsMap.forEach((value, key) => {
      products[String(key)] = value
    })

    const stageMoves: Record<string, any[]> = {}
    stageMovesMap.forEach((value, key) => {
      stageMoves[String(key)] = value
    })

    console.log(`[Enrich API] Enriched ${opportunityIds.length} opportunities`)
    console.log(`[Enrich API] Products found for ${Object.keys(products).filter(k => products[k].length > 0).length} opportunities`)
    console.log(`[Enrich API] Stage moves found for ${Object.keys(stageMoves).filter(k => stageMoves[k].length > 0).length} opportunities`)

    return NextResponse.json({ 
      products,
      stageMoves
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
