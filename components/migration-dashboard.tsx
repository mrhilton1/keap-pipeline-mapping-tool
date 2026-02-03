"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  LogIn,
  ExternalLink
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { OpportunitiesPanel, Opportunity } from "./opportunities-panel"
import { PipelineBuilder, PipelineSuggestion } from "./pipeline-builder"
import { FieldMapper, FieldMappingConfig } from "./field-mapper"
import { StageOption } from "./stage-selector"
import { useToast } from "@/hooks/use-toast"

interface Pipeline {
  id: string
  name: string
  stages?: Array<{ id: string; name: string; order?: number }>
}

export function MigrationDashboard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedOpportunities, setSelectedOpportunities] = useState<Set<string>>(new Set())
  const [migratedOpportunities, setMigratedOpportunities] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<PipelineSuggestion[]>([])
  
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState(false)
  
  const [activeTab, setActiveTab] = useState("build")
  const [createdPipelines, setCreatedPipelines] = useState<Pipeline[]>([])
  
  // Field mapping config - persisted across tab switches
  const [fieldMappingConfig, setFieldMappingConfig] = useState<FieldMappingConfig | null>(null)
  
  // JSON data modal
  const [jsonModalOpen, setJsonModalOpen] = useState(false)
  const [jsonModalData, setJsonModalData] = useState<{
    title: string
    count: number
    total: number
    data: any[]
  } | null>(null)
  
  // Migration preview modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [migrationPreview, setMigrationPreview] = useState<{
    pipelineId: string
    pipelineName: string
    stageMappings: Array<{
      stageName: string
      stageId: string
      count: number
      isAutoMatched: boolean
    }>
    skippedOpps: Array<{ id: string; title: string; stageName: string | null }>
    totalToMigrate: number
    totalToSkip: number
  } | null>(null)
  
  // Available stages extracted from opportunities
  const [availableStages, setAvailableStages] = useState<StageOption[]>([])
  const [defaultPipelineCreated, setDefaultPipelineCreated] = useState(false)
  
  const { toast } = useToast()
  
  // Handle custom stage creation - add to available stages list
  const handleStageCreated = (stageName: string) => {
    // Check if stage already exists
    if (!availableStages.some(s => s.name.toLowerCase() === stageName.toLowerCase())) {
      setAvailableStages(prev => [
        { name: stageName, isCustom: true, count: 0 },
        ...prev
      ])
    }
  }
  
  // Extract unique stages from opportunities and create default pipeline
  const extractUniqueStages = (opps: Opportunity[]): StageOption[] => {
    const stageMap = new Map<string, { order: number; count: number }>()
    
    opps.forEach(opp => {
      if (opp.stage?.name) {
        const existing = stageMap.get(opp.stage.name)
        const order = opp.stage.details?.stage_order ?? 999
        if (existing) {
          existing.count++
          // Keep the lowest order
          if (order < existing.order) {
            existing.order = order
          }
        } else {
          stageMap.set(opp.stage.name, { order, count: 1 })
        }
      }
    })
    
    // Convert to array and sort by order, then alphabetically
    return Array.from(stageMap.entries())
      .map(([name, data]) => ({ name, order: data.order, count: data.count }))
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order
        return a.name.localeCompare(b.name)
      })
  }
  
  const openJsonModal = (type: "opportunities" | "pipelines") => {
    if (type === "opportunities") {
      setJsonModalData({
        title: "Opportunities",
        count: Math.min(opportunities.length, 20),
        total: opportunities.length,
        data: opportunities.slice(0, 20)
      })
    } else {
      setJsonModalData({
        title: "Pipelines",
        count: pipelines.length,
        total: pipelines.length,
        data: pipelines
      })
    }
    setJsonModalOpen(true)
  }
  
  // Handle authentication errors
  const handleAuthError = async () => {
    setAuthError(true)
    // Try to refresh the token
    setRefreshing(true)
    try {
      const response = await fetch("/api/auth/keap/refresh", { method: "POST" })
      if (response.ok) {
        setAuthError(false)
        toast({
          title: "Session Refreshed",
          description: "Your Keap session has been renewed. Please try again.",
        })
        await loadData()
      } else {
        toast({
          title: "Session Expired",
          description: "Please sign in again to continue.",
          variant: "destructive"
        })
      }
    } catch {
      // Token refresh failed
    } finally {
      setRefreshing(false)
    }
  }

  // Load initial data
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const [oppRes, pipelineRes] = await Promise.all([
        fetch("/api/opportunities"),
        fetch("/api/pipelines")
      ])

      const oppData = await oppRes.json()
      const pipelineData = await pipelineRes.json()

      if (!oppRes.ok) {
        throw new Error(oppData.details || oppData.error || "Failed to fetch opportunities")
      }

      const opps = oppData.opportunities || []
      setOpportunities(opps)
      setPipelines(pipelineData.pipelines || [])
      
      // Extract unique stages for the stage selector
      const stages = extractUniqueStages(opps)
      setAvailableStages(stages)
      
      // Create default pipeline with all unique stages (only on first load)
      if (!defaultPipelineCreated && stages.length > 0) {
        const defaultPipeline: PipelineSuggestion = {
          name: "New Pipeline 1",
          stages: stages.map(s => s.name),
          description: `Pipeline with ${stages.length} stages from your opportunities`,
          matchingOpportunities: opps.map(o => o.id)
        }
        setSuggestions([defaultPipeline])
        setDefaultPipelineCreated(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const analyzeOpportunities = async () => {
    setAnalyzing(true)
    setError(null)
    
    try {
      const response = await fetch("/api/analyze", { method: "POST" })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || "Analysis failed")
      }

      setSuggestions(data.suggestedPipelines || [])
      
      toast({
        title: "Analysis Complete",
        description: data.summary || `Found ${data.suggestedPipelines?.length || 0} pipeline suggestions`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed"
      setError(message)
      toast({
        title: "Analysis Failed",
        description: message,
        variant: "destructive"
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const createPipelines = async (pipelinesToCreate: PipelineSuggestion[]) => {
    setCreating(true)
    setError(null)
    
    const created: Pipeline[] = []
    const failed: string[] = []
    
    for (const pipeline of pipelinesToCreate) {
      try {
        console.log(`[Dashboard] Creating pipeline: ${pipeline.name} with stages:`, pipeline.stages)
        
        const response = await fetch("/api/pipelines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: pipeline.name,
            stages: pipeline.stages
          })
        })

        const data = await response.json()
        
        if (!response.ok) {
          console.error(`[Dashboard] Pipeline creation failed:`, data)
          // Check for auth error
          if (response.status === 401) {
            await handleAuthError()
            throw new Error("Authentication expired - please try again after re-authenticating")
          }
          throw new Error(data.details || data.error || "Unknown error")
        }

        console.log(`[Dashboard] Pipeline created successfully:`, data)
        created.push(data)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error"
        failed.push(`${pipeline.name}: ${errorMsg}`)
        console.error(`[Dashboard] Failed to create pipeline ${pipeline.name}:`, err)
      }
    }

    setCreatedPipelines(created)
    
    if (created.length > 0) {
      toast({
        title: "Pipelines Created",
        description: `Successfully created ${created.length} pipeline${created.length > 1 ? 's' : ''}${failed.length > 0 ? ` (${failed.length} failed)` : ''}`,
      })
      
      // Refresh pipelines list
      await loadData()
      
      // Move to migrate tab if opportunities are selected
      if (selectedOpportunities.size > 0) {
        setActiveTab("migrate")
      }
    } else {
      const errorDetails = failed.length > 0 ? failed.join("; ") : "Unknown error"
      setError(`Failed to create pipelines: ${errorDetails}`)
      toast({
        title: "Creation Failed",
        description: errorDetails.length > 100 ? errorDetails.substring(0, 100) + "..." : errorDetails,
        variant: "destructive"
      })
    }
    
    setCreating(false)
  }

  // Compute migration preview for a pipeline
  const computeMigrationPreview = (pipeline: Pipeline) => {
    const stageConfig = fieldMappingConfig?.stageMapping
    const selectedOpps = opportunities.filter(o => selectedOpportunities.has(o.id))
    
    // Check if we have smart stage mapping configured for this pipeline
    const useSmartStageMapping = stageConfig?.pipelineId === pipeline.id && 
                                  stageConfig?.perStageMappings && 
                                  stageConfig.perStageMappings.length > 0
    
    const stageMappingsMap = new Map<string, { stageName: string; stageId: string; count: number; isAutoMatched: boolean }>()
    const skippedOpps: Array<{ id: string; title: string; stageName: string | null }> = []
    
    for (const opp of selectedOpps) {
      const oppStageName = opp.stage?.name || null
      let targetStageId: string | null = null
      let targetStageName: string | null = null
      let isAutoMatched = false
      
      if (useSmartStageMapping && stageConfig) {
        // Use smart mapping
        const mapping = stageConfig.perStageMappings.find(
          m => oppStageName && m.opportunityStageName.toLowerCase() === oppStageName.toLowerCase()
        )
        
        if (mapping?.targetStageId && mapping?.targetStageName) {
          targetStageId = mapping.targetStageId
          targetStageName = mapping.targetStageName
          isAutoMatched = mapping.isAutoMatched
        } else if (stageConfig.fallbackStageId && stageConfig.fallbackStageName) {
          targetStageId = stageConfig.fallbackStageId
          targetStageName = stageConfig.fallbackStageName + " (fallback)"
          isAutoMatched = false
        }
      } else {
        // Use first stage of pipeline (legacy behavior)
        const firstStage = pipeline.stages?.[0]
        if (firstStage) {
          targetStageId = firstStage.id
          targetStageName = firstStage.name
          isAutoMatched = false
        }
      }
      
      if (targetStageId && targetStageName) {
        const existing = stageMappingsMap.get(targetStageId)
        if (existing) {
          existing.count++
        } else {
          stageMappingsMap.set(targetStageId, { 
            stageName: targetStageName, 
            stageId: targetStageId, 
            count: 1,
            isAutoMatched 
          })
        }
      } else {
        skippedOpps.push({ id: opp.id, title: opp.opportunity_title, stageName: oppStageName })
      }
    }
    
    const stageMappings = Array.from(stageMappingsMap.values()).sort((a, b) => b.count - a.count)
    const totalToMigrate = stageMappings.reduce((sum, s) => sum + s.count, 0)
    
    setMigrationPreview({
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      stageMappings,
      skippedOpps,
      totalToMigrate,
      totalToSkip: skippedOpps.length
    })
    setPreviewModalOpen(true)
  }
  
  // Execute migration after preview confirmation
  const executeMigration = () => {
    if (!migrationPreview) return
    const firstStageId = migrationPreview.stageMappings[0]?.stageId || ''
    setPreviewModalOpen(false)
    migrateOpportunities(migrationPreview.pipelineId, firstStageId)
  }

  const migrateOpportunities = async (pipelineId: string, stageId: string) => {
    if (selectedOpportunities.size === 0) {
      toast({
        title: "No Opportunities Selected",
        description: "Please select opportunities to migrate",
        variant: "destructive"
      })
      return
    }

    setMigrating(true)
    
    try {
      // Create deals from selected opportunities
      const selectedOpps = opportunities.filter(o => selectedOpportunities.has(o.id))
      
      // Use field mapping config if available
      const useStaticOwner = fieldMappingConfig?.ownerMapping?.userId
      const stageConfig = fieldMappingConfig?.stageMapping
      
      // Check if we have smart stage mapping configured
      const useSmartStageMapping = stageConfig?.perStageMappings && stageConfig.perStageMappings.length > 0
      
      console.log("[Migration] Using smart stage mapping:", useSmartStageMapping)
      console.log("[Migration] Field mapping config:", fieldMappingConfig)
      
      // Helper function to get stage ID for an opportunity
      const getStageIdForOpportunity = (opp: Opportunity): string | null => {
        if (!useSmartStageMapping || !stageConfig) {
          // Legacy: use single stage ID
          return stageConfig?.stageId || stageId
        }
        
        const oppStageName = opp.stage?.name
        if (!oppStageName) {
          // No stage on opportunity, use fallback
          return stageConfig.fallbackStageId || null
        }
        
        // Find matching per-stage mapping (case-insensitive)
        const mapping = stageConfig.perStageMappings.find(
          m => m.opportunityStageName.toLowerCase() === oppStageName.toLowerCase()
        )
        
        if (mapping?.targetStageId) {
          return mapping.targetStageId
        }
        
        // No mapping found, use fallback
        return stageConfig.fallbackStageId || null
      }
      
      // Pre-calculate which opportunities will be skipped
      const oppsToMigrate: Array<{ opp: Opportunity; stageId: string }> = []
      const skippedOpps: Opportunity[] = []
      
      for (const opp of selectedOpps) {
        const targetStageId = getStageIdForOpportunity(opp)
        if (targetStageId) {
          oppsToMigrate.push({ opp, stageId: targetStageId })
        } else {
          skippedOpps.push(opp)
        }
      }
      
      // Log migration plan
      console.log(`[Migration] Will migrate ${oppsToMigrate.length}, skip ${skippedOpps.length}`)
      if (skippedOpps.length > 0) {
        console.log("[Migration] Skipped opportunities:", skippedOpps.map(o => o.opportunity_title))
      }
      
      let created = 0
      let failed = 0
      const errors: string[] = []
      const successfullyMigrated: string[] = []
      
      for (const { opp, stageId: finalStageId } of oppsToMigrate) {
        try {
          const dealData: Record<string, any> = {
            name: opp.opportunity_title,
            stage_id: finalStageId,
          }
          
          // Add contact if available
          if (opp.contact?.id) {
            dealData.contact_id = opp.contact.id
          }
          
          // Add owner - use static owner from config, or original owner
          if (useStaticOwner) {
            dealData.owner_id = useStaticOwner
          } else if (opp.user?.id) {
            dealData.owner_id = opp.user.id
          }
          
          // Add value - check if using average or single amount
          const revenueHigh = opp.projected_revenue_high || 0
          const revenueLow = opp.projected_revenue_low || 0
          const useAverage = fieldMappingConfig?.mappings?.some(
            m => m.sourceField === "projected_revenue_high" && m.targetField === "value.average"
          ) || fieldMappingConfig?.mappings?.some(
            m => m.sourceField === "projected_revenue_low" && m.targetField === "value.average"
          )
          
          if (revenueHigh > 0 || revenueLow > 0) {
            let finalValue: number
            
            if (useAverage && revenueHigh > 0 && revenueLow > 0) {
              // Both values exist - use average
              finalValue = Math.round((revenueHigh + revenueLow) / 2)
              console.log(`[Migration] Value (Average): (${revenueLow} + ${revenueHigh}) / 2 = ${finalValue}`)
            } else {
              // Use whichever value exists (or high if both, when not averaging)
              finalValue = revenueHigh || revenueLow
              console.log(`[Migration] Value (Single): ${finalValue}`)
            }
            
            dealData.value = finalValue
            dealData.currency = "USD"
          }
          
          // Add estimated close date
          if (opp.estimated_close_date) {
            dealData.estimated_close_time = opp.estimated_close_date
          }
          
          console.log("[Migration] Creating deal:", dealData.name)
          
          const response = await fetch("/api/deals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dealData)
          })
          
          if (response.ok) {
            created++
            successfullyMigrated.push(opp.id)
          } else {
            const errorData = await response.json()
            errors.push(`${opp.opportunity_title}: ${errorData.details || errorData.error}`)
            failed++
          }
        } catch (err) {
          errors.push(`${opp.opportunity_title}: ${err instanceof Error ? err.message : 'Unknown error'}`)
          failed++
        }
      }
      
      // Mark successfully migrated opportunities
      if (successfullyMigrated.length > 0) {
        setMigratedOpportunities(prev => {
          const newSet = new Set(prev)
          successfullyMigrated.forEach(id => newSet.add(id))
          return newSet
        })
      }

      const skippedCount = skippedOpps.length
      
      if (created > 0) {
        let description = `Created ${created} deals`
        if (failed > 0) description += `, ${failed} failed`
        if (skippedCount > 0) description += `, ${skippedCount} skipped (no stage match)`
        
        toast({
          title: "Migration Complete",
          description,
        })
      } else {
        toast({
          title: "Migration Failed",
          description: errors[0] || (skippedCount > 0 ? `All ${skippedCount} opportunities skipped (no stage match)` : "No deals were created"),
          variant: "destructive"
        })
      }
      
      if (created > 0) {
        setSelectedOpportunities(new Set())
      }
    } catch (err) {
      toast({
        title: "Migration Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      })
    } finally {
      setMigrating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if ((error && opportunities.length === 0) || authError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {authError 
              ? "Your Keap session has expired. Please sign in again to continue."
              : error}
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button onClick={() => window.location.href = "/api/auth/keap"} className="gap-2">
            <LogIn className="w-4 h-4" />
            Sign in with Keap
          </Button>
          {!authError && (
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error Banner (non-fatal) */}
      {error && !authError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <div className="flex gap-2 ml-4">
              {error.toLowerCase().includes("auth") && (
                <Button size="sm" variant="outline" onClick={() => window.location.href = "/api/auth/keap"}>
                  <LogIn className="w-3 h-3 mr-1" />
                  Re-authenticate
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setError(null)}>
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Stats - Clickable cards show JSON data */}
      <div className="grid grid-cols-3 gap-4">
        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors group"
          onClick={() => openJsonModal("opportunities")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {opportunities.length > 100 ? "100+" : opportunities.length}
                </div>
                <p className="text-sm text-muted-foreground">Opportunities</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors group"
          onClick={() => openJsonModal("pipelines")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {pipelines.length > 100 ? "100+" : pipelines.length}
                </div>
                <p className="text-sm text-muted-foreground">Existing Pipelines</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{selectedOpportunities.size}</div>
            <p className="text-sm text-muted-foreground">Selected</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content - Full Width Tabs */}
      <Card className="flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
          <CardHeader className="flex-shrink-0 pb-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="build">Build Pipelines</TabsTrigger>
              <TabsTrigger value="fields">Field Mapping</TabsTrigger>
              <TabsTrigger value="migrate">Migrate Deals</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="flex-1 px-4 pb-4">
            {/* Build Pipelines Tab - Full Width */}
            <TabsContent value="build" className="mt-0">
              <PipelineBuilder
                suggestions={suggestions}
                onSuggestionsChange={setSuggestions}
                onCreatePipelines={createPipelines}
                onAnalyzeWithAI={analyzeOpportunities}
                isCreating={creating}
                isAnalyzing={analyzing}
                availableStages={availableStages}
                onStageCreated={handleStageCreated}
              />
            </TabsContent>

            {/* Field Mapping Tab */}
            <TabsContent value="fields" className="mt-0">
              <FieldMapper 
                opportunities={opportunities} 
                pipelines={pipelines}
                savedConfig={fieldMappingConfig}
                onConfigChange={setFieldMappingConfig}
              />
            </TabsContent>

            {/* Migrate Deals Tab - Two Column Layout with Opportunities */}
            <TabsContent value="migrate" className="mt-0">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Left: Opportunities Panel */}
                <div className="h-[600px] flex flex-col border rounded-lg">
                  <div className="p-4 border-b flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Source Opportunities</h3>
                      <p className="text-sm text-muted-foreground">Select opportunities to migrate</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={loadData}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-hidden p-4">
                    <OpportunitiesPanel
                      opportunities={opportunities}
                      selectedIds={selectedOpportunities}
                      onSelectionChange={setSelectedOpportunities}
                      migratedIds={migratedOpportunities}
                    />
                  </div>
                </div>

                {/* Right: Migration Actions */}
                <div className="space-y-4">
                  {pipelines.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      <p>No pipelines available.</p>
                      <p className="text-sm">Create pipelines first in the "Build Pipelines" tab.</p>
                    </div>
                  ) : selectedOpportunities.size === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      <p>Select opportunities to migrate.</p>
                      <p className="text-sm">Use the checkboxes on the left panel.</p>
                    </div>
                  ) : (
                    <>
                      <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>
                          {selectedOpportunities.size} opportunities selected for migration
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-3">
                        <h4 className="font-medium">Select destination pipeline:</h4>
                        {pipelines.map(pipeline => (
                          <Card 
                            key={pipeline.id}
                            className="cursor-pointer hover:border-primary transition-colors"
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h5 className="font-medium">{pipeline.name}</h5>
                                  <p className="text-sm text-muted-foreground">
                                    {pipeline.stages?.length || 0} stages
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const firstStage = pipeline.stages?.[0]
                                    console.log("[Migrate Button] Clicked for pipeline:", pipeline.name)
                                    console.log("[Migrate Button] First stage:", firstStage)
                                    console.log("[Migrate Button] Selected opportunities:", selectedOpportunities.size)
                                    if (firstStage) {
                                      // Show preview instead of immediate migration
                                      computeMigrationPreview(pipeline)
                                    } else {
                                      toast({
                                        title: "No Stages",
                                        description: "This pipeline has no stages to migrate to.",
                                        variant: "destructive"
                                      })
                                    }
                                  }}
                                  disabled={migrating || !pipeline.stages?.length}
                                >
                                  {migrating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      Preview <ArrowRight className="w-4 h-4 ml-1" />
                                    </>
                                  )}
                                </Button>
                              </div>
                              {pipeline.stages && pipeline.stages.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {pipeline.stages.map((stage, i) => (
                                    <span 
                                      key={stage.id}
                                      className="text-xs bg-muted px-2 py-0.5 rounded"
                                    >
                                      {i + 1}. {stage.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* JSON Data Modal */}
      <Dialog open={jsonModalOpen} onOpenChange={setJsonModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              {jsonModalData?.title}
              <Badge variant="secondary" className="ml-2">
                {jsonModalData?.count} shown of {jsonModalData?.total} total
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <div className="space-y-3">
              {jsonModalData && jsonModalData.total > 20 && (
                <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                  ℹ️ Showing first 20 of {jsonModalData.total} records. The full data is used in the dashboard.
                </p>
              )}
              <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-auto max-h-[50vh] font-mono">
                {JSON.stringify(jsonModalData?.data, null, 2)}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Migration Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Migration Preview
              <Badge variant="outline">{migrationPreview?.pipelineName}</Badge>
            </DialogTitle>
          </DialogHeader>
          
          {migrationPreview && (
            <div className="space-y-4">
              {/* Stage distribution */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Stage Distribution:</h4>
                <div className="max-h-48 overflow-auto space-y-1 border rounded-lg p-2 bg-muted/30">
                  {migrationPreview.stageMappings.map((sm, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm py-1 px-2 hover:bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        {sm.isAutoMatched ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <ArrowRight className="w-4 h-4 text-blue-500" />
                        )}
                        <span className="font-medium">{sm.stageName}</span>
                      </div>
                      <Badge variant="secondary">{sm.count} deals</Badge>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Summary */}
              <div className="flex items-center justify-between py-2 border-t">
                <span className="text-sm text-muted-foreground">Total to migrate:</span>
                <Badge className="bg-green-500">{migrationPreview.totalToMigrate} opportunities</Badge>
              </div>
              
              {/* Skipped warning */}
              {migrationPreview.totalToSkip > 0 && (
                <div className="space-y-2">
                  <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <strong>{migrationPreview.totalToSkip} opportunities will be skipped</strong>
                      <span className="block text-xs mt-1">
                        These have no matching stage in the target pipeline and no fallback is set.
                      </span>
                    </AlertDescription>
                  </Alert>
                  
                  {/* List of skipped */}
                  <div className="max-h-32 overflow-auto text-xs border rounded p-2 bg-amber-50/50 space-y-1">
                    {migrationPreview.skippedOpps.slice(0, 10).map((opp, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-amber-800">
                        <span>•</span>
                        <span className="truncate font-medium">{opp.title}</span>
                        <span className="text-amber-600 text-[10px]">
                          (stage: {opp.stageName || 'none'})
                        </span>
                      </div>
                    ))}
                    {migrationPreview.skippedOpps.length > 10 && (
                      <div className="text-amber-600 text-[10px] italic">
                        ...and {migrationPreview.skippedOpps.length - 10} more
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" className="flex-1" onClick={() => setPreviewModalOpen(false)}>
                  {migrationPreview.totalToSkip > 0 ? "Go Back & Map Stages" : "Cancel"}
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={executeMigration}
                  disabled={migrating || migrationPreview.totalToMigrate === 0}
                >
                  {migrating ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {migrationPreview.totalToSkip > 0 
                    ? `Migrate ${migrationPreview.totalToMigrate} (Skip ${migrationPreview.totalToSkip})`
                    : `Migrate ${migrationPreview.totalToMigrate} Deals`
                  }
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
