import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapClient, KeapOpportunity } from "@/lib/keap-client"

// AI-powered analysis of opportunities to suggest pipeline structure
// Uses Vercel AI SDK with OpenAI

interface PipelineSuggestion {
  name: string
  stages: string[]
  description: string
  matchingOpportunities: string[] // IDs of opportunities that would fit
}

interface AnalysisResult {
  suggestedPipelines: PipelineSuggestion[]
  summary: string
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Get all opportunities
    const client = new KeapClient(accessToken.value)
    const oppResponse = await client.getOpportunities(1000)
    const opportunities = oppResponse.opportunities || []

    if (opportunities.length === 0) {
      return NextResponse.json({
        suggestedPipelines: [],
        summary: "No opportunities found to analyze."
      })
    }

    // Analyze opportunities and suggest pipelines
    const analysis = await analyzeOpportunities(opportunities)
    
    return NextResponse.json(analysis)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Analyze API] Error:", errorMessage)
    return NextResponse.json({ 
      error: "Failed to analyze opportunities",
      details: errorMessage 
    }, { status: 500 })
  }
}

async function analyzeOpportunities(opportunities: KeapOpportunity[]): Promise<AnalysisResult> {
  // Check for OpenAI API key
  const openaiKey = process.env.OPENAI_API_KEY
  
  if (!openaiKey) {
    // Fallback: Simple rule-based analysis without AI
    return simpleAnalysis(opportunities)
  }

  try {
    // Prepare opportunity data for AI analysis
    const oppSummary = opportunities.map(opp => ({
      id: opp.id,
      title: opp.opportunity_title,
      stage: opp.stage?.name || 'No Stage',
      contact: opp.contact ? `${opp.contact.first_name || ''} ${opp.contact.last_name || ''}`.trim() : 'No Contact',
      revenue: opp.projected_revenue_high || opp.projected_revenue_low || 0,
    }))

    // Use OpenAI to analyze and suggest pipelines
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert CRM consultant. Analyze the provided opportunities and suggest an optimal pipeline structure.
            
Return a JSON object with this exact structure:
{
  "suggestedPipelines": [
    {
      "name": "Pipeline Name",
      "stages": ["Stage 1", "Stage 2", "Stage 3", ...],
      "description": "Brief description of what this pipeline is for",
      "matchingOpportunities": ["id1", "id2", ...]
    }
  ],
  "summary": "Overall analysis summary"
}

Consider:
- Group similar opportunities into pipelines
- Suggest 2-5 stages per pipeline that represent a logical sales/service process
- Common pipeline types: Sales, Support, Projects, Partnerships
- Look for patterns in opportunity titles and stages`
          },
          {
            role: 'user',
            content: `Analyze these ${opportunities.length} opportunities and suggest pipeline structure:\n\n${JSON.stringify(oppSummary, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      console.error('[Analyze API] OpenAI error:', await response.text())
      return simpleAnalysis(opportunities)
    }

    const aiResponse = await response.json()
    const content = aiResponse.choices?.[0]?.message?.content

    if (!content) {
      return simpleAnalysis(opportunities)
    }

    // Parse AI response
    try {
      // Extract JSON from response (might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return parsed as AnalysisResult
      }
    } catch (parseError) {
      console.error('[Analyze API] Failed to parse AI response:', parseError)
    }

    return simpleAnalysis(opportunities)
  } catch (error) {
    console.error('[Analyze API] AI analysis failed:', error)
    return simpleAnalysis(opportunities)
  }
}

// Fallback: Simple rule-based analysis
function simpleAnalysis(opportunities: KeapOpportunity[]): AnalysisResult {
  // Group by existing stage names
  const stageGroups = new Map<string, KeapOpportunity[]>()
  
  opportunities.forEach(opp => {
    const stageName = opp.stage?.name || 'Uncategorized'
    if (!stageGroups.has(stageName)) {
      stageGroups.set(stageName, [])
    }
    stageGroups.get(stageName)!.push(opp)
  })

  const stages = Array.from(stageGroups.keys())
  
  // Create a single pipeline suggestion with discovered stages
  const suggestedPipelines: PipelineSuggestion[] = [{
    name: "Main Sales Pipeline",
    stages: stages.length > 0 ? stages : ["Lead", "Qualified", "Proposal", "Negotiation", "Closed Won", "Closed Lost"],
    description: `Pipeline created from ${opportunities.length} opportunities with ${stages.length} unique stages`,
    matchingOpportunities: opportunities.map(o => o.id)
  }]

  return {
    suggestedPipelines,
    summary: `Found ${opportunities.length} opportunities across ${stages.length} stages. Suggested consolidating into a main sales pipeline.`
  }
}
