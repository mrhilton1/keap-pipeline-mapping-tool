"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  DollarSign, 
  User, 
  Search, 
  ChevronDown, 
  ChevronRight,
  Calendar,
  Building,
  Mail,
  Phone,
  FileText,
  Clock,
  Package,
  Trophy
} from "lucide-react"

// Product from XML-RPC ProductInterest table
export interface OpportunityProduct {
  Id: number
  ObjectId: number  // Links to Opportunity
  ProductId: number
  Qty: number
  DiscountPercent?: number
  SubscriptionPlanId?: number
  // Flat fields from enrichment
  ProductName?: string
  ProductPrice?: number
  // Calculated price fields (when distributed from OrderRevenue)
  CalculatedPrice?: number
  OriginalPrice?: number
  // Subscription info (when ProductId is 0 and SubscriptionPlanId exists)
  subscription?: {
    subscriptionPlanId: number
    planPrice: number
    cycle: string  // "Week", "Month", "Year", "Day"
    frequency: number
    numberOfCycles: number
    active: boolean
    isSubscription: boolean
  }
  // Nested product object from enrichment
  product?: {
    Id: number
    ProductName: string
    ProductPrice: number
    CalculatedPrice?: number
    OriginalPrice?: number
  }
}

export interface Opportunity {
  id: string
  opportunity_title: string
  opportunity_notes?: string
  next_action_notes?: string
  contact?: {
    id?: string
    first_name?: string
    last_name?: string
    email?: string
    phone_number?: string
    company_name?: string
    job_title?: string
  }
  projected_revenue_high?: number
  projected_revenue_low?: number
  estimated_close_date?: string
  stage?: {
    id: string
    name: string
    details?: {
      probability?: number
      stage_order?: number
      target_num_days?: number
    }
  }
  user?: {
    id: number
    first_name?: string
    last_name?: string
  }
  next_action_date?: string
  date_created?: string
  last_updated?: string
  custom_fields?: Array<{
    id: number
    content: any
  }>
  // XML-RPC enrichment data
  products?: OpportunityProduct[]
  stageMoves?: {
    moves: Array<{
      Id: number
      OpportunityId: number
      MoveDate: string
      MoveToStage: number
      MoveFromStage?: number
      MoveToStageName?: string
      MoveFromStageName?: string
    }>
    lastUpdated: string | null
    outcomeDate: string | null
    outcome: 'WON' | 'LOST' | null
  } | null
  // OrderRevenue from Lead table - used for WON deals
  orderRevenue?: number
}

interface OpportunitiesPanelProps {
  opportunities: Opportunity[]
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
  migratedIds?: Set<string>
  loading?: boolean
}

