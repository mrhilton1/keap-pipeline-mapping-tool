import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapXmlRpcClient } from "@/lib/keap-xmlrpc"

/**
 * Test XML-RPC connectivity by querying a simple table
 * This verifies that:
 * 1. OAuth token works with XML-RPC API
 * 2. DataService.query is functional
 * 3. Table/field names are correct
 */
export async function GET() {
  const startTime = Date.now()
  
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken?.value) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated",
        duration: Date.now() - startTime
      }, { status: 401 })
    }

    const client = new KeapXmlRpcClient(accessToken.value)
    
    // Test 1: Try to query ProductInterest table (should work even if empty)
    let productsTest = { success: false, error: "", count: 0 }
    try {
      const products = await client.query(
        'ProductInterest',
        5,
        0,
        {}, // No filter - just get any records
        ['Id', 'ObjectId', 'ProductId']
      )
      productsTest = { success: true, error: "", count: Array.isArray(products) ? products.length : 0 }
    } catch (err) {
      productsTest = { success: false, error: err instanceof Error ? err.message : String(err), count: 0 }
    }

    // Test 2: Try to query StageMove table
    let stageMoveTest = { success: false, error: "", count: 0 }
    try {
      const stageMoves = await client.query(
        'StageMove',
        5,
        0,
        {},
        ['Id', 'OpportunityId', 'MoveDate']  // Only fields that exist
      )
      stageMoveTest = { success: true, error: "", count: Array.isArray(stageMoves) ? stageMoves.length : 0 }
    } catch (err) {
      stageMoveTest = { success: false, error: err instanceof Error ? err.message : String(err), count: 0 }
    }

    const duration = Date.now() - startTime
    // BOTH tests must pass for overall success
    const overallSuccess = productsTest.success && stageMoveTest.success

    console.log(`[XML-RPC Test] Products: ${productsTest.success ? '✓' : '✗'}, StageMoves: ${stageMoveTest.success ? '✓' : '✗'}, Duration: ${duration}ms`)

    return NextResponse.json({
      success: overallSuccess,
      duration,
      tests: {
        productInterest: productsTest,
        stageMove: stageMoveTest
      },
      message: overallSuccess 
        ? `XML-RPC working (${productsTest.count + stageMoveTest.count} records found)`
        : "XML-RPC connection failed"
    })
  } catch (error) {
    console.error("[XML-RPC Test] Error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}
