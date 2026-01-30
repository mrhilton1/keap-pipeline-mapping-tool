"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, DollarSign, CheckCircle2, Rocket } from "lucide-react"
import { Label } from "@/components/ui/label"
import { CreatePipelineDialog } from "./create-pipeline-dialog"
import { CreateFieldDialog } from "./create-field-dialog"
import { MigrationPreviewDialog } from "./migration-preview-dialog"
import { AIAnalysisDialog } from "./ai-analysis-dialog"
import { useToast } from "@/hooks/use-toast"

interface Opportunity {
  id: string
  opportunity_title: string
  contact?: {
    first_name?: string
    last_name?: string
  }
  projected_revenue_high?: number
  projected_revenue_low?: number
  stage?: {
    name: string
    id: string
  }
  last_updated?: string
}

interface Pipeline {
  id: string
  name: string
  stages?: Array<{
    id: string
    name: string
    order: number
  }>
  active?: boolean
}

interface OpportunityMapping {
  opportunityId: string
  pipelineId: string
  stageId?: string
}

export function OpportunityMapper() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [mappings, setMappings] = useState<Map<string, OpportunityMapping>>(new Map())
  const [selectedOpportunities, setSelectedOpportunities] = useState<Set<string>>(new Set())
  const [bulkPipeline, setBulkPipeline] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrationResult, setMigrationResult] = useState<any>(null)
  const { toast } = useToast()

  const refreshData = async () => {
    try {
      const [oppResponse, pipelineResponse] = await Promise.all([
        fetch("/api/opportunities"), 
        fetch("/api/pipelines")
      ])

      const oppData = await oppResponse.json()
      const pipelineData = await pipelineResponse.json()

      // Check for errors with detailed messages
      if (!oppResponse.ok) {
        throw new Error(`Opportunities: ${oppData.details || oppData.error || 'Failed to fetch'}`)
      }
      if (!pipelineResponse.ok) {
        throw new Error(`Pipelines: ${pipelineData.details || pipelineData.error || 'Failed to fetch'}`)
      }

      setOpportunities(oppData.opportunities || [])
      setPipelines(pipelineData.pipelines || [])
      setError(null)
    } catch (err) {
      console.error("Data fetch error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      await refreshData()
      setLoading(false)
    }

    fetchData()
  }, [])

  const handleMappingChange = (opportunityId: string, pipelineId: string) => {
    const newMappings = new Map(mappings)
    newMappings.set(opportunityId, { opportunityId, pipelineId })
    setMappings(newMappings)
  }

  const handleStageChange = (opportunityId: string, stageId: string) => {
    const newMappings = new Map(mappings)
    const existing = newMappings.get(opportunityId)
    if (existing) {
      newMappings.set(opportunityId, { ...existing, stageId })
      setMappings(newMappings)
    }
  }

  const handleSelectOpportunity = (opportunityId: string, checked: boolean) => {
    const newSelected = new Set(selectedOpportunities)
    if (checked) {
      newSelected.add(opportunityId)
    } else {
      newSelected.delete(opportunityId)
    }
    setSelectedOpportunities(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOpportunities(new Set(opportunities.map((o) => o.id)))
    } else {
      setSelectedOpportunities(new Set())
    }
  }

  const handleBulkAssign = () => {
    if (!bulkPipeline) return

    const newMappings = new Map(mappings)
    selectedOpportunities.forEach((oppId) => {
      newMappings.set(oppId, { opportunityId: oppId, pipelineId: bulkPipeline })
    })
    setMappings(newMappings)
    setSelectedOpportunities(new Set())
    setBulkPipeline("")
  }

  const handleMigrate = async () => {
    setMigrating(true)
    setMigrationResult(null)

    try {
      const response = await fetch("/api/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappings: Array.from(mappings.values()),
        }),
      })

      if (!response.ok) {
        throw new Error("Migration failed")
      }

      const result = await response.json()
      setMigrationResult(result)

      if (result.failed === 0) {
        toast({
          title: "Migration Complete",
          description: `Successfully migrated ${result.successful} opportunities`,
        })
      } else {
        toast({
          title: "Migration Partially Complete",
          description: `${result.successful} succeeded, ${result.failed} failed`,
          variant: "destructive",
        })
      }

      // Refresh data after migration
      await refreshData()
      setMappings(new Map())
    } catch (error) {
      toast({
        title: "Migration Failed",
        description: "An error occurred during migration. Please try again.",
        variant: "destructive",
      })
    } finally {
      setMigrating(false)
    }
  }

  const handleAIRecommendations = (recommendations: any[], mappings: any[]) => {
    // Apply AI-suggested mappings
    const newMappings = new Map(mappings)

    recommendations.forEach((suggestion) => {
      // Find matching pipeline by name
      const matchingPipeline = pipelines.find(
        (p) => p.name.toLowerCase() === suggestion.suggestedPipeline.toLowerCase(),
      )

      if (matchingPipeline) {
        const mapping: OpportunityMapping = {
          opportunityId: suggestion.opportunityId,
          pipelineId: matchingPipeline.id,
        }

        // Try to match stage if suggested
        if (suggestion.suggestedStage && matchingPipeline.stages) {
          const matchingStage = matchingPipeline.stages.find(
            (s) => s.name.toLowerCase() === suggestion.suggestedStage.toLowerCase(),
          )
          if (matchingStage) {
            mapping.stageId = matchingStage.id
          }
        }

        newMappings.set(suggestion.opportunityId, mapping)
      }
    })

    setMappings(newMappings)

    toast({
      title: "AI Recommendations Applied",
      description: `Applied ${newMappings.size} mapping suggestions`,
    })
  }

  const getMappedCount = () => mappings.size
  const getSelectedPipeline = (opportunityId: string) => {
    const mapping = mappings.get(opportunityId)
    return mapping?.pipelineId
  }
  const getSelectedStage = (opportunityId: string) => {
    const mapping = mappings.get(opportunityId)
    return mapping?.stageId
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Management</CardTitle>
          <CardDescription>Create new pipelines and custom fields for your opportunities</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <CreatePipelineDialog onSuccess={refreshData} />
          <CreateFieldDialog onSuccess={refreshData} />
          <AIAnalysisDialog onApplyRecommendations={handleAIRecommendations} />
        </CardContent>
      </Card>

      {/* Bulk Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Actions</CardTitle>
          <CardDescription>Assign multiple opportunities to the same pipeline at once</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={selectedOpportunities.size === opportunities.length && opportunities.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <Label htmlFor="select-all" className="cursor-pointer">
              Select All ({selectedOpportunities.size} selected)
            </Label>
          </div>

          {selectedOpportunities.size > 0 && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label htmlFor="bulk-pipeline">Assign to Pipeline</Label>
                <Select value={bulkPipeline} onValueChange={setBulkPipeline}>
                  <SelectTrigger id="bulk-pipeline">
                    <SelectValue placeholder="Select pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleBulkAssign} disabled={!bulkPipeline}>
                Assign {selectedOpportunities.size} Opportunities
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mapping Progress</CardTitle>
              <CardDescription>
                {getMappedCount()} of {opportunities.length} opportunities mapped
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getMappedCount() === opportunities.length && opportunities.length > 0 && (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              )}
              {getMappedCount() > 0 && (
                <Button onClick={() => setShowPreview(true)} className="gap-2">
                  <Rocket className="w-4 h-4" />
                  Execute Migration
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Individual Mappings */}
      <div className="space-y-4">
        {opportunities.map((opp) => {
          const selectedPipelineId = getSelectedPipeline(opp.id)
          const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId)
          const selectedStageId = getSelectedStage(opp.id)
          const isMapped = !!selectedPipelineId

          return (
            <Card key={opp.id} className={isMapped ? "border-green-500" : ""}>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedOpportunities.has(opp.id)}
                    onCheckedChange={(checked) => handleSelectOpportunity(opp.id, checked as boolean)}
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <CardTitle className="text-lg">{opp.opportunity_title}</CardTitle>
                        <CardDescription>
                          {opp.contact?.first_name || opp.contact?.last_name
                            ? `${opp.contact.first_name || ""} ${opp.contact.last_name || ""}`.trim()
                            : "No contact"}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {opp.stage && <Badge variant="secondary">{opp.stage.name}</Badge>}
                        {isMapped && <Badge className="bg-green-500">Mapped</Badge>}
                      </div>
                    </div>

                    {(opp.projected_revenue_high || opp.projected_revenue_low) && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
                        <DollarSign className="w-4 h-4" />
                        <span>
                          {opp.projected_revenue_low && opp.projected_revenue_high
                            ? `$${opp.projected_revenue_low.toLocaleString()} - $${opp.projected_revenue_high.toLocaleString()}`
                            : opp.projected_revenue_high
                              ? `$${opp.projected_revenue_high.toLocaleString()}`
                              : `$${opp.projected_revenue_low?.toLocaleString()}`}
                        </span>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`pipeline-${opp.id}`}>Map to Pipeline</Label>
                        <Select
                          value={selectedPipelineId || ""}
                          onValueChange={(value) => handleMappingChange(opp.id, value)}
                        >
                          <SelectTrigger id={`pipeline-${opp.id}`}>
                            <SelectValue placeholder="Select pipeline" />
                          </SelectTrigger>
                          <SelectContent>
                            {pipelines.map((pipeline) => (
                              <SelectItem key={pipeline.id} value={pipeline.id}>
                                {pipeline.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedPipeline?.stages && selectedPipeline.stages.length > 0 && (
                        <div>
                          <Label htmlFor={`stage-${opp.id}`}>Starting Stage (Optional)</Label>
                          <Select
                            value={selectedStageId || ""}
                            onValueChange={(value) => handleStageChange(opp.id, value)}
                          >
                            <SelectTrigger id={`stage-${opp.id}`}>
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedPipeline.stages
                                .sort((a, b) => a.order - b.order)
                                .map((stage) => (
                                  <SelectItem key={stage.id} value={stage.id}>
                                    {stage.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )
        })}
      </div>

      <MigrationPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        mappings={mappings}
        opportunities={opportunities}
        pipelines={pipelines}
        onConfirm={handleMigrate}
        loading={migrating}
        result={migrationResult}
      />
    </div>
  )
}
