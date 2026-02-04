import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapXmlRpcClient } from "@/lib/keap-xmlrpc"

/**
 * Test XML-RPC connectivity with CORRECT field names from Keap schema:
 * 
 * ProductInterest: Id, ObjectId (=OpportunityId), ProductId, Qty, DiscountPercent
 * StageMove: Id, OpportunityId, MoveDate, MoveToStage, MoveFromStage
 * Product: Id, ProductName, ProductPrice
 */
export async function GET() {
  const startTime = Date.now()
  
  const results: {
    hasAccessToken: boolean
    productInterest: { success: boolean; error: string; count: number; sample?: any }
    stageMove: { success: boolean; error: string; count: number; sample?: any }
    product: { success: boolean; error: string; count: number; sample?: any }
  } = {
    hasAccessToken: false,
    productInterest: { success: false, error: "", count: 0 },
    stageMove: { success: false, error: "", count: 0 },
    product: { success: false, error: "", count: 0 }
  }

  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")?.value

    results.hasAccessToken = !!accessToken

    if (!accessToken) {
      return NextResponse.json({
        ...results,
        error: "No access token - please authenticate first"
      }, { status: 401 })
    }

    const client = new KeapXmlRpcClient(accessToken)

    // Test 1: ProductInterest - use findByField with known Opportunity ID 2
    // ObjectId links to Opportunity Id
    console.log('[XML-RPC Test] Testing ProductInterest.findByField(ObjectId=2)...')
    try {
      const result = await client.findByField(
        'ProductInterest',
        100,
        0,
        'ObjectId',  // Field to search
        2,           // Known Opportunity ID
        ['Id', 'ObjectId', 'ProductId', 'Qty', 'DiscountPercent']
      )
      const productInterests = Array.isArray(result) ? result : []
      results.productInterest = {
        success: true,
        error: productInterests.length === 0 ? "No products for Opp #2" : "",
        count: productInterests.length,
        sample: productInterests[0] || null
      }
    } catch (err: any) {
      results.productInterest = { success: false, error: err.message || String(err), count: 0 }
    }

    // Test 2: StageMove - use findByField with known Opportunity ID 2
    console.log('[XML-RPC Test] Testing StageMove.findByField(OpportunityId=2)...')
    try {
      const result = await client.findByField(
        'StageMove',
        100,
        0,
        'OpportunityId',  // Field to search
        2,                // Known Opportunity ID
        ['Id', 'OpportunityId', 'MoveDate', 'MoveToStage', 'MoveFromStage']
      )
      const stageMoves = Array.isArray(result) ? result : []
      results.stageMove = {
        success: true,
        error: stageMoves.length === 0 ? "No stage moves for Opp #2" : "",
        count: stageMoves.length,
        sample: stageMoves[0] || null
      }
    } catch (err: any) {
      results.stageMove = { success: false, error: err.message || String(err), count: 0 }
    }

    // Test 3: Product table - get any products
    console.log('[XML-RPC Test] Testing Product table...')
    try {
      const result = await client.query(
        'Product',
        5,
        0,
        { Id: '~>~0' },
        ['Id', 'ProductName', 'ProductPrice', 'Sku', 'Status']
      )
      const products = Array.isArray(result) ? result : []
      results.product = {
        success: true,
        error: products.length === 0 ? "No products found" : "",
        count: products.length,
        sample: products[0] || null
      }
    } catch (err: any) {
      results.product = { success: false, error: err.message || String(err), count: 0 }
    }

    const duration = Date.now() - startTime
    // BOTH ProductInterest and StageMove must pass for overall success
    const overallSuccess = results.productInterest.success && results.stageMove.success

    console.log(`[XML-RPC Test] ProductInterest: ${results.productInterest.success ? '✓' : '✗'}, StageMove: ${results.stageMove.success ? '✓' : '✗'}, Product: ${results.product.success ? '✓' : '✗'}, Duration: ${duration}ms`)

    return NextResponse.json({
      success: overallSuccess,
      tests: [
        { 
          test: "ProductInterest Table", 
          success: results.productInterest.success, 
          error: results.productInterest.error, 
          count: results.productInterest.count,
          sample: results.productInterest.sample,
          note: "ObjectId = Opportunity Id"
        },
        { 
          test: "StageMove Table", 
          success: results.stageMove.success, 
          error: results.stageMove.error, 
          count: results.stageMove.count,
          sample: results.stageMove.sample,
          note: "MoveToStage/MoveFromStage are Stage IDs"
        },
        { 
          test: "Product Table", 
          success: results.product.success, 
          error: results.product.error, 
          count: results.product.count,
          sample: results.product.sample
        }
      ],
      duration: `${duration}ms`,
      message: overallSuccess 
        ? `XML-RPC working (${results.productInterest.count + results.stageMove.count + results.product.count} records found)`
        : "Some tables failed to query"
    })
  } catch (error: any) {
    console.error("[XML-RPC Test API] Error:", error)
    return NextResponse.json({
      success: false,
      ...results,
      error: error.message || "Unknown error"
    }, { status: 500 })
  }
}