export function OpportunitiesPanel({ 
  opportunities,
  migratedIds = new Set(), 
  selectedIds, 
  onSelectionChange,
  loading 
}: OpportunitiesPanelProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [stageFilter, setStageFilter] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Format XML-RPC date format (20231101T12:40:09) to readable format
  const formatStageMoveDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    try {
      // Handle ISO8601 format from XML-RPC (20231101T12:40:09)
      const match = dateStr.match(/(\d{4})(\d{2})(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
      if (match) {
        const [, year, month, day] = match
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }
      // Fallback to standard date parsing
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  // Get unique stages for filter
  const stages = Array.from(new Set(opportunities.map(o => o.stage?.name).filter(Boolean)))

  // Filter opportunities
  const filtered = opportunities.filter(opp => {
    const matchesSearch = searchTerm === "" || 
      (opp.opportunity_title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.contact?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.contact?.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStage = !stageFilter || opp.stage?.name === stageFilter
    
    return matchesSearch && matchesStage
  })

  // Filter out already migrated opportunities for selection
  const selectableFiltered = filtered.filter(o => !migratedIds.has(o.id))
  const migratedCount = filtered.filter(o => migratedIds.has(o.id)).length

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select non-migrated opportunities
      onSelectionChange(new Set(selectableFiltered.map(o => o.id)))
    } else {
      onSelectionChange(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedIds)
    if (checked) {
      newSelection.add(id)
    } else {
      newSelection.delete(id)
    }
    onSelectionChange(newSelection)
  }

  const allSelected = filtered.length > 0 && filtered.every(o => selectedIds.has(o.id))
  const someSelected = filtered.some(o => selectedIds.has(o.id)) && !allSelected

  const formatRevenue = (opp: Opportunity) => {
    const low = opp.projected_revenue_low
    const high = opp.projected_revenue_high
    if (high && low && high !== low) {
      return `$${low.toLocaleString()} - $${high.toLocaleString()}`
    }
    if (high) return `$${high.toLocaleString()}`
    if (low) return `$${low.toLocaleString()}`
    return null
  }

  const formatContact = (opp: Opportunity) => {
    if (!opp.contact) return null
    const name = `${opp.contact.first_name || ''} ${opp.contact.last_name || ''}`.trim()
    return name || opp.contact.email || null
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-3">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="space-y-3 mb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Opportunities</h3>
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} of {opportunities.length} selected
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search opportunities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stage filter */}
        {stages.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <Badge 
              variant={stageFilter === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setStageFilter(null)}
            >
              All ({opportunities.length})
            </Badge>
            {stages.map(stage => (
              <Badge 
                key={stage}
                variant={stageFilter === stage ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setStageFilter(stageFilter === stage ? null : stage!)}
              >
                {stage} ({opportunities.filter(o => o.stage?.name === stage).length})
              </Badge>
            ))}
          </div>
        )}

        {/* Select all */}
        <div className="flex items-center gap-2 py-2 border-b">
          <Checkbox
            checked={allSelected}
            // @ts-ignore - indeterminate is valid but not in types
            indeterminate={someSelected}
            onCheckedChange={handleSelectAll}
            disabled={selectableFiltered.length === 0}
          />
          <span className="text-sm text-muted-foreground">
            {allSelected ? 'Deselect all' : 'Select all'} ({selectableFiltered.length})
            {migratedCount > 0 && (
              <span className="text-green-600 ml-1">• {migratedCount} migrated</span>
            )}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto -mx-1 px-1">
        <div className="space-y-2 pb-4">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || stageFilter ? 'No matching opportunities' : 'No opportunities found'}
            </div>
          ) : (
            filtered.map(opp => {
              const isSelected = selectedIds.has(opp.id)
              const isMigrated = migratedIds.has(opp.id)
              const isExpanded = expandedIds.has(opp.id)
              const revenue = formatRevenue(opp)
              const contact = formatContact(opp)
              const estimatedClose = formatDate(opp.estimated_close_date)
              const lastUpdated = formatDate(opp.last_updated)
              
              return (
                <Card 
                  key={opp.id} 
                  className={`transition-colors ${
                    isMigrated 
                      ? 'border-green-500 bg-green-50/50 opacity-75' 
                      : isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/30'
                  }`}
                >
                  <CardContent className="p-0">
                    {/* Main row - always visible */}
                    <div 
                      className="flex items-start gap-3 p-3 cursor-pointer"
                      onClick={() => !isMigrated && handleSelectOne(opp.id, !isSelected)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => !isMigrated && handleSelectOne(opp.id, checked as boolean)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                        disabled={isMigrated}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={`font-medium text-sm ${isMigrated ? 'line-through text-muted-foreground' : ''}`}>
                            {opp.opportunity_title}
                          </h4>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isMigrated && (
                              <Badge 
                                variant="outline" 
                                className="text-xs bg-green-100 text-green-700 border-green-300"
                              >
                                ✓ Migrated
                              </Badge>
                            )}
                            {opp.stage && !isMigrated && (
                              <Badge 
                                variant="secondary" 
                                className="text-xs"
                              >
                                {opp.stage.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Quick info row */}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          {contact && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {contact}
                            </span>
                          )}
                          {opp.contact?.company_name && (
                            <span className="flex items-center gap-1">
                              <Building className="w-3 h-3" />
                              {opp.contact.company_name}
                            </span>
                          )}
                          {revenue && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {revenue}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Expand button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpanded(opp.id)
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    
                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 ml-8 border-t bg-muted/20">
                        <div className="pt-3 space-y-2 text-xs">
                          {/* Stage Details */}
                          {opp.stage?.details && (
                            <div className="flex items-center gap-4">
                              {opp.stage.details.probability !== undefined && (
                                <span className="text-muted-foreground">
                                  Win probability: <span className="text-foreground font-medium">{opp.stage.details.probability}%</span>
                                </span>
                              )}
                              {opp.stage.details.stage_order !== undefined && (
                                <span className="text-muted-foreground">
                                  Stage order: <span className="text-foreground font-medium">{opp.stage.details.stage_order}</span>
                                </span>
                              )}
                            </div>
                          )}
                          
                          {/* Contact Details */}
                          <div className="grid grid-cols-2 gap-2">
                            {opp.contact?.email && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Mail className="w-3 h-3" />
                                <a href={`mailto:${opp.contact.email}`} className="hover:text-primary truncate">
                                  {opp.contact.email}
                                </a>
                              </div>
                            )}
                            {opp.contact?.phone_number && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Phone className="w-3 h-3" />
                                <span>{opp.contact.phone_number}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Dates */}
                          <div className="flex items-center gap-4 text-muted-foreground">
                            {estimatedClose && (
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" />
                                Est. close: {estimatedClose}
                              </span>
                            )}
                            {lastUpdated && (
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                Updated: {lastUpdated}
                              </span>
                            )}
                          </div>
                          
                          {/* Notes */}
                          {opp.opportunity_notes && (
                            <div className="mt-2 p-2 bg-background rounded border">
                              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <FileText className="w-3 h-3" />
                                <span className="font-medium">Notes</span>
                              </div>
                              <p className="text-muted-foreground whitespace-pre-wrap line-clamp-3">
                                {opp.opportunity_notes}
                              </p>
                            </div>
                          )}
                          
                          {/* Products (from XML-RPC) */}
                          {opp.products && opp.products.length > 0 && (
                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                              <div className="flex items-center gap-1.5 text-blue-700 mb-2">
                                <Package className="w-3 h-3" />
                                <span className="font-medium">Products ({opp.products.length})</span>
                              </div>
                              <div className="space-y-1.5">
                                {opp.products.map((pi: any, idx) => {
                                  const isCalculated = pi.CalculatedPrice !== undefined
                                  const isUnknown = pi.ProductName === 'Unknown'
                                  const isSubscription = pi.subscription?.isSubscription === true
                                  const displayPrice = pi.ProductPrice || pi.product?.ProductPrice || 0
                                  
                                  // Format subscription billing cycle - handle both string and number cycle values
                                  // Cycle can be: "Week" (3), "Month" (2), "Year" (1), "Day" (6)
                                  const formatCycle = (cycle: any): string => {
                                    if (!cycle) return ''
                                    if (typeof cycle === 'string') return cycle.toLowerCase()
                                    // Handle numeric cycle values
                                    const cycleMap: Record<number, string> = { 1: 'year', 2: 'month', 3: 'week', 6: 'day' }
                                    return cycleMap[cycle] || String(cycle)
                                  }
                                  const billingCycle = isSubscription && pi.subscription?.cycle 
                                    ? `/${formatCycle(pi.subscription.cycle)}` 
                                    : ''
                                  
                                  return (
                                    <div key={idx} className={`flex items-center justify-between gap-2 text-xs ${isUnknown ? 'opacity-50' : ''}`}>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`font-medium ${isUnknown ? 'text-gray-500 italic' : isSubscription ? 'text-purple-800' : 'text-blue-800'}`}>
                                          {pi.ProductName || pi.product?.ProductName || `Product #${pi.ProductId}`}
                                        </span>
                                        {(pi.Qty || 0) > 1 && (
                                          <Badge variant="outline" className="text-[10px] bg-blue-100">
                                            x{pi.Qty}
                                          </Badge>
                                        )}
                                        {isSubscription && (
                                          <Badge className="text-[9px] h-3.5 bg-purple-500 text-white">
                                            subscription
                                          </Badge>
                                        )}
                                        {isCalculated && !isUnknown && (
                                          <Badge className="text-[9px] h-3.5 bg-green-500 text-white">
                                            calculated
                                          </Badge>
                                        )}
                                      </div>
                                      <span className={`font-medium whitespace-nowrap ${isCalculated && !isUnknown ? 'text-green-600' : isSubscription ? 'text-purple-600' : 'text-blue-600'}`}>
                                        ${(displayPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{billingCycle}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Order Revenue (from XML-RPC Lead table) */}
                          {opp.orderRevenue && opp.orderRevenue > 0 && (
                            <div className="mt-2 p-2 rounded border bg-emerald-50 border-emerald-200">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 text-emerald-700">
                                  <DollarSign className="w-3 h-3" />
                                  <span className="font-medium">Order Revenue</span>
                                  {opp.stageMoves?.outcome === 'WON' && (
                                    <Badge className="text-[9px] h-3.5 bg-emerald-500 text-white ml-1">
                                      used for deal value
                                    </Badge>
                                  )}
                                </div>
                                <span className="font-bold text-emerald-600">
                                  ${opp.orderRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Stage Moves (from XML-RPC StageMove table) */}
                          {opp.stageMoves && opp.stageMoves.moves?.length > 0 && (
                            <div className="mt-2 p-2 rounded border bg-purple-50 border-purple-200">
                              <div className="flex items-center gap-2 text-xs text-purple-700">
                                <Trophy className="w-3 h-3" />
                                <span className="font-medium">
                                  {opp.stageMoves.moves.length} stage move(s)
                                </span>
                                {opp.stageMoves.outcome && (
                                  <Badge 
                                    className={`text-[10px] h-4 ${opp.stageMoves.outcome === 'WON' ? 'bg-green-500' : 'bg-red-500'}`}
                                  >
                                    {opp.stageMoves.outcome}
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Analysis summary */}
                              <div className="mt-1.5 grid grid-cols-2 gap-2 text-[10px]">
                                {opp.stageMoves.lastUpdated && (
                                  <div className="text-purple-600">
                                    <span className="text-purple-500">Last Activity:</span>{' '}
                                    {formatStageMoveDate(opp.stageMoves.lastUpdated)}
                                  </div>
                                )}
                                {opp.stageMoves.outcomeDate && opp.stageMoves.outcome && (
                                  <div className={opp.stageMoves.outcome === 'WON' ? 'text-green-600' : 'text-red-600'}>
                                    <span className="opacity-70">{opp.stageMoves.outcome}:</span>{' '}
                                    {formatStageMoveDate(opp.stageMoves.outcomeDate)}
                                  </div>
                                )}
                              </div>
                              
                              {/* Stage move history */}
                              <div className="mt-2 space-y-1 border-t border-purple-200 pt-2">
                                {opp.stageMoves.moves.slice(0, 5).map((move: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between text-[10px]">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-purple-400">{formatStageMoveDate(move.MoveDate)}</span>
                                      <span className="text-purple-600">→</span>
                                      <span className="font-medium text-purple-800">{move.MoveToStageName}</span>
                                    </div>
                                    {move.MoveFromStageName && move.MoveFromStageName !== move.MoveToStageName && (
                                      <span className="text-purple-400 text-[9px]">
                                        from {move.MoveFromStageName}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {opp.stageMoves.moves.length > 5 && (
                                  <div className="text-[10px] text-purple-400">
                                    +{opp.stageMoves.moves.length - 5} more...
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Custom Fields */}
                          {opp.custom_fields && opp.custom_fields.length > 0 && (
                            <div className="mt-2 p-2 bg-background rounded border">
                              <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                                <span className="font-medium">Custom Fields</span>
                              </div>
                              <div className="space-y-1">
                                {opp.custom_fields.map((field, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] font-mono">
                                      #{field.id}
                                    </Badge>
                                    <span className="text-muted-foreground">
                                      {typeof field.content === 'object' 
                                        ? JSON.stringify(field.content)
                                        : String(field.content || '-')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Assigned User */}
                          {opp.user && (
                            <div className="text-muted-foreground">
                              Assigned to: <span className="text-foreground">{opp.user.first_name} {opp.user.last_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
