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

    console.log("[Pipelines API] Fetching pipelines from new v2 API...")
    const client = new KeapClient(accessToken.value)
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

    console.log("[Pipelines API] Success, count:", pipelinesWithStages.length)
    return NextResponse.json({ pipelines: pipelinesWithStages })
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
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { name, stages } = body

    if (!name || !stages || !Array.isArray(stages)) {
      return NextResponse.json({ 
        error: "Invalid request body",
        details: "Required: { name: string, stages: string[] }"
      }, { status: 400 })
    }

    console.log(`[Pipelines API] Creating pipeline: ${name} with ${stages.length} stages`)
    const client = new KeapClient(accessToken.value)
    const pipeline = await client.createPipeline({ name, stages })

    console.log("[Pipelines API] Pipeline created:", pipeline.id)
    return NextResponse.json(pipeline)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Pipelines API] Error creating pipeline:", errorMessage)
    return NextResponse.json({ 
      error: "Failed to create pipeline",
      details: errorMessage 
    }, { status: 500 })
  }
}
