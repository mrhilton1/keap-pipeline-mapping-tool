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
    pipelines: { success: boolean; count?: number; error?: string; raw?: string }
  } = {
    cookies: { hasAccessToken: false, hasRefreshToken: false, allCookieNames: [] },
    opportunities: { success: false },
    pipelines: { success: false }
  }

  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")
    const refreshToken = cookieStore.get("keap_refresh_token")
    const allCookies = cookieStore.getAll()

    // Log everything for debugging
    console.log("[Test API] ========== COOKIE DEBUG ==========")
    console.log("[Test API] All cookie names:", allCookies.map(c => c.name))
    console.log("[Test API] All cookies count:", allCookies.length)
    console.log("[Test API] Access token cookie exists:", !!accessToken)
    console.log("[Test API] Access token value exists:", !!accessToken?.value)
    console.log("[Test API] Access token length:", accessToken?.value?.length || 0)
    console.log("[Test API] Refresh token exists:", !!refreshToken?.value)
    console.log("[Test API] ========== END DEBUG ==========")

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

    // Test Opportunities API (v1)
    console.log("[Test API] Testing v1 Opportunities API...")
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

    // Test Pipelines API - try v1 first (more likely to work), then v2
    console.log("[Test API] Testing v1 Pipelines API (stage_pipeline)...")
    let v1PipelinesWorked = false
    try {
      const v1PipeResponse = await fetch("https://api.infusionsoft.com/crm/rest/v1/opportunity/stage_pipeline", {
        headers: { Authorization: `Bearer ${accessToken.value}` }
      })
      const v1PipeText = await v1PipeResponse.text()
      
      if (v1PipeResponse.ok) {
        v1PipelinesWorked = true
        results.pipelines = {
          success: true,
          count: JSON.parse(v1PipeText)?.length || 0,
          raw: `[v1 API] ${v1PipeText.substring(0, 400)}`
        }
      }
    } catch (err) {
      console.log("[Test API] v1 pipelines failed:", err)
    }

    // Only try v2 if v1 didn't work
    if (!v1PipelinesWorked) {
      console.log("[Test API] Testing v2 Pipelines API...")
      try {
        const pipeResponse = await fetch("https://slaapi.keapapis.com/v2/pipelines?page_size=5", {
          headers: { Authorization: `Bearer ${accessToken.value}` }
        })
        const pipeText = await pipeResponse.text()
        
        if (pipeResponse.ok) {
          const pipeData = JSON.parse(pipeText)
          results.pipelines = {
            success: true,
            count: pipeData.pipelines?.length || 0,
            raw: `[v2 API] ${pipeText.substring(0, 400)}`
          }
        } else {
          results.pipelines = {
            success: false,
            error: `v2: ${pipeResponse.status} (v1 also failed). v2 may need additional Keap app permissions.`
          }
        }
      } catch (err) {
        results.pipelines = {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error"
        }
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json({
      ...results,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
