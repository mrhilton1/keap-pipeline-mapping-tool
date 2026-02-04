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

// Product from XML-RPC Lead (ProductInterest) table
export interface OpportunityProduct {
  Id: number
  OpportunityId: number
  ProductId: number
  Qty: number
  Price: number
  Discount?: number
  Notes?: string
  product?: {
    Id: number
    ProductName: string
    ProductPrice: number
    ProductDesc?: string
    Sku?: string
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
  stageMoves?: Array<{
    Id: number
    OpportunityId: number
    MoveDate: string
    StageId: number
    PrevStageId?: number
    UserId?: number
  }>
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

  // Get unique stages for filter
  const stages = Array.from(new Set(opportunities.map(o => o.stage?.name).filter(Boolean)))

  // Filter opportunities
  const filtered = opportunities.filter(opp => {
    const matchesSearch = searchTerm === "" || 
      opp.opportunity_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
                                {opp.products.map((pi, idx) => (
                                  <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-blue-800">
                                        {pi.product?.ProductName || `Product #${pi.ProductId}`}
                                      </span>
                                      {pi.Qty > 1 && (
                                        <Badge variant="outline" className="text-[10px] bg-blue-100">
                                          x{pi.Qty}
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-blue-600 font-medium">
                                      ${pi.Price?.toLocaleString() || '0'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Stage Moves (from XML-RPC StageMove table) */}
                          {opp.stageMoves && opp.stageMoves.length > 0 && (
                            <div className="mt-2 p-2 rounded border bg-purple-50 border-purple-200">
                              <div className="flex items-center gap-2 text-xs text-purple-700">
                                <Trophy className="w-3 h-3" />
                                <span className="font-medium">
                                  {opp.stageMoves.length} stage move(s)
                                </span>
                              </div>
                              <div className="mt-1 space-y-0.5">
                                {opp.stageMoves.slice(-3).map((move, idx) => (
                                  <div key={idx} className="text-[10px] text-purple-600">
                                    Stage #{move.StageId} on {new Date(move.MoveDate).toLocaleDateString()}
                                  </div>
                                ))}
                                {opp.stageMoves.length > 3 && (
                                  <div className="text-[10px] text-purple-500 italic">
                                    +{opp.stageMoves.length - 3} more...
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
