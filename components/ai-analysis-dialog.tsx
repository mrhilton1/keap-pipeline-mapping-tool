"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, AlertCircle, CheckCircle2, TrendingUp } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface PipelineRecommendation {
  pipelineName: string
  description: string
  stages: Array<{
    name: string
    description: string
    order: number
  }>
  opportunityPatterns: string[]
  estimatedCount: number
}

interface MappingSuggestion {
  opportunityId: string
  opportunityTitle: string
  suggestedPipeline: string
  suggestedStage?: string
  confidence: "high" | "medium" | "low"
  reasoning: string
}

interface AnalysisResult {
  recommendations: PipelineRecommendation[]
  mappingSuggestions: MappingSuggestion[]
  summary: string
}

interface AIAnalysisDialogProps {
  onApplyRecommendations?: (recommendations: PipelineRecommendation[], mappings: MappingSuggestion[]) => void
}

export function AIAnalysisDialog({ onApplyRecommendations }: AIAnalysisDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    setAnalysis(null)

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Analysis failed")
      }

      const result = await response.json()
      setAnalysis(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (analysis && onApplyRecommendations) {
      onApplyRecommendations(analysis.recommendations, analysis.mappingSuggestions)
      setOpen(false)
    }
  }

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: "bg-green-500",
      medium: "bg-yellow-500",
      low: "bg-orange-500",
    }
    return <Badge className={colors[confidence as keyof typeof colors]}>{confidence}</Badge>
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-transparent">
          <Sparkles className="w-4 h-4" />
          AI Analysis
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI-Powered Pipeline Recommendations
          </DialogTitle>
          <DialogDescription>
            Let AI analyze your opportunities and suggest optimal pipeline structures
          </DialogDescription>
        </DialogHeader>

        {!analysis && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <TrendingUp className="w-16 h-16 text-muted-foreground" />
            <p className="text-center text-muted-foreground max-w-md">
              AI will analyze your opportunity titles, stages, and patterns to recommend pipeline structures and
              mappings
            </p>
            <Button onClick={handleAnalyze} size="lg" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Start Analysis
            </Button>
          </div>
        )}

        {loading && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4 animate-pulse" />
              Analyzing opportunities...
            </div>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {analysis && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {/* Summary */}
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{analysis.summary}</AlertDescription>
              </Alert>

              <Tabs defaultValue="pipelines">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="pipelines">
                    Pipeline Recommendations ({analysis.recommendations.length})
                  </TabsTrigger>
                  <TabsTrigger value="mappings">
                    Opportunity Mappings ({analysis.mappingSuggestions.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pipelines" className="space-y-4 mt-4">
                  {analysis.recommendations.map((rec, idx) => (
                    <Card key={idx}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle>{rec.pipelineName}</CardTitle>
                            <CardDescription>{rec.description}</CardDescription>
                          </div>
                          <Badge variant="secondary">{rec.estimatedCount} opportunities</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Stages */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Suggested Stages:</h4>
                          <div className="space-y-2">
                            {rec.stages
                              .sort((a, b) => a.order - b.order)
                              .map((stage, stageIdx) => (
                                <div key={stageIdx} className="flex gap-2 text-sm">
                                  <Badge variant="outline">{stage.order}</Badge>
                                  <div>
                                    <div className="font-medium">{stage.name}</div>
                                    <div className="text-muted-foreground text-xs">{stage.description}</div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Patterns */}
                        {rec.opportunityPatterns.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Identified Patterns:</h4>
                            <div className="flex flex-wrap gap-2">
                              {rec.opportunityPatterns.map((pattern, patternIdx) => (
                                <Badge key={patternIdx} variant="secondary">
                                  {pattern}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="mappings" className="space-y-3 mt-4">
                  {analysis.mappingSuggestions.map((suggestion, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base">{suggestion.opportunityTitle}</CardTitle>
                            <CardDescription className="text-sm mt-1">
                              → <span className="font-medium">{suggestion.suggestedPipeline}</span>
                              {suggestion.suggestedStage && (
                                <span className="text-muted-foreground"> / {suggestion.suggestedStage}</span>
                              )}
                            </CardDescription>
                          </div>
                          {getConfidenceBadge(suggestion.confidence)}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Close
                </Button>
                <Button onClick={handleApply} className="gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Apply Recommendations
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
