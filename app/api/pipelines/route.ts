import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapClient } from "@/lib/keap-client"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken) {
      console.error("[Pipelines API] No access token found")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const client = new KeapClient(accessToken.value)

    // Try v1 API first (more reliable)
    console.log("[Pipelines API] Trying v1 API (stage_pipeline)...")
    try {
      const v1Pipelines = await client.getV1Pipelines()
      console.log("[Pipelines API] v1 Success, count:", v1Pipelines?.length || 0)
      console.log("[Pipelines API] v1 Sample:", JSON.stringify(v1Pipelines?.[0] || {}).substring(0, 500))
      
      // Transform v1 response to match expected format
      // v1 format: { id, stage_pipeline_name, stages: { "stage_id": { id, stage_name, stage_order } } }
      const pipelines = (v1Pipelines || []).map((p: any) => {
        // Handle stages - could be object, array, or undefined
        let stagesArray: any[] = []
        if (p.stages) {
          if (Array.isArray(p.stages)) {
            stagesArray = p.stages
          } else if (typeof p.stages === 'object') {
            // Convert object to array
            stagesArray = Object.values(p.stages)
          }
        }
        
        return {
          id: String(p.id),
          name: p.stage_pipeline_name || p.name || `Pipeline ${p.id}`,
          stages: stagesArray.map((s: any, idx: number) => ({
            id: String(s.id || s.stage_id || idx),
            name: s.stage_name || s.name || `Stage ${idx + 1}`,
            order: s.stage_order ?? s.order ?? idx
          })).sort((a, b) => a.order - b.order)
        }
      })
      
      return NextResponse.json({ pipelines, api: "v1" })
    } catch (v1Error) {
      console.log("[Pipelines API] v1 failed, trying v2...", v1Error)
    }

    // Fall back to v2 API
    console.log("[Pipelines API] Trying v2 API...")
    try {
      const pipelinesResponse = await client.getPipelines()

      // Fetch stages for each pipeline
      const pipelinesWithStages = await Promise.all(
        pipelinesResponse.pipelines.map(async (pipeline) => {
          try {
            const stagesResponse = await client.getPipelineStages(pipeline.id)
            return {
              ...pipeline,
              stages: stagesResponse.stages || []
            }
          } catch (err) {
            console.error(`[Pipelines API] Failed to get stages for pipeline ${pipeline.id}:`, err)
            return { ...pipeline, stages: [] }
          }
        })
      )

      console.log("[Pipelines API] v2 Success, count:", pipelinesWithStages.length)
      return NextResponse.json({ pipelines: pipelinesWithStages, api: "v2" })
    } catch (v2Error) {
      const v2Message = v2Error instanceof Error ? v2Error.message : "Unknown error"
      console.error("[Pipelines API] v2 also failed:", v2Message)
      
      // Return empty pipelines with helpful message
      return NextResponse.json({ 
        pipelines: [],
        api: "none",
        warning: "Could not fetch pipelines from Keap. v2 API may require additional permissions in Keap Developer Portal.",
        v2Error: v2Message
      })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Pipelines API] Error:", errorMessage)
    return NextResponse.json({ 
      error: "Failed to fetch pipelines",
      details: errorMessage 
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")
    const refreshToken = cookieStore.get("keap_refresh_token")

    console.log("[Pipelines API POST] Access token present:", !!accessToken?.value)
    console.log("[Pipelines API POST] Refresh token present:", !!refreshToken?.value)
    console.log("[Pipelines API POST] All cookies:", cookieStore.getAll().map(c => c.name))

    if (!accessToken) {
      console.error("[Pipelines API POST] No access token found in cookies")
      return NextResponse.json({ error: "Not authenticated", details: "No access token cookie found. Please re-authenticate with Keap." }, { status: 401 })
    }

    const body = await request.json()
    const { name, stages } = body

    if (!name) {
      return NextResponse.json({ 
        error: "Invalid request body",
        details: "Required: { name: string, stages?: string[] }"
      }, { status: 400 })
    }

    console.log(`[Pipelines API] Creating pipeline: ${name}`)
    const client = new KeapClient(accessToken.value)
    
    // Step 1: Create the pipeline
    const pipeline = await client.createPipeline({ name })
    console.log("[Pipelines API] Pipeline created:", pipeline.id)

    // Step 2: If stages provided, bulk create them
    let createdStages: Array<{ id: string; name: string; order?: number }> = []
    if (stages && Array.isArray(stages) && stages.length > 0) {
      console.log(`[Pipelines API] Creating ${stages.length} stages for pipeline ${pipeline.id}`)
      const stagesResult = await client.bulkCreateStages(pipeline.id, stages)
      createdStages = stagesResult.stages || []
      console.log("[Pipelines API] Stages created:", createdStages.length)
    }

    return NextResponse.json({
      ...pipeline,
      stages: createdStages
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Pipelines API] Error creating pipeline:", errorMessage)
    return NextResponse.json({ 
      error: "Failed to create pipeline",
      details: errorMessage 
    }, { status: 500 })
  }
}
