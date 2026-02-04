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

    console.log(`[Enrich API] Enriching ${opportunityIds.length} opportunities`)
    
    const client = new KeapXmlRpcClient(accessToken.value)
    
    // Step 1: Fetch ALL stages to build ID -> Name lookup
    console.log(`[Enrich API] Fetching Stage lookup table...`)
    const stageMap = new Map<number, string>()
    try {
      const stagesResult = await client.query(
        'Stage',
        1000,
        0,
        { Id: '~>~0' },  // All stages
        ['Id', 'StageName']
      )
      const stages = Array.isArray(stagesResult) ? stagesResult : []
      for (const stage of stages) {
        if (stage.Id && stage.StageName) {
          stageMap.set(stage.Id, stage.StageName)
        }
      }
      console.log(`[Enrich API] Loaded ${stageMap.size} stages`)
    } catch (err) {
      console.error(`[Enrich API] Stage lookup failed:`, err)
    }
    
    // Step 2: Fetch ALL products to build ID -> Details lookup
    console.log(`[Enrich API] Fetching Product lookup table...`)
    const productMap = new Map<number, { name: string; price: number }>()
    try {
      const productsResult = await client.query(
        'Product',
        1000,
        0,
        { Id: '~>~0' },  // All products
        ['Id', 'ProductName', 'ProductPrice']
      )
      const productsList = Array.isArray(productsResult) ? productsResult : []
      for (const product of productsList) {
        if (product.Id) {
          productMap.set(product.Id, {
            name: product.ProductName || 'Unknown',
            price: product.ProductPrice || 0
          })
        }
      }
      console.log(`[Enrich API] Loaded ${productMap.size} products`)
    } catch (err) {
      console.error(`[Enrich API] Product lookup failed:`, err)
    }
    
    // Step 2b: Fetch ALL subscription plans to build ID -> Details lookup
    console.log(`[Enrich API] Fetching SubscriptionPlan lookup table...`)
    const subscriptionPlanMap = new Map<number, { 
      productId: number
      planPrice: number
      cycle: string
      frequency: number
      numberOfCycles: number
      active: boolean
    }>()
    try {
      const subscriptionResult = await client.query(
        'SubscriptionPlan',
        1000,
        0,
        { Id: '~>~0' },  // All subscription plans
        ['Id', 'ProductId', 'PlanPrice', 'Cycle', 'Frequency', 'NumberOfCycles', 'Active']
      )
      const subscriptionList = Array.isArray(subscriptionResult) ? subscriptionResult : []
      for (const sub of subscriptionList) {
        if (sub.Id) {
          subscriptionPlanMap.set(sub.Id, {
            productId: sub.ProductId || 0,
            planPrice: sub.PlanPrice || 0,
            cycle: sub.Cycle || '',
            frequency: sub.Frequency || 1,
            numberOfCycles: sub.NumberOfCycles || 0,
            active: sub.Active || false
          })
        }
      }
      console.log(`[Enrich API] Loaded ${subscriptionPlanMap.size} subscription plans`)
    } catch (err) {
      console.error(`[Enrich API] SubscriptionPlan lookup failed:`, err)
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
    
    // Step 3: Process each opportunity ID
    for (const oppId of opportunityIds) {
      const numericId = Number(oppId)
      
      // Query Lead table to get OrderRevenue for this opportunity
      let orderRevenue = 0
      try {
        const leadResult = await client.query(
          'Lead',
          1,
          0,
          { Id: numericId },
          ['Id', 'OrderRevenue']
        )
        const leadList = Array.isArray(leadResult) ? leadResult : []
        if (leadList.length > 0 && leadList[0].OrderRevenue) {
          orderRevenue = Number(leadList[0].OrderRevenue) || 0
          orderRevenueData[String(numericId)] = orderRevenue
          console.log(`[Enrich API] Opp #${numericId}: OrderRevenue = $${orderRevenue}`)
        }
      } catch (err) {
        console.error(`[Enrich API] Lead/OrderRevenue error for Opp #${numericId}:`, err)
      }
      
      // Query ProductInterest for this opportunity (include SubscriptionPlanId)
      try {
        const productResult = await client.query(
          'ProductInterest',
          100,
          0,
          { ObjectId: numericId },
          ['Id', 'ObjectId', 'ProductId', 'Qty', 'DiscountPercent', 'SubscriptionPlanId']
        )
        const productList = Array.isArray(productResult) ? productResult : []
        if (productList.length > 0) {
          // Enrich with product/subscription details
          let enrichedProducts = productList.map(pi => {
            let productDetails = productMap.get(pi.ProductId)
            let subscriptionInfo: any = null
            
            // If ProductId is 0 but SubscriptionPlanId exists, look up subscription
            if ((!pi.ProductId || pi.ProductId === 0) && pi.SubscriptionPlanId) {
              const subPlan = subscriptionPlanMap.get(pi.SubscriptionPlanId)
              if (subPlan) {
                // Get product name from subscription's ProductId
                const subProductDetails = productMap.get(subPlan.productId)
                productDetails = subProductDetails || { name: `Subscription Plan #${pi.SubscriptionPlanId}`, price: subPlan.planPrice }
                
                // Build subscription info
                subscriptionInfo = {
                  subscriptionPlanId: pi.SubscriptionPlanId,
                  planPrice: subPlan.planPrice,
                  cycle: subPlan.cycle,
                  frequency: subPlan.frequency,
                  numberOfCycles: subPlan.numberOfCycles,
                  active: subPlan.active,
                  isSubscription: true
                }
                
                console.log(`[Enrich API] Opp #${numericId}: Found subscription plan ${pi.SubscriptionPlanId} → Product "${productDetails?.name}" @ $${subPlan.planPrice}/${subPlan.cycle}`)
              }
            }
            
            return {
              ...pi,
              // Flat fields for backward compatibility
              ProductName: productDetails?.name || 'Unknown',
              ProductPrice: subscriptionInfo?.planPrice || productDetails?.price || 0,
              // Subscription info if applicable
              subscription: subscriptionInfo,
              // Nested product object for UI
              product: productDetails ? {
                Id: pi.ProductId || subscriptionInfo?.subscriptionPlanId,
                ProductName: productDetails.name,
                ProductPrice: subscriptionInfo?.planPrice || productDetails.price
              } : null
            }
          })
          
          // Calculate prices based on OrderRevenue if available and > 0
          // NOTE: OrderRevenue includes BOTH one-time and subscription revenue
          // We should only use it to allocate one-time product prices
          if (orderRevenue > 0) {
            // Get known ONE-TIME products (exclude "Unknown" and subscriptions from calculation)
            const oneTimeProducts = enrichedProducts.filter(p => 
              p.ProductName !== 'Unknown' && !p.subscription?.isSubscription
            )
            
            // Sum non-$0 one-time products (exclude Unknown and subscriptions)
            const nonZeroSum = oneTimeProducts
              .filter(p => p.ProductPrice > 0)
              .reduce((sum, p) => sum + (p.ProductPrice * (p.Qty || 1)), 0)
            
            // Find $0 one-time products (NOT Unknown, NOT subscriptions)
            const zeroProducts = oneTimeProducts.filter(p => p.ProductPrice === 0)
            const zeroCount = zeroProducts.length
            
            // Calculate remainder to distribute among one-time products
            const remainder = orderRevenue - nonZeroSum
            
            console.log(`[Enrich API] Opp #${numericId}: OrderRevenue=$${orderRevenue}, OneTimeSum=$${nonZeroSum}, Remainder=$${remainder}, ZeroOneTimeProducts=${zeroCount}`)
            
            if (remainder > 0 && zeroCount > 0) {
              const distributedPrice = remainder / zeroCount
              
              // Update $0 one-time products with calculated price (NOT Unknown, NOT subscriptions)
              enrichedProducts = enrichedProducts.map(p => {
                if (p.ProductPrice === 0 && p.ProductName !== 'Unknown' && !p.subscription?.isSubscription) {
                  return {
                    ...p,
                    ProductPrice: distributedPrice,
                    CalculatedPrice: distributedPrice,  // Flag as calculated
                    OriginalPrice: 0,  // Keep original for reference
                    product: p.product ? {
                      ...p.product,
                      ProductPrice: distributedPrice,
                      CalculatedPrice: distributedPrice,
                      OriginalPrice: 0
                    } : null
                  }
                }
                return p
              })
              
              console.log(`[Enrich API] Opp #${numericId}: Distributed $${distributedPrice.toFixed(2)} to ${zeroCount} zero-price one-time products`)
            }
          }
          
          products[String(numericId)] = enrichedProducts
          console.log(`[Enrich API] Opp #${numericId}: ${productList.length} products`)
        }
      } catch (err) {
        console.error(`[Enrich API] ProductInterest error for Opp #${numericId}:`, err)
      }
      
      // Query StageMove for this opportunity
      try {
        const stageMoveResult = await client.query(
          'StageMove',
          100,
          0,
          { OpportunityId: numericId },
          ['Id', 'OpportunityId', 'MoveDate', 'MoveToStage', 'MoveFromStage']
        )
        const stageMoveList = Array.isArray(stageMoveResult) ? stageMoveResult : []
        if (stageMoveList.length > 0) {
          // Enrich with stage names
          const enrichedMoves = stageMoveList.map(sm => ({
            ...sm,
            MoveToStageName: stageMap.get(sm.MoveToStage) || `Stage #${sm.MoveToStage}`,
            MoveFromStageName: sm.MoveFromStage ? (stageMap.get(sm.MoveFromStage) || `Stage #${sm.MoveFromStage}`) : null
          }))
          
          // Analyze stage moves - find lastUpdated (MAX date) and outcome date
          const sortedByDate = [...enrichedMoves].sort((a, b) => {
            const dateA = a.MoveDate || ''
            const dateB = b.MoveDate || ''
            return dateB.localeCompare(dateA)  // Descending
          })
          
          const lastUpdated = sortedByDate[0]?.MoveDate || null
          
          // Find WON or LOST outcome
          let outcomeDate: string | null = null
          let outcome: 'WON' | 'LOST' | null = null
          
          for (const move of sortedByDate) {
            const stageName = (move.MoveToStageName || '').toUpperCase()
            if (stageName.includes('WON') || stageName.includes('WIN') || stageName.includes('CLOSED WON')) {
              outcomeDate = move.MoveDate
              outcome = 'WON'
              break
            }
            if (stageName.includes('LOST') || stageName.includes('CLOSED LOST')) {
              outcomeDate = move.MoveDate
              outcome = 'LOST'
              break
            }
          }
          
          stageMoveData[String(numericId)] = {
            moves: enrichedMoves,
            lastUpdated,
            outcomeDate,
            outcome
          }
          console.log(`[Enrich API] Opp #${numericId}: ${stageMoveList.length} stage moves, outcome: ${outcome || 'none'}`)
        }
      } catch (err) {
        console.error(`[Enrich API] StageMove error for Opp #${numericId}:`, err)
      }
    }

    const productsCount = Object.keys(products).length
    const stageMovesCount = Object.keys(stageMoveData).length
    const orderRevenueCount = Object.keys(orderRevenueData).length
    
    console.log(`[Enrich API] Complete! Products for ${productsCount} opps, StageMoves for ${stageMovesCount} opps, OrderRevenue for ${orderRevenueCount} opps`)

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
