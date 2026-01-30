"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DollarSign, User, Search } from "lucide-react"

export interface Opportunity {
  id: string
  opportunity_title: string
  contact?: {
    id?: string
    first_name?: string
    last_name?: string
    email?: string
  }
  projected_revenue_high?: number
  projected_revenue_low?: number
  stage?: {
    id: string
    name: string
  }
  last_updated?: string
}

interface OpportunitiesPanelProps {
  opportunities: Opportunity[]
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
  loading?: boolean
}

export function OpportunitiesPanel({ 
  opportunities, 
  selectedIds, 
  onSelectionChange,
  loading 
}: OpportunitiesPanelProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [stageFilter, setStageFilter] = useState<string | null>(null)

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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(new Set(filtered.map(o => o.id)))
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
          />
          <span className="text-sm text-muted-foreground">
            {allSelected ? 'Deselect all' : 'Select all'} ({filtered.length})
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
              const revenue = formatRevenue(opp)
              const contact = formatContact(opp)
              
              return (
                <Card 
                  key={opp.id} 
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleSelectOne(opp.id, !isSelected)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectOne(opp.id, checked as boolean)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-sm truncate">
                            {opp.opportunity_title}
                          </h4>
                          {opp.stage && (
                            <Badge variant="secondary" className="flex-shrink-0 text-xs">
                              {opp.stage.name}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {contact && (
                            <span className="flex items-center gap-1 truncate">
                              <User className="w-3 h-3" />
                              {contact}
                            </span>
                          )}
                          {revenue && (
                            <span className="flex items-center gap-1 flex-shrink-0">
                              <DollarSign className="w-3 h-3" />
                              {revenue}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
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
