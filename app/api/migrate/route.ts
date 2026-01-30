import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { KeapClient } from "@/lib/keap-client"

interface MigrationRequest {
  mappings: Array<{
    opportunityId: string
    pipelineId: string
    stageId?: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body: MigrationRequest = await request.json()
    const { mappings } = body

    if (!mappings || mappings.length === 0) {
      return NextResponse.json({ error: "No mappings provided" }, { status: 400 })
    }

    const client = new KeapClient(accessToken.value)

    // Execute migrations
    const results = []
    const errors = []

    for (const mapping of mappings) {
      try {
        const updateData: any = {
          pipeline_id: mapping.pipelineId,
        }

        if (mapping.stageId) {
          updateData.stage_id = mapping.stageId
        }

        await client.updateOpportunity(mapping.opportunityId, updateData)
        results.push({ opportunityId: mapping.opportunityId, success: true })
      } catch (error) {
        console.error(`[v0] Failed to migrate opportunity ${mapping.opportunityId}:`, error)
        errors.push({
          opportunityId: mapping.opportunityId,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      total: mappings.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
    })
  } catch (error) {
    console.error("[v0] Error during migration:", error)
    return NextResponse.json({ error: "Migration failed" }, { status: 500 })
  }
}
