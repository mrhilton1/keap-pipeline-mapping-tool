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

    // Get XML-RPC credentials from env
    const apiKey = process.env.KEAP_XMLRPC_API_KEY
    const appName = process.env.KEAP_APP_NAME

    if (!apiKey || !appName) {
      return NextResponse.json({ 
        error: "XML-RPC not configured",
        details: "Set KEAP_XMLRPC_API_KEY and KEAP_APP_NAME in environment variables",
        products: [] // Return empty array instead of error for graceful degradation
      })
    }

    const client = new KeapXmlRpcClient(apiKey, appName)
    const products = await client.getOpportunityProducts(opportunityId)

    return NextResponse.json({ products })
  } catch (error) {
    console.error(`[Products API] Error fetching products for opportunity ${params.id}:`, error)
    return NextResponse.json({ 
      error: "Failed to fetch products",
      details: error instanceof Error ? error.message : "Unknown error",
      products: []
    })
  }
}
