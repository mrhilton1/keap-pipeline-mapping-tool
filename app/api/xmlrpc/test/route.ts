import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapXmlRpcClient } from "@/lib/keap-xmlrpc"

/**
 * Test XML-RPC connectivity and discover available fields
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

    // Test 1: ProductInterest - try to get ALL records (just IDs first)
    console.log('[XML-RPC Test] Testing ProductInterest table...')
    try {
      // Try with OpportunityId first
      const productInterests = await client.query(
        'ProductInterest',
        5,
        0,
        {},
        ['Id', 'ProductId', 'OpportunityId']
      )
      results.productInterest = {
        success: true,
        error: "",
        count: Array.isArray(productInterests) ? productInterests.length : 0,
        sample: Array.isArray(productInterests) ? productInterests[0] : productInterests
      }
    } catch (err: any) {
      // Try with ObjectId fallback
      if (err.message?.includes('OpportunityId')) {
        try {
          const productInterests = await client.query(
            'ProductInterest',
            5,
            0,
            {},
            ['Id', 'ProductId', 'ObjectId']
          )
          results.productInterest = {
            success: true,
            error: "Note: Using ObjectId instead of OpportunityId",
            count: Array.isArray(productInterests) ? productInterests.length : 0,
            sample: Array.isArray(productInterests) ? productInterests[0] : productInterests
          }
        } catch (err2: any) {
          results.productInterest = { success: false, error: err2.message || String(err2), count: 0 }
        }
      } else {
        results.productInterest = { success: false, error: err.message || String(err), count: 0 }
      }
    }

    // Test 2: StageMove - try with Stage field first
    console.log('[XML-RPC Test] Testing StageMove table...')
    try {
      const stageMoves = await client.query(
        'StageMove',
        5,
        0,
        {},
        ['Id', 'OpportunityId', 'MoveDate', 'Stage']
      )
      results.stageMove = {
        success: true,
        error: "",
        count: Array.isArray(stageMoves) ? stageMoves.length : 0,
        sample: Array.isArray(stageMoves) ? stageMoves[0] : stageMoves
      }
    } catch (err: any) {
      // Try without Stage field
      if (err.message?.includes('Stage')) {
        try {
          const stageMoves = await client.query(
            'StageMove',
            5,
            0,
            {},
            ['Id', 'OpportunityId', 'MoveDate']
          )
          results.stageMove = {
            success: true,
            error: "Note: Stage field not available",
            count: Array.isArray(stageMoves) ? stageMoves.length : 0,
            sample: Array.isArray(stageMoves) ? stageMoves[0] : stageMoves
          }
        } catch (err2: any) {
          results.stageMove = { success: false, error: err2.message || String(err2), count: 0 }
        }
      } else {
        results.stageMove = { success: false, error: err.message || String(err), count: 0 }
      }
    }

    // Test 3: Product table
    console.log('[XML-RPC Test] Testing Product table...')
    try {
      const products = await client.query(
        'Product',
        5,
        0,
        {},
        ['Id', 'ProductName', 'ProductPrice']
      )
      results.product = {
        success: true,
        error: "",
        count: Array.isArray(products) ? products.length : 0,
        sample: Array.isArray(products) ? products[0] : products
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
          sample: results.productInterest.sample
        },
        { 
          test: "StageMove Table", 
          success: results.stageMove.success, 
          error: results.stageMove.error, 
          count: results.stageMove.count,
          sample: results.stageMove.sample
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
