import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  const results: {
    cookies: { 
      hasAccessToken: boolean
      hasRefreshToken: boolean
      allCookieNames: string[]
      tokenLength?: number
    }
    opportunities: { success: boolean; count?: number; error?: string; raw?: string }
    legacyStages: { success: boolean; count?: number; error?: string; raw?: string }
    pipelinesV2: { success: boolean; count?: number; error?: string; raw?: string }
  } = {
    cookies: { hasAccessToken: false, hasRefreshToken: false, allCookieNames: [] },
    opportunities: { success: false },
    legacyStages: { success: false },
    pipelinesV2: { success: false }
  }

  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")
    const refreshToken = cookieStore.get("keap_refresh_token")
    const allCookies = cookieStore.getAll()

    console.log("[Test API] ========== START ==========")

    results.cookies.hasAccessToken = !!accessToken?.value
    results.cookies.hasRefreshToken = !!refreshToken?.value
    results.cookies.allCookieNames = allCookies.map(c => c.name)
    results.cookies.tokenLength = accessToken?.value?.length

    if (!accessToken?.value) {
      return NextResponse.json({
        ...results,
        error: "No access token - please authenticate first"
      })
    }

    // Test 1: Opportunities API (v1)
    console.log("[Test API] Testing Opportunities API...")
    try {
      const oppResponse = await fetch("https://api.infusionsoft.com/crm/rest/v1/opportunities?limit=5", {
        headers: { Authorization: `Bearer ${accessToken.value}` }
      })
      const oppText = await oppResponse.text()
      
      if (oppResponse.ok) {
        const oppData = JSON.parse(oppText)
        results.opportunities = {
          success: true,
          count: oppData.opportunities?.length || 0,
          raw: oppText.substring(0, 500)
        }
      } else {
        results.opportunities = {
          success: false,
          error: `${oppResponse.status}: ${oppText.substring(0, 200)}`
        }
      }
    } catch (err) {
      results.opportunities = {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error"
      }
    }

    // Test 2: Legacy Opportunity Stages (v1) - NOT actual pipelines!
    console.log("[Test API] Testing Legacy Stages API (v1)...")
    try {
      const stagesResponse = await fetch("https://api.infusionsoft.com/crm/rest/v1/opportunity/stage_pipeline", {
        headers: { Authorization: `Bearer ${accessToken.value}` }
      })
      const stagesText = await stagesResponse.text()
      
      if (stagesResponse.ok) {
        const stagesData = JSON.parse(stagesText)
        results.legacyStages = {
          success: true,
          count: Array.isArray(stagesData) ? stagesData.length : 0,
          raw: stagesText.substring(0, 400)
        }
      } else {
        results.legacyStages = {
          success: false,
          error: `${stagesResponse.status}: ${stagesText.substring(0, 200)}`
        }
      }
    } catch (err) {
      results.legacyStages = {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error"
      }
    }

    // Test 3: NEW Pipelines API (v2) - This is what we need for actual pipelines
    console.log("[Test API] Testing Pipelines v2 API...")
    try {
      const pipeResponse = await fetch("https://slaapi.keapapis.com/v2/pipelines?page_size=10", {
        headers: { Authorization: `Bearer ${accessToken.value}` }
      })
      const pipeText = await pipeResponse.text()
      
      console.log("[Test API] v2 Pipelines status:", pipeResponse.status)
      console.log("[Test API] v2 Pipelines response:", pipeText.substring(0, 200))
      
      if (pipeResponse.ok) {
        const pipeData = JSON.parse(pipeText)
        results.pipelinesV2 = {
          success: true,
          count: pipeData.pipelines?.length || 0,
          raw: pipeText.substring(0, 1000)
        }
      } else {
        // Show full error for debugging
        results.pipelinesV2 = {
          success: false,
          error: `${pipeResponse.status}: ${pipeText}`,
          raw: pipeText
        }
      }
    } catch (err) {
      results.pipelinesV2 = {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error"
      }
    }

    console.log("[Test API] ========== END ==========")
    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json({
      ...results,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
