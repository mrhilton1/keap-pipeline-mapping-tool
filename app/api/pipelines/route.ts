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

    // Try v2 API FIRST - this returns the REAL pipelines
    try {
      const pipelinesResponse = await client.getPipelines()

      // Fetch stages for each pipeline
      const pipelinesWithStages = await Promise.all(
        (pipelinesResponse.pipelines || []).map(async (pipeline) => {
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

      return NextResponse.json({ pipelines: pipelinesWithStages, api: "v2" })
    } catch (v2Error) {
      const v2Message = v2Error instanceof Error ? v2Error.message : "Unknown error"
    }

    // Fall back to v1 API (legacy stages) if v2 fails
    try {
      const v1Pipelines = await client.getV1Pipelines()
      
      // Transform v1 response - these are legacy stages, not real pipelines
      const pipelines = (v1Pipelines || []).map((p: any) => {
        let stagesArray: any[] = []
        if (p.stages) {
          if (Array.isArray(p.stages)) {
            stagesArray = p.stages
          } else if (typeof p.stages === 'object') {
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
      
      return NextResponse.json({ pipelines, api: "v1 (legacy)" })
    } catch (v1Error) {
      const v1Message = v1Error instanceof Error ? v1Error.message : "Unknown error"
      console.error("[Pipelines API] v1 also failed:", v1Message)
      
      return NextResponse.json({ 
        pipelines: [],
        api: "none",
        warning: "Could not fetch pipelines from either v1 or v2 API"
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

    if (!accessToken) {
      console.error("[Pipelines API POST] No access token found")
      return NextResponse.json({ 
        error: "Not authenticated", 
        details: "Please re-authenticate with Keap." 
      }, { status: 401 })
    }

    const body = await request.json()
    const { name, stages } = body

    if (!name) {
      return NextResponse.json({ 
        error: "Invalid request body",
        details: "Required: { name: string, stages?: string[] }"
      }, { status: 400 })
    }

    const client = new KeapClient(accessToken.value)
    
    // v2 API creates pipeline and stages in one call
    // stages must be array of strings (stage names)
    const stageNames = stages && Array.isArray(stages) && stages.length > 0
      ? stages
      : ["Stage 1"]  // Default if none provided
    
    const pipeline = await client.createPipeline({ 
      name, 
      stages: stageNames 
    })

    return NextResponse.json({
      ...pipeline,
      stages: stageNames.map((name, i) => ({ name, order: i + 1 }))
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
