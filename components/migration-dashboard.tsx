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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ChevronLeft, ChevronRight, User, DollarSign, FileText, Calendar, FolderOpen, Hammer, ArrowLeft } from "lucide-react"
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
  
  // Pipeline mode: null = choice not made, "existing" = use existing, "build" = build new
  const [pipelineMode, setPipelineMode] = useState<"existing" | "build" | null>(null)
  // Selected target pipeline for migration
  const [selectedTargetPipeline, setSelectedTargetPipeline] = useState<Pipeline | null>(null)
  
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
  
  // Currency selector
  const [currency, setCurrency] = useState("USD")
  const CURRENCIES = [
    { value: "USD", label: "USD - US Dollar" },
    { value: "EUR", label: "EUR - Euro" },
    { value: "GBP", label: "GBP - British Pound" },
    { value: "CAD", label: "CAD - Canadian Dollar" },
    { value: "AUD", label: "AUD - Australian Dollar" },
    { value: "NZD", label: "NZD - New Zealand Dollar" },
    { value: "CHF", label: "CHF - Swiss Franc" },
    { value: "JPY", label: "JPY - Japanese Yen" },
    { value: "INR", label: "INR - Indian Rupee" },
    { value: "BRL", label: "BRL - Brazilian Real" },
    { value: "MXN", label: "MXN - Mexican Peso" },
  ]
  
  // Pipeline outcomes
  const [outcomesModalOpen, setOutcomesModalOpen] = useState(false)
  const [pipelineOutcomes, setPipelineOutcomes] = useState<Record<string, "ACTIVE" | "WON" | "LOST">>({})
  const [selectedPipelineForOutcomes, setSelectedPipelineForOutcomes] = useState<Pipeline | null>(null)
  const [outcomesConfigured, setOutcomesConfigured] = useState(false)
  // Cache outcomes per pipeline to avoid re-fetching
  const [outcomesCache, setOutcomesCache] = useState<Record<string, Record<string, "ACTIVE" | "WON" | "LOST">>>({})
  
  // Migration preview modal - enhanced with individual opportunity details
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)  // For carousel navigation
  const [migrationPreview, setMigrationPreview] = useState<{
    pipelineId: string
    pipelineName: string
    stageMappings: Array<{
      stageName: string
      stageId: string
      count: number
      isAutoMatched: boolean
      status: "ACTIVE" | "WON" | "LOST"
    }>
    skippedOpps: Array<{ id: string; title: string; stageName: string | null }>
    totalToMigrate: number
    totalToSkip: number
    // Enhanced: individual opportunity details
    opportunityDetails: Array<{
      opportunity: Opportunity
      targetStageName: string
      targetStageId: string
      targetStatus: "ACTIVE" | "WON" | "LOST"
      value: number
      hasNotes: boolean
      noteCount: number
    }>
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
      const loadedPipelines = pipelineData.pipelines || []
      setOpportunities(opps)
      setPipelines(loadedPipelines)
      
      // Extract unique stages for the stage selector
      const stages = extractUniqueStages(opps)
      setAvailableStages(stages)
      
      // Prefetch outcomes for all pipelines in the background
      if (loadedPipelines.length > 0) {
        loadedPipelines.forEach((pipeline: Pipeline) => {
          // Fire and forget - don't await
          fetch(`/api/pipelines/${pipeline.id}/outcomes`)
            .then(res => res.json())
            .then(data => {
              const outcomeMap: Record<string, "ACTIVE" | "WON" | "LOST"> = {}
              pipeline.stages?.forEach(stage => {
                const outcome = data.outcomes?.find((o: any) => o.stage_id === stage.id)
                outcomeMap[stage.id] = outcome?.outcome_type || "ACTIVE"
              })
              setOutcomesCache(prev => ({ ...prev, [pipeline.id]: outcomeMap }))
            })
            .catch(() => {})  // Silently ignore prefetch errors
        })
      }
      
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
      
      // Reset pipeline mode so returning to Build tab shows the choice again
      setPipelineMode(null)
      
      // Clear suggestions to prepare for next pipeline
      setSuggestions([])
      
      // Auto-select the newly created pipeline and advance to Field Mapping
      if (created.length === 1) {
        setSelectedTargetPipeline(created[0])
      }
      setActiveTab("fields")
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

  // Prefetch outcomes for a pipeline and cache them
  const prefetchPipelineOutcomes = async (pipeline: Pipeline): Promise<Record<string, "ACTIVE" | "WON" | "LOST">> => {
    // Check cache first
    if (outcomesCache[pipeline.id]) {
      return outcomesCache[pipeline.id]
    }
    
    try {
      const response = await fetch(`/api/pipelines/${pipeline.id}/outcomes`)
      const data = await response.json()
      
      const outcomeMap: Record<string, "ACTIVE" | "WON" | "LOST"> = {}
      pipeline.stages?.forEach(stage => {
        const outcome = data.outcomes?.find((o: any) => o.stage_id === stage.id)
        outcomeMap[stage.id] = outcome?.outcome_type || "ACTIVE"
      })
      
      // Cache the result
      setOutcomesCache(prev => ({ ...prev, [pipeline.id]: outcomeMap }))
      return outcomeMap
    } catch {
      // Default all to OPEN
      const defaultOutcomes: Record<string, "ACTIVE" | "WON" | "LOST"> = {}
      pipeline.stages?.forEach(stage => {
        defaultOutcomes[stage.id] = "ACTIVE"
      })
      return defaultOutcomes
    }
  }
  
  // Check pipeline outcomes and show config modal if not yet configured
  const checkPipelineOutcomes = async (pipeline: Pipeline) => {
    // Check if we already have user-configured outcomes for this pipeline
    if (outcomesCache[pipeline.id] && outcomesConfigured && selectedPipelineForOutcomes?.id === pipeline.id) {
      // Use cached/configured outcomes directly
      computeMigrationPreview(pipeline, outcomesCache[pipeline.id])
      return
    }
    
    const outcomes = await prefetchPipelineOutcomes(pipeline)
    
    // Check if outcomes were actually configured in Keap (not just defaults)
    const hasConfiguredOutcomes = Object.values(outcomes).some(v => v === "WON" || v === "LOST")
    
    if (hasConfiguredOutcomes) {
      // Pipeline has outcomes configured - use them
      setPipelineOutcomes(outcomes)
      setOutcomesConfigured(true)
      setSelectedPipelineForOutcomes(pipeline)
      computeMigrationPreview(pipeline, outcomes)
    } else {
      // No outcomes configured - show config modal
      setSelectedPipelineForOutcomes(pipeline)
      setPipelineOutcomes(outcomes)
      setOutcomesConfigured(false)
      setOutcomesModalOpen(true)
    }
  }
  
  // Calculate value for an opportunity
  const calculateValue = (opp: Opportunity): number => {
    const revenueHigh = opp.projected_revenue_high || 0
    const revenueLow = opp.projected_revenue_low || 0
    const useAverage = fieldMappingConfig?.mappings?.some(
      m => m.sourceField === "projected_revenue_high" && m.targetField === "value.average"
    ) || fieldMappingConfig?.mappings?.some(
      m => m.sourceField === "projected_revenue_low" && m.targetField === "value.average"
    )
    
    if (useAverage && revenueHigh > 0 && revenueLow > 0) {
      return Math.round((revenueHigh + revenueLow) / 2)
    }
    return revenueHigh || revenueLow
  }

  // Compute migration preview for a pipeline
  const computeMigrationPreview = (pipeline: Pipeline, outcomes: Record<string, "ACTIVE" | "WON" | "LOST"> = pipelineOutcomes) => {
    console.log("[Preview] Computing with outcomes:", outcomes)
    const stageConfig = fieldMappingConfig?.stageMapping
    const selectedOpps = opportunities.filter(o => selectedOpportunities.has(o.id))
    
    // Check if we have explicit smart stage mapping configured for this pipeline
    const hasExplicitStageMapping = stageConfig?.pipelineId === pipeline.id && 
                                     stageConfig?.perStageMappings && 
                                     stageConfig.perStageMappings.length > 0
    
    const stageMappingsMap = new Map<string, { stageName: string; stageId: string; count: number; isAutoMatched: boolean; status: "ACTIVE" | "WON" | "LOST" }>()
    const skippedOpps: Array<{ id: string; title: string; stageName: string | null }> = []
    const opportunityDetails: Array<{
      opportunity: Opportunity
      targetStageName: string
      targetStageId: string
      targetStatus: "ACTIVE" | "WON" | "LOST"
      value: number
      hasNotes: boolean
      noteCount: number
    }> = []
    
    // Helper: find matching stage by name (case-insensitive)
    const findMatchingStage = (oppStageName: string | null) => {
      console.log(`[Preview] findMatchingStage called with: "${oppStageName}"`)
      console.log(`[Preview] Pipeline stages:`, pipeline.stages?.map(s => s.name))
      if (!oppStageName || !pipeline.stages) {
        console.log(`[Preview] No match: oppStageName=${oppStageName}, hasStages=${!!pipeline.stages}`)
        return null
      }
      const match = pipeline.stages.find(
        s => s.name.toLowerCase() === oppStageName.toLowerCase()
      )
      console.log(`[Preview] Match result:`, match ? match.name : "NO MATCH")
      return match
    }
    
    for (const opp of selectedOpps) {
      const oppStageName = opp.stage?.name || null
      let targetStageId: string | null = null
      let targetStageName: string | null = null
      let isAutoMatched = false
      
      if (hasExplicitStageMapping && stageConfig) {
        // Use explicit smart mapping from field mapper
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
        // Auto-match by stage name first, then fall back to first stage
        const matchedStage = findMatchingStage(oppStageName)
        if (matchedStage) {
          targetStageId = matchedStage.id
          targetStageName = matchedStage.name
          isAutoMatched = true
          console.log(`[Preview] Auto-matched "${oppStageName}" → "${matchedStage.name}"`)
        } else {
          // No match - use first stage as fallback
          const firstStage = pipeline.stages?.[0]
          if (firstStage) {
            targetStageId = firstStage.id
            targetStageName = firstStage.name
            isAutoMatched = false
            console.log(`[Preview] No match for "${oppStageName}", using fallback: "${firstStage.name}"`)
          }
        }
      }
      
      if (targetStageId && targetStageName) {
        const status = outcomes[targetStageId] || "ACTIVE"
        const existing = stageMappingsMap.get(targetStageId)
        if (existing) {
          existing.count++
        } else {
          stageMappingsMap.set(targetStageId, { 
            stageName: targetStageName, 
            stageId: targetStageId, 
            count: 1,
            isAutoMatched,
            status
          })
        }
        
        // Add opportunity details for carousel
        const noteCount = (opp.opportunity_notes ? 1 : 0) + (opp.next_action_notes ? 1 : 0)
        opportunityDetails.push({
          opportunity: opp,
          targetStageName,
          targetStageId,
          targetStatus: status,
          value: calculateValue(opp),
          hasNotes: noteCount > 0,
          noteCount
        })
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
      totalToSkip: skippedOpps.length,
      opportunityDetails
    })
    setPreviewIndex(0)
    setPreviewModalOpen(true)
  }
  
  // Confirm outcomes and proceed to preview
  const confirmOutcomes = () => {
    if (selectedPipelineForOutcomes) {
      // Cache the user's outcome configuration
      setOutcomesCache(prev => ({ 
        ...prev, 
        [selectedPipelineForOutcomes.id]: { ...pipelineOutcomes } 
      }))
      setOutcomesConfigured(true)
      setOutcomesModalOpen(false)
      // Pass the current pipelineOutcomes state directly
      console.log("[Confirm Outcomes] Using outcomes:", pipelineOutcomes)
      computeMigrationPreview(selectedPipelineForOutcomes, pipelineOutcomes)
    }
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
      console.log("[Migration] Using currency:", currency)
      
      // Find the pipeline we're migrating to
      const targetPipeline = pipelines.find(p => p.id === pipelineId)
      
      // Helper function to get stage ID and status for an opportunity
      const getStageInfoForOpportunity = (opp: Opportunity): { stageId: string; status: "ACTIVE" | "WON" | "LOST" } | null => {
        let targetStageId: string | null = null
        const oppStageName = opp.stage?.name
        
        if (useSmartStageMapping && stageConfig) {
          // Use explicit smart mapping from field mapper
          if (!oppStageName) {
            // No stage on opportunity, use fallback
            targetStageId = stageConfig.fallbackStageId || null
          } else {
            // Find matching per-stage mapping (case-insensitive)
            const mapping = stageConfig.perStageMappings.find(
              m => m.opportunityStageName.toLowerCase() === oppStageName.toLowerCase()
            )
            targetStageId = mapping?.targetStageId || stageConfig.fallbackStageId || null
          }
        } else {
          // Auto-match by stage name (case-insensitive)
          if (oppStageName && targetPipeline?.stages) {
            const matchedStage = targetPipeline.stages.find(
              s => s.name.toLowerCase() === oppStageName.toLowerCase()
            )
            if (matchedStage) {
              targetStageId = matchedStage.id
              console.log(`[Migration] Auto-matched "${oppStageName}" → "${matchedStage.name}"`)
            }
          }
          
          // Fallback to the passed stageId (first stage)
          if (!targetStageId) {
            targetStageId = stageId
            console.log(`[Migration] No auto-match for "${oppStageName}", using fallback stage`)
          }
        }
        
        if (!targetStageId) return null
        
        // Get status from pipeline outcomes config
        const status = pipelineOutcomes[targetStageId] || "ACTIVE"
        return { stageId: targetStageId, status }
      }
      
      // Pre-calculate which opportunities will be skipped
      const oppsToMigrate: Array<{ opp: Opportunity; stageId: string; status: "ACTIVE" | "WON" | "LOST" }> = []
      const skippedOpps: Opportunity[] = []
      
      for (const opp of selectedOpps) {
        const stageInfo = getStageInfoForOpportunity(opp)
        if (stageInfo) {
          oppsToMigrate.push({ opp, stageId: stageInfo.stageId, status: stageInfo.status })
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
      
      for (const { opp, stageId: finalStageId, status } of oppsToMigrate) {
        try {
          // Build notes array
          const notes: Array<{ body: string; created_by?: string; created_time?: string }> = []
          
          // Add opportunity notes (oldest first)
          if (opp.opportunity_notes && opp.opportunity_notes.trim()) {
            notes.push({
              body: opp.opportunity_notes,
              created_by: opp.user?.id?.toString(),
              created_time: opp.date_created
            })
          }
          
          // Add next action notes with prefix
          if (opp.next_action_notes && opp.next_action_notes.trim()) {
            notes.push({
              body: `NEXT ACTION: ${opp.next_action_notes}`,
              created_by: opp.user?.id?.toString(),
              created_time: opp.next_action_date || opp.last_updated
            })
          }
          
          // Add value - check if using average or single amount
          const revenueHigh = opp.projected_revenue_high || 0
          const revenueLow = opp.projected_revenue_low || 0
          const useAverage = fieldMappingConfig?.mappings?.some(
            m => m.sourceField === "projected_revenue_high" && m.targetField === "value.average"
          ) || fieldMappingConfig?.mappings?.some(
            m => m.sourceField === "projected_revenue_low" && m.targetField === "value.average"
          )
          
          let finalValue = 0
          if (revenueHigh > 0 || revenueLow > 0) {
            if (useAverage && revenueHigh > 0 && revenueLow > 0) {
              // Both values exist - use average
              finalValue = Math.round((revenueHigh + revenueLow) / 2)
              console.log(`[Migration] Value (Average): (${revenueLow} + ${revenueHigh}) / 2 = ${finalValue}`)
            } else {
              // Use whichever value exists (or high if both, when not averaging)
              finalValue = revenueHigh || revenueLow
              console.log(`[Migration] Value (Single): ${finalValue}`)
            }
          }
          
          // Build deal request with correct v2 API schema
          const dealData: Record<string, any> = {
            name: opp.opportunity_title,
            stage_id: finalStageId,
            status: status,                    // OPEN, WON, or LOST based on outcomes
            value: finalValue,
            currency: currency,                // User-selected currency
            task_ids: [],                      // Empty for now - no task mapping implemented
            notes: notes                       // Will be created after deal
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
          
          // Add estimated close date
          if (opp.estimated_close_date) {
            dealData.estimated_close_time = opp.estimated_close_date
          }
          
          // Preserve original dates from opportunity (if mapped)
          const dateCreatedMapping = fieldMappingConfig?.mappings?.find(m => m.sourceField === "date_created")
          const lastUpdatedMapping = fieldMappingConfig?.mappings?.find(m => m.sourceField === "last_updated")
          
          if (dateCreatedMapping?.targetField === "created_time" && opp.date_created) {
            dealData.created_time = opp.date_created
          }
          if (lastUpdatedMapping?.targetField === "last_updated_time" && opp.last_updated) {
            dealData.last_updated_time = opp.last_updated
          }
          
          console.log("[Migration] Creating deal:", dealData.name, "status:", status)
          
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
      
      // Build detailed results for display
      const resultsTitle = created > 0 ? "Migration Complete" : "Migration Failed"
      let resultsDescription = ""
      
      if (created > 0) {
        resultsDescription = `✓ Created ${created} deal${created !== 1 ? 's' : ''}`
      }
      if (failed > 0) {
        resultsDescription += `${resultsDescription ? '\n' : ''}✗ ${failed} failed`
      }
      if (skippedCount > 0) {
        resultsDescription += `${resultsDescription ? '\n' : ''}⊘ ${skippedCount} skipped (no stage match)`
      }
      
      // Show toast with summary
      toast({
        title: resultsTitle,
        description: resultsDescription || "No deals were created",
        variant: created > 0 ? "default" : "destructive",
        duration: 5000,
      })
      
      // Show detailed error dialog if there were failures or skips
      if (errors.length > 0 || skippedCount > 0) {
        const errorDetails: string[] = []
        
        if (errors.length > 0) {
          errorDetails.push("**Failed:**")
          errors.forEach(e => errorDetails.push(`• ${e}`))
        }
        
        if (skippedCount > 0) {
          if (errorDetails.length > 0) errorDetails.push("")
          errorDetails.push("**Skipped (no matching stage):**")
          skippedOpps.forEach(o => errorDetails.push(`• ${o.opportunity_title} (stage: ${o.stage?.name || 'none'})`))
        }
        
        // Log detailed errors to console for debugging
        console.error("[Migration] Detailed errors:", errorDetails.join('\n'))
        
        // Show a follow-up toast with details
        setTimeout(() => {
          toast({
            title: "Migration Details",
            description: errorDetails.slice(0, 5).join('\n') + (errorDetails.length > 5 ? `\n... and ${errorDetails.length - 5} more (see console)` : ''),
            duration: 10000,
          })
        }, 500)
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
        <Tabs value={activeTab} onValueChange={(tab) => {
          // Reset pipeline mode when going back to build tab
          if (tab === "build") {
            setPipelineMode(null)
          }
          setActiveTab(tab)
        }} className="flex flex-col flex-1">
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
              {/* Show choice if there are existing pipelines and user hasn't chosen yet */}
              {pipelines.length > 0 && pipelineMode === null ? (
                <div className="max-w-md mx-auto py-8 space-y-6">
                  {/* Build New Pipelines */}
                  <Card 
                    className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
                    onClick={() => setPipelineMode("build")}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                          <Hammer className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">Build New Pipeline</h4>
                          <p className="text-xs text-muted-foreground">{availableStages.length} stages from opportunities</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">or</span>
                    </div>
                  </div>
                  
                  {/* Use Existing Pipeline - with dropdown */}
                  <Card className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <FolderOpen className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">Use Existing Pipeline</h4>
                        </div>
                      </div>
                      <Select
                        value={selectedTargetPipeline?.id || ""}
                        onValueChange={(id) => {
                          const pipeline = pipelines.find(p => p.id === id)
                          setSelectedTargetPipeline(pipeline || null)
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a pipeline..." />
                        </SelectTrigger>
                        <SelectContent>
                          {pipelines.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              <span className="flex items-center gap-2">
                                {p.name}
                                <span className="text-xs text-muted-foreground">
                                  ({p.stages?.length || 0} stages)
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTargetPipeline && (
                        <Button 
                          className="w-full mt-3" 
                          onClick={() => {
                            setPipelineMode("existing")
                            setActiveTab("fields")
                          }}
                        >
                          Continue to Field Mapping
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <>
                  {/* Back button when in build mode and pipelines exist */}
                  {pipelines.length > 0 && pipelineMode === "build" && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mb-4"
                      onClick={() => setPipelineMode(null)}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to options
                    </Button>
                  )}
                  
                  <PipelineBuilder
                    suggestions={suggestions}
                    onSuggestionsChange={setSuggestions}
                    onCreatePipelines={createPipelines}
                    onAnalyzeWithAI={analyzeOpportunities}
                    isCreating={creating}
                    isAnalyzing={analyzing}
                    availableStages={availableStages}
                    onStageCreated={handleStageCreated}
                    existingPipelineNames={pipelines.map(p => p.name)}
                  />
                </>
              )}
            </TabsContent>

            {/* Field Mapping Tab */}
            <TabsContent value="fields" className="mt-0">
              <FieldMapper 
                opportunities={opportunities} 
                pipelines={pipelines}
                initialPipeline={selectedTargetPipeline}
                savedConfig={fieldMappingConfig}
                onConfigChange={setFieldMappingConfig}
              />
            </TabsContent>

            {/* Migrate Deals Tab - Two Column Layout with Opportunities */}
            <TabsContent value="migrate" className="mt-0">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Left: Opportunities Panel - Tall to show more items */}
                <div className="h-[calc(100vh-220px)] min-h-[750px] flex flex-col border rounded-lg">
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
                      
                      {/* Currency Selector */}
                      <Card className="border-dashed">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-sm font-medium">Currency</Label>
                              <p className="text-xs text-muted-foreground">
                                Deal values will use this currency
                              </p>
                            </div>
                            <Select value={currency} onValueChange={setCurrency}>
                              <SelectTrigger className="w-48">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CURRENCIES.map(c => (
                                  <SelectItem key={c.value} value={c.value}>
                                    {c.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>

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
                                      // Check outcomes first, then show preview
                                      checkPipelineOutcomes(pipeline)
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

      {/* Pipeline Outcomes Configuration Modal */}
      <Dialog open={outcomesModalOpen} onOpenChange={setOutcomesModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Configure Pipeline Outcomes
            </DialogTitle>
            <DialogDescription>
              This pipeline doesn't have outcomes configured. Please specify which stages represent deal outcomes.
            </DialogDescription>
          </DialogHeader>
          
          {selectedPipelineForOutcomes && (
            <div className="space-y-4">
              {/* Warning about close date */}
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-800">
                  <strong>Note:</strong> Keap automatically sets the "Actual Close Date" to today when a deal is marked as WON or LOST. Leave stages as OPEN to avoid this.
                </AlertDescription>
              </Alert>
              
              <div className="max-h-64 overflow-auto space-y-2 border rounded-lg p-3 bg-muted/30">
                {selectedPipelineForOutcomes.stages?.map((stage) => (
                  <div key={stage.id} className="flex items-center justify-between gap-4 p-2 bg-background rounded-md">
                    <span className="font-medium text-sm">{stage.name}</span>
                    <Select
                      value={pipelineOutcomes[stage.id] || "ACTIVE"}
                      onValueChange={(value: "ACTIVE" | "WON" | "LOST") => {
                        setPipelineOutcomes(prev => ({ ...prev, [stage.id]: value }))
                      }}
                    >
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            In Progress (ACTIVE)
                          </span>
                        </SelectItem>
                        <SelectItem value="WON">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            Won (WON)
                          </span>
                        </SelectItem>
                        <SelectItem value="LOST">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            Lost (LOST)
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-blue-800 text-xs">
                  Deals will be assigned a status based on their target stage. This affects reporting and pipeline analytics.
                </AlertDescription>
              </Alert>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setOutcomesModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={confirmOutcomes}>
                  Continue to Preview
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Migration Preview Modal - Enhanced with Carousel */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Migration Preview
              <Badge variant="outline">{migrationPreview?.pipelineName}</Badge>
              <Badge variant="secondary" className="ml-auto">
                {currency}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          {migrationPreview && (
            <div className="flex flex-col gap-4 flex-1 overflow-hidden">
              {/* Stage distribution summary */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Stage Distribution:</h4>
                <div className="max-h-32 overflow-auto space-y-1 border rounded-lg p-2 bg-muted/30">
                  {migrationPreview.stageMappings.map((sm, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm py-1 px-2 hover:bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        {sm.isAutoMatched ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <ArrowRight className="w-4 h-4 text-blue-500" />
                        )}
                        <span className="font-medium">{sm.stageName}</span>
                        <Badge 
                          className={`text-[10px] px-1.5 py-0 ${
                            sm.status === "WON" ? "bg-green-100 text-green-800" :
                            sm.status === "LOST" ? "bg-red-100 text-red-800" :
                            "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {sm.status}
                        </Badge>
                      </div>
                      <Badge variant="secondary">{sm.count} deals</Badge>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Individual Opportunity Carousel */}
              {migrationPreview.opportunityDetails && migrationPreview.opportunityDetails.length > 0 && (
                <div className="border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium">Deal Preview</h4>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                        disabled={previewIndex === 0}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                        {previewIndex + 1} of {migrationPreview.opportunityDetails.length}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setPreviewIndex(Math.min(migrationPreview.opportunityDetails.length - 1, previewIndex + 1))}
                        disabled={previewIndex >= migrationPreview.opportunityDetails.length - 1}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Current opportunity details */}
                  {(() => {
                    const detail = migrationPreview.opportunityDetails[previewIndex]
                    const opp = detail.opportunity
                    return (
                      <div className="space-y-3 bg-background rounded-md p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h5 className="font-semibold">{opp.opportunity_title}</h5>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {opp.stage?.name} → {detail.targetStageName}
                            </p>
                          </div>
                          <Badge 
                            className={`${
                              detail.targetStatus === "WON" ? "bg-green-500" :
                              detail.targetStatus === "LOST" ? "bg-red-500" :
                              "bg-blue-500"
                            }`}
                          >
                            {detail.targetStatus}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {/* Value */}
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-3 h-3 text-green-600" />
                            <span className="text-muted-foreground">Value:</span>
                            <span className="font-medium">
                              {detail.value > 0 ? `${detail.value.toLocaleString()} ${currency}` : "—"}
                            </span>
                          </div>
                          
                          {/* Contact */}
                          {opp.contact && (
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3 text-blue-600" />
                              <span className="text-muted-foreground">Contact:</span>
                              <span className="font-medium truncate">
                                {opp.contact.first_name} {opp.contact.last_name}
                              </span>
                            </div>
                          )}
                          
                          {/* Owner */}
                          {opp.user && (
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3 text-purple-600" />
                              <span className="text-muted-foreground">Owner:</span>
                              <span className="font-medium">
                                {opp.user.first_name} {opp.user.last_name}
                              </span>
                            </div>
                          )}
                          
                          {/* Est. Close */}
                          {opp.estimated_close_date && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3 h-3 text-orange-600" />
                              <span className="text-muted-foreground">Est. Close:</span>
                              <span className="font-medium">
                                {new Date(opp.estimated_close_date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Notes indicator */}
                        {detail.hasNotes && (
                          <div className="flex items-center gap-2 text-xs pt-2 border-t">
                            <FileText className="w-3 h-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {detail.noteCount} note{detail.noteCount > 1 ? "s" : ""} will be created
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}
              
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
                  <div className="max-h-24 overflow-auto text-xs border rounded p-2 bg-amber-50/50 space-y-1">
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
