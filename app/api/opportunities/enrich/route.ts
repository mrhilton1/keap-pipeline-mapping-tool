import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapXmlRpcClient } from "@/lib/keap-xmlrpc"

/**
 * Enrich opportunities with XML-RPC data
 * 
 * Flow:
 * 1. Receive array of opportunity IDs from frontend
 * 2. First, fetch ALL stages to build ID -> Name lookup
 * 3. For EACH opportunity ID, query XML-RPC:
 *    - ProductInterest (by ObjectId = opportunityId)
 *    - StageMove (by OpportunityId = opportunityId) + resolve stage names
 * 4. For products, also fetch Product details (name, price)
 * 5. Return aggregated results
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
    
    // Step 1: Fetch ALL stages to build ID -> Name lookup
    console.log(`[Enrich API] Fetching Stage lookup table...`)
    const stageMap = new Map<number, string>()
    try {
      const stagesResult = await client.query(
        'Stage',
        1000,
        0,
        { Id: '~>~0' },  // All stages
        ['Id', 'StageName']
      )
      const stages = Array.isArray(stagesResult) ? stagesResult : []
      for (const stage of stages) {
        if (stage.Id && stage.StageName) {
          stageMap.set(stage.Id, stage.StageName)
        }
      }
      console.log(`[Enrich API] Loaded ${stageMap.size} stages`)
    } catch (err) {
      console.error(`[Enrich API] Stage lookup failed:`, err)
    }
    
    // Step 2: Fetch ALL products to build ID -> Details lookup
    console.log(`[Enrich API] Fetching Product lookup table...`)
    const productMap = new Map<number, { name: string; price: number }>()
    try {
      const productsResult = await client.query(
        'Product',
        1000,
        0,
        { Id: '~>~0' },  // All products
        ['Id', 'ProductName', 'ProductPrice']
      )
      const productsList = Array.isArray(productsResult) ? productsResult : []
      for (const product of productsList) {
        if (product.Id) {
          productMap.set(product.Id, {
            name: product.ProductName || 'Unknown',
            price: product.ProductPrice || 0
          })
        }
      }
      console.log(`[Enrich API] Loaded ${productMap.size} products`)
    } catch (err) {
      console.error(`[Enrich API] Product lookup failed:`, err)
    }
    
    // Results maps
    const products: Record<string, any[]> = {}
    const stageMoves: Record<string, any[]> = {}
    
    // Step 3: Process each opportunity ID
    for (const oppId of opportunityIds) {
      const numericId = Number(oppId)
      
      // Query ProductInterest for this opportunity
      try {
        const productResult = await client.query(
          'ProductInterest',
          100,
          0,
          { ObjectId: numericId },
          ['Id', 'ObjectId', 'ProductId', 'Qty', 'DiscountPercent']
        )
        const productList = Array.isArray(productResult) ? productResult : []
        if (productList.length > 0) {
          // Enrich with product names and prices
          const enrichedProducts = productList.map(pi => ({
            ...pi,
            ProductName: productMap.get(pi.ProductId)?.name || 'Unknown',
            ProductPrice: productMap.get(pi.ProductId)?.price || 0
          }))
          products[String(numericId)] = enrichedProducts
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
          // Enrich with stage names
          const enrichedMoves = stageMoveList.map(sm => ({
            ...sm,
            MoveToStageName: stageMap.get(sm.MoveToStage) || `Stage #${sm.MoveToStage}`,
            MoveFromStageName: sm.MoveFromStage ? (stageMap.get(sm.MoveFromStage) || `Stage #${sm.MoveFromStage}`) : null
          }))
          stageMoves[String(numericId)] = enrichedMoves
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
      stages: Object.fromEntries(stageMap),  // Include stage lookup for reference
      summary: {
        requested: opportunityIds.length,
        withProducts: productsCount,
        withStageMoves: stageMovesCount,
        totalStages: stageMap.size,
        totalProducts: productMap.size
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
