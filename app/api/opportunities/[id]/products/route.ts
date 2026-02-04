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
        products: []
      }, { status: 401 })
    }

    const client = new KeapXmlRpcClient(accessToken.value)
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
