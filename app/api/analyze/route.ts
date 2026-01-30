import { generateObject } from "ai"
import { z } from "zod"
import { cookies } from "next/headers"
import { KeapClient } from "@/lib/keap-client"

export const maxDuration = 60

const pipelineRecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      pipelineName: z.string().describe("Suggested name for the pipeline"),
      description: z.string().describe("Why this pipeline is recommended"),
      stages: z.array(
        z.object({
          name: z.string(),
          description: z.string().describe("What happens in this stage"),
          order: z.number(),
        }),
      ),
      opportunityPatterns: z.array(z.string()).describe("Patterns in opportunity titles that fit this pipeline"),
      estimatedCount: z.number().describe("How many opportunities would fit this pipeline"),
    }),
  ),
  mappingSuggestions: z.array(
    z.object({
      opportunityId: z.string(),
      opportunityTitle: z.string(),
      suggestedPipeline: z.string(),
      suggestedStage: z.string().optional(),
      confidence: z.enum(["high", "medium", "low"]),
      reasoning: z.string(),
    }),
  ),
  summary: z.string().describe("Overall summary of the analysis"),
})

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")?.value

    if (!accessToken) {
      return Response.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Fetch opportunities
    const keapClient = new KeapClient(accessToken)
    const opportunities = await keapClient.getOpportunities()

    if (!opportunities || opportunities.length === 0) {
      return Response.json(
        {
          error: "No opportunities found to analyze",
        },
        { status: 400 },
      )
    }

    // Prepare data for AI analysis
    const opportunityData = opportunities.map((opp) => ({
      id: opp.id,
      title: opp.opportunity_title,
      stage: opp.stage?.name,
      revenue: {
        low: opp.projected_revenue_low,
        high: opp.projected_revenue_high,
      },
      contact: opp.contact
        ? {
            name: `${opp.contact.first_name || ""} ${opp.contact.last_name || ""}`.trim(),
          }
        : null,
    }))

    // Generate AI recommendations
    const { object } = await generateObject({
      model: "openai/gpt-5",
      schema: pipelineRecommendationSchema,
      prompt: `Analyze these ${opportunities.length} sales opportunities and provide intelligent recommendations for organizing them into pipelines.

Opportunities data:
${JSON.stringify(opportunityData, null, 2)}

Based on the opportunity titles, current stages, and any patterns you detect:

1. Suggest 2-5 new pipelines that would effectively organize these opportunities
2. For each pipeline, recommend specific stages that reflect a typical sales journey
3. Identify which opportunities would fit into each pipeline
4. Provide individual mapping suggestions for each opportunity

Consider:
- Common patterns in opportunity titles (keywords, naming conventions, syntax)
- Current stage information that might indicate process type
- Revenue ranges that might suggest different sales processes
- Industry-specific sales cycles
- Logical progression from lead to close

Be specific and actionable in your recommendations.`,
    })

    return Response.json(object)
  } catch (error) {
    console.error("[v0] AI analysis error:", error)
    return Response.json({ error: error instanceof Error ? error.message : "Analysis failed" }, { status: 500 })
  }
}
