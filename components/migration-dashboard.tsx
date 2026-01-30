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
  RefreshCw
} from "lucide-react"
import { OpportunitiesPanel, Opportunity } from "./opportunities-panel"
import { PipelineBuilder, PipelineSuggestion } from "./pipeline-builder"
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
  const [suggestions, setSuggestions] = useState<PipelineSuggestion[]>([])
  
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [activeTab, setActiveTab] = useState("build")
  const [createdPipelines, setCreatedPipelines] = useState<Pipeline[]>([])
  
  const { toast } = useToast()

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

      setOpportunities(oppData.opportunities || [])
      setPipelines(pipelineData.pipelines || [])
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
        const response = await fetch("/api/pipelines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: pipeline.name,
            stages: pipeline.stages
          })
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.details || data.error)
        }

        const newPipeline = await response.json()
        created.push(newPipeline)
      } catch (err) {
        failed.push(pipeline.name)
        console.error(`Failed to create pipeline ${pipeline.name}:`, err)
      }
    }

    setCreatedPipelines(created)
    
    if (created.length > 0) {
      toast({
        title: "Pipelines Created",
        description: `Successfully created ${created.length} pipeline${created.length > 1 ? 's' : ''}${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
      })
      
      // Refresh pipelines list
      await loadData()
      
      // Move to migrate tab if opportunities are selected
      if (selectedOpportunities.size > 0) {
        setActiveTab("migrate")
      }
    } else {
      toast({
        title: "Creation Failed",
        description: "Failed to create pipelines. Please try again.",
        variant: "destructive"
      })
    }
    
    setCreating(false)
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
      
      const deals = selectedOpps.map(opp => ({
        name: opp.opportunity_title,
        stage_id: stageId,
        contact_id: opp.contact?.id,
        value: opp.projected_revenue_high || opp.projected_revenue_low
      }))

      // TODO: Call bulk create deals API
      // For now, create one by one
      let created = 0
      let failed = 0
      
      for (const deal of deals) {
        try {
          const response = await fetch("/api/deals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(deal)
          })
          
          if (response.ok) {
            created++
          } else {
            failed++
          }
        } catch {
          failed++
        }
      }

      toast({
        title: "Migration Complete",
        description: `Created ${created} deals${failed > 0 ? `, ${failed} failed` : ''}`,
      })
      
      setSelectedOpportunities(new Set())
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

  if (error && opportunities.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{opportunities.length}</div>
            <p className="text-sm text-muted-foreground">Opportunities</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{pipelines.length}</div>
            <p className="text-sm text-muted-foreground">Existing Pipelines</p>
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

      {/* Main Content */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Opportunities */}
        <Card className="h-[700px] flex flex-col">
          <CardHeader className="flex-shrink-0 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Source Opportunities</CardTitle>
                <CardDescription>Select opportunities to analyze and migrate</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={loadData}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden px-4 pb-4">
            <OpportunitiesPanel
              opportunities={opportunities}
              selectedIds={selectedOpportunities}
              onSelectionChange={setSelectedOpportunities}
            />
          </CardContent>
        </Card>

        {/* Right: Pipeline Builder / Migration */}
        <Card className="h-[700px] flex flex-col">
          <CardHeader className="flex-shrink-0 pb-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="build">Build Pipelines</TabsTrigger>
                <TabsTrigger value="migrate">Migrate Deals</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden px-4 pb-4">
            <Tabs value={activeTab} className="h-full flex flex-col">
              <TabsContent value="build" className="mt-0 flex-1 overflow-auto">
                <div className="space-y-4 pr-2">
                  {/* AI Analyze Button */}
                  <Button 
                    onClick={analyzeOpportunities}
                    disabled={analyzing || opportunities.length === 0}
                    className="w-full"
                    variant={suggestions.length > 0 ? "outline" : "default"}
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing {opportunities.length} opportunities...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        {suggestions.length > 0 ? "Re-analyze with AI" : "Analyze with AI"}
                      </>
                    )}
                  </Button>

                  <PipelineBuilder
                    suggestions={suggestions}
                    onSuggestionsChange={setSuggestions}
                    onCreatePipelines={createPipelines}
                    isCreating={creating}
                  />
                </div>
              </TabsContent>

              <TabsContent value="migrate" className="mt-0 flex-1 overflow-auto">
                <div className="space-y-4 pr-2">
                  {pipelines.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No pipelines available.</p>
                      <p className="text-sm">Create pipelines first in the "Build Pipelines" tab.</p>
                    </div>
                  ) : selectedOpportunities.size === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
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
                                    if (firstStage) {
                                      migrateOpportunities(pipeline.id, firstStage.id)
                                    }
                                  }}
                                  disabled={migrating || !pipeline.stages?.length}
                                >
                                  {migrating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      Migrate <ArrowRight className="w-4 h-4 ml-1" />
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
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
