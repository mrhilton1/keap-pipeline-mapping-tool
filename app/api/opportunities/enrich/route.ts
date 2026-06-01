import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapXmlRpcClient } from "@/lib/keap-xmlrpc"

/**
 * Enrich opportunities with XML-RPC data
 * 
 * Flow:
 * 1. Receive array of opportunity IDs from frontend
 * 2. First, fetch ALL stages to build ID -> Name lookup
 * 3. For EACH opportunity ID, query XML-RPC:
 *    - ProductInterest (by ObjectId = opportunityId)
 *    - StageMove (by OpportunityId = opportunityId) + resolve stage names
 * 4. For products, also fetch Product details (name, price)
 * 5. Return aggregated results
 * 
 * POST body: { opportunityIds: number[] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { opportunityIds } = body

    if (!Array.isArray(opportunityIds) || opportunityIds.length === 0) {
      return NextResponse.json({ 
        error: "Invalid request",
        details: "Provide opportunityIds array"
      }, { status: 400 })
    }

    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken?.value) {
      return NextResponse.json({ 
        error: "Not authenticated",
        products: {},
        stageMoves: {}
      }, { status: 401 })
    }

    
    const client = new KeapXmlRpcClient(accessToken.value)

    // Fetch all reference data in parallel
    const [stagesResult, productsResult, subscriptionResult] = await Promise.allSettled([
      client.query('Stage', 1000, 0, { Id: '~>~0' }, ['Id', 'StageName']),
      client.query('Product', 1000, 0, { Id: '~>~0' }, ['Id', 'ProductName', 'ProductPrice']),
      client.query('SubscriptionPlan', 1000, 0, { Id: '~>~0' }, ['Id', 'ProductId', 'PlanPrice', 'Cycle', 'Frequency', 'NumberOfCycles', 'Active']),
    ])

    const stageMap = new Map<number, string>()
    if (stagesResult.status === 'fulfilled') {
      const stages = Array.isArray(stagesResult.value) ? stagesResult.value : []
      for (const stage of stages) {
        if (stage.Id && stage.StageName) stageMap.set(stage.Id, stage.StageName)
      }
    } else {
      console.error(`[Enrich API] Stage lookup failed:`, stagesResult.reason)
    }

    const productMap = new Map<number, { name: string; price: number }>()
    if (productsResult.status === 'fulfilled') {
      const productsList = Array.isArray(productsResult.value) ? productsResult.value : []
      for (const product of productsList) {
        if (product.Id) productMap.set(product.Id, { name: product.ProductName || 'Unknown', price: product.ProductPrice || 0 })
      }
    } else {
      console.error(`[Enrich API] Product lookup failed:`, productsResult.reason)
    }

    const subscriptionPlanMap = new Map<number, { productId: number; planPrice: number; cycle: string; frequency: number; numberOfCycles: number; active: boolean }>()
    if (subscriptionResult.status === 'fulfilled') {
      const subscriptionList = Array.isArray(subscriptionResult.value) ? subscriptionResult.value : []
      for (const sub of subscriptionList) {
        if (sub.Id) subscriptionPlanMap.set(sub.Id, { productId: sub.ProductId || 0, planPrice: sub.PlanPrice || 0, cycle: sub.Cycle || '', frequency: sub.Frequency || 1, numberOfCycles: sub.NumberOfCycles || 0, active: sub.Active || false })
      }
    } else {
      console.error(`[Enrich API] SubscriptionPlan lookup failed:`, subscriptionResult.reason)
    }

    // Results maps - keyed by opportunity ID
    const products: Record<string, any[]> = {}
    const stageMoveData: Record<string, {
      moves: any[]
      lastUpdated: string | null
      outcomeDate: string | null
      outcome: 'WON' | 'LOST' | null
    }> = {}
    const orderRevenueData: Record<string, number> = {}

    // Process all opportunities in parallel
    await Promise.all(opportunityIds.map(async (oppId) => {
      const numericId = Number(oppId)

      const [leadRes, productRes, stageMoveRes] = await Promise.allSettled([
        client.query('Lead', 1, 0, { Id: numericId }, ['Id', 'OrderRevenue']),
        client.query('ProductInterest', 100, 0, { ObjectId: numericId }, ['Id', 'ObjectId', 'ProductId', 'Qty', 'DiscountPercent', 'SubscriptionPlanId']),
        client.query('StageMove', 100, 0, { OpportunityId: numericId }, ['Id', 'OpportunityId', 'MoveDate', 'MoveToStage', 'MoveFromStage']),
      ])

      // Lead / OrderRevenue
      let orderRevenue = 0
      if (leadRes.status === 'fulfilled') {
        const leadList = Array.isArray(leadRes.value) ? leadRes.value : []
        if (leadList.length > 0 && leadList[0].OrderRevenue) {
          orderRevenue = Number(leadList[0].OrderRevenue) || 0
          orderRevenueData[String(numericId)] = orderRevenue
        }
      } else {
        console.error(`[Enrich API] Lead/OrderRevenue error for Opp #${numericId}:`, leadRes.reason)
      }

      // ProductInterest
      if (productRes.status === 'fulfilled') {
        const productList = Array.isArray(productRes.value) ? productRes.value : []
        if (productList.length > 0) {
          let enrichedProducts = productList.map(pi => {
            let productDetails = productMap.get(pi.ProductId)
            let subscriptionInfo: any = null
            if ((!pi.ProductId || pi.ProductId === 0) && pi.SubscriptionPlanId) {
              const subPlan = subscriptionPlanMap.get(pi.SubscriptionPlanId)
              if (subPlan) {
                const subProductDetails = productMap.get(subPlan.productId)
                productDetails = subProductDetails || { name: `Subscription Plan #${pi.SubscriptionPlanId}`, price: subPlan.planPrice }
                subscriptionInfo = { subscriptionPlanId: pi.SubscriptionPlanId, planPrice: subPlan.planPrice, cycle: subPlan.cycle, frequency: subPlan.frequency, numberOfCycles: subPlan.numberOfCycles, active: subPlan.active, isSubscription: true }
              }
            }
            return {
              ...pi,
              ProductName: productDetails?.name || 'Unknown',
              ProductPrice: subscriptionInfo?.planPrice || productDetails?.price || 0,
              subscription: subscriptionInfo,
              product: productDetails ? { Id: pi.ProductId || subscriptionInfo?.subscriptionPlanId, ProductName: productDetails.name, ProductPrice: subscriptionInfo?.planPrice || productDetails.price } : null
            }
          })

          if (orderRevenue > 0) {
            const oneTimeProducts = enrichedProducts.filter(p => p.ProductName !== 'Unknown' && !p.subscription?.isSubscription)
            const nonZeroSum = oneTimeProducts.filter(p => p.ProductPrice > 0).reduce((sum, p) => sum + (p.ProductPrice * (p.Qty || 1)), 0)
            const zeroProducts = oneTimeProducts.filter(p => p.ProductPrice === 0)
            const remainder = orderRevenue - nonZeroSum
            if (remainder > 0 && zeroProducts.length > 0) {
              const distributedPrice = remainder / zeroProducts.length
              enrichedProducts = enrichedProducts.map(p => {
                if (p.ProductPrice === 0 && p.ProductName !== 'Unknown' && !p.subscription?.isSubscription) {
                  return { ...p, ProductPrice: distributedPrice, CalculatedPrice: distributedPrice, OriginalPrice: 0, product: p.product ? { ...p.product, ProductPrice: distributedPrice, CalculatedPrice: distributedPrice, OriginalPrice: 0 } : null }
                }
                return p
              })
            }
          }

          products[String(numericId)] = enrichedProducts
        }
      } else {
        console.error(`[Enrich API] ProductInterest error for Opp #${numericId}:`, productRes.reason)
      }

      // StageMove
      if (stageMoveRes.status === 'fulfilled') {
        const stageMoveList = Array.isArray(stageMoveRes.value) ? stageMoveRes.value : []
        if (stageMoveList.length > 0) {
          const enrichedMoves = stageMoveList.map(sm => ({
            ...sm,
            MoveToStageName: stageMap.get(sm.MoveToStage) || `Stage #${sm.MoveToStage}`,
            MoveFromStageName: sm.MoveFromStage ? (stageMap.get(sm.MoveFromStage) || `Stage #${sm.MoveFromStage}`) : null
          }))
          const sortedByDate = [...enrichedMoves].sort((a, b) => (b.MoveDate || '').localeCompare(a.MoveDate || ''))
          const lastUpdated = sortedByDate[0]?.MoveDate || null
          let outcomeDate: string | null = null
          let outcome: 'WON' | 'LOST' | null = null
          for (const move of sortedByDate) {
            const stageName = (move.MoveToStageName || '').toUpperCase()
            if (stageName.includes('WON') || stageName.includes('WIN') || stageName.includes('CLOSED WON')) { outcomeDate = move.MoveDate; outcome = 'WON'; break }
            if (stageName.includes('LOST') || stageName.includes('CLOSED LOST')) { outcomeDate = move.MoveDate; outcome = 'LOST'; break }
          }
          stageMoveData[String(numericId)] = { moves: enrichedMoves, lastUpdated, outcomeDate, outcome }
        }
      } else {
        console.error(`[Enrich API] StageMove error for Opp #${numericId}:`, stageMoveRes.reason)
      }
    }))

    const productsCount = Object.keys(products).length
    const stageMovesCount = Object.keys(stageMoveData).length
    const orderRevenueCount = Object.keys(orderRevenueData).length
    

    return NextResponse.json({ 
      products,
      stageMoves: stageMoveData,  // Now includes analysis (lastUpdated, outcomeDate, outcome)
      orderRevenue: orderRevenueData,  // OrderRevenue per opportunity for WON deals
      stages: Object.fromEntries(stageMap),
      summary: {
        requested: opportunityIds.length,
        withProducts: productsCount,
        withStageMoves: stageMovesCount,
        withOrderRevenue: orderRevenueCount,
        totalStages: stageMap.size,
        totalProducts: productMap.size
      }
    })
  } catch (error) {
    console.error("[Enrich API] Error:", error)
    return NextResponse.json({ 
      error: "Failed to enrich opportunities",
      details: error instanceof Error ? error.message : "Unknown error",
      products: {},
      stageMoves: {}
    }, { status: 500 })
  }
}
