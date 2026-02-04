import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapXmlRpcClient } from "@/lib/keap-xmlrpc"

/**
 * Enrich opportunities with XML-RPC data
 * 
 * Flow:
 * 1. Receive array of opportunity IDs from frontend
 * 2. For EACH opportunity ID, query XML-RPC:
 *    - ProductInterest (by ObjectId = opportunityId)
 *    - StageMove (by OpportunityId = opportunityId)
 * 3. Return aggregated results
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
    console.log(`[Enrich API] Opportunity IDs:`, opportunityIds)
    
    const client = new KeapXmlRpcClient(accessToken.value)
    
    // Results maps
    const products: Record<string, any[]> = {}
    const stageMoves: Record<string, any[]> = {}
    
    // Process each opportunity ID sequentially to avoid rate limits
    // (Can parallelize later if needed)
    for (const oppId of opportunityIds) {
      const numericId = Number(oppId)
      console.log(`[Enrich API] Querying XML-RPC for Opportunity #${numericId}`)
      
      // Query ProductInterest for this opportunity
      try {
        const productResult = await client.query(
          'ProductInterest',
          100,
          0,
          { ObjectId: numericId },  // ObjectId links to Opportunity
          ['Id', 'ObjectId', 'ProductId', 'Qty', 'DiscountPercent']
        )
        const productList = Array.isArray(productResult) ? productResult : []
        if (productList.length > 0) {
          products[String(numericId)] = productList
          console.log(`[Enrich API] Opp #${numericId}: ${productList.length} products`)
        }
      } catch (err) {
        console.error(`[Enrich API] ProductInterest error for Opp #${numericId}:`, err)
      }
      
      // Query StageMove for this opportunity
      try {
        const stageMoveResult = await client.query(
          'StageMove',
          100,
          0,
          { OpportunityId: numericId },
          ['Id', 'OpportunityId', 'MoveDate', 'MoveToStage', 'MoveFromStage']
        )
        const stageMoveList = Array.isArray(stageMoveResult) ? stageMoveResult : []
        if (stageMoveList.length > 0) {
          stageMoves[String(numericId)] = stageMoveList
          console.log(`[Enrich API] Opp #${numericId}: ${stageMoveList.length} stage moves`)
        }
      } catch (err) {
        console.error(`[Enrich API] StageMove error for Opp #${numericId}:`, err)
      }
    }

    const productsCount = Object.keys(products).length
    const stageMovesCount = Object.keys(stageMoves).length
    
    console.log(`[Enrich API] Complete! Products for ${productsCount} opps, StageMoves for ${stageMovesCount} opps`)

    return NextResponse.json({ 
      products,
      stageMoves,
      summary: {
        requested: opportunityIds.length,
        withProducts: productsCount,
        withStageMoves: stageMovesCount
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
