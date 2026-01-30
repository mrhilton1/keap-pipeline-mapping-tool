"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Check, 
  Pencil, 
  ChevronDown, 
  ChevronRight,
  Loader2,
  Sparkles
} from "lucide-react"

export interface PipelineSuggestion {
  name: string
  stages: string[]
  description: string
  matchingOpportunities: string[]
}

interface PipelineBuilderProps {
  suggestions: PipelineSuggestion[]
  onSuggestionsChange: (suggestions: PipelineSuggestion[]) => void
  onCreatePipelines: (pipelines: PipelineSuggestion[]) => void
  isCreating: boolean
}

export function PipelineBuilder({ 
  suggestions, 
  onSuggestionsChange, 
  onCreatePipelines,
  isCreating 
}: PipelineBuilderProps) {
  const [expandedPipelines, setExpandedPipelines] = useState<Set<number>>(new Set([0]))
  const [editingPipeline, setEditingPipeline] = useState<number | null>(null)
  const [editingStage, setEditingStage] = useState<{ pipeline: number; stage: number } | null>(null)

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedPipelines)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedPipelines(newExpanded)
  }

  const updatePipelineName = (index: number, name: string) => {
    const newSuggestions = [...suggestions]
    newSuggestions[index] = { ...newSuggestions[index], name }
    onSuggestionsChange(newSuggestions)
  }

  const updateStageName = (pipelineIndex: number, stageIndex: number, name: string) => {
    const newSuggestions = [...suggestions]
    const newStages = [...newSuggestions[pipelineIndex].stages]
    newStages[stageIndex] = name
    newSuggestions[pipelineIndex] = { ...newSuggestions[pipelineIndex], stages: newStages }
    onSuggestionsChange(newSuggestions)
  }

  const addStage = (pipelineIndex: number) => {
    const newSuggestions = [...suggestions]
    newSuggestions[pipelineIndex].stages.push(`New Stage ${newSuggestions[pipelineIndex].stages.length + 1}`)
    onSuggestionsChange(newSuggestions)
  }

  const removeStage = (pipelineIndex: number, stageIndex: number) => {
    const newSuggestions = [...suggestions]
    newSuggestions[pipelineIndex].stages.splice(stageIndex, 1)
    onSuggestionsChange(newSuggestions)
  }

  const addPipeline = () => {
    const newPipeline: PipelineSuggestion = {
      name: `New Pipeline ${suggestions.length + 1}`,
      stages: ["Stage 1", "Stage 2", "Stage 3"],
      description: "Custom pipeline",
      matchingOpportunities: []
    }
    onSuggestionsChange([...suggestions, newPipeline])
    setExpandedPipelines(new Set([...expandedPipelines, suggestions.length]))
  }

  const removePipeline = (index: number) => {
    const newSuggestions = suggestions.filter((_, i) => i !== index)
    onSuggestionsChange(newSuggestions)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pipeline Structure</h3>
          <p className="text-sm text-muted-foreground">
            Edit the suggested structure before creating
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={addPipeline}>
          <Plus className="w-4 h-4 mr-1" />
          Add Pipeline
        </Button>
      </div>

      {suggestions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Click "Analyze with AI" to get pipeline suggestions</p>
            <p className="text-sm">or add pipelines manually</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {suggestions.map((pipeline, pIndex) => (
            <Card key={pIndex} className="overflow-hidden">
              <div 
                className="flex items-center gap-2 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpanded(pIndex)}
              >
                {expandedPipelines.has(pIndex) ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                
                {editingPipeline === pIndex ? (
                  <Input
                    value={pipeline.name}
                    onChange={(e) => updatePipelineName(pIndex, e.target.value)}
                    onBlur={() => setEditingPipeline(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingPipeline(null)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 w-48"
                    autoFocus
                  />
                ) : (
                  <span className="font-medium">{pipeline.name}</span>
                )}
                
                <Badge variant="secondary" className="ml-2">
                  {pipeline.stages.length} stages
                </Badge>
                
                {pipeline.matchingOpportunities.length > 0 && (
                  <Badge variant="outline" className="ml-1">
                    {pipeline.matchingOpportunities.length} opportunities
                  </Badge>
                )}
                
                <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => setEditingPipeline(pIndex)}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removePipeline(pIndex)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              
              {expandedPipelines.has(pIndex) && (
                <CardContent className="pt-3">
                  {pipeline.description && (
                    <p className="text-sm text-muted-foreground mb-3">{pipeline.description}</p>
                  )}
                  
                  <div className="space-y-2">
                    {pipeline.stages.map((stage, sIndex) => (
                      <div 
                        key={sIndex} 
                        className="flex items-center gap-2 p-2 rounded-md bg-muted/20 group"
                      >
                        <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                          {sIndex + 1}
                        </div>
                        
                        {editingStage?.pipeline === pIndex && editingStage?.stage === sIndex ? (
                          <Input
                            value={stage}
                            onChange={(e) => updateStageName(pIndex, sIndex, e.target.value)}
                            onBlur={() => setEditingStage(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingStage(null)}
                            className="h-7 flex-1"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="flex-1 cursor-pointer hover:text-primary"
                            onClick={() => setEditingStage({ pipeline: pIndex, stage: sIndex })}
                          >
                            {stage}
                          </span>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={() => removeStage(pIndex, sIndex)}
                          disabled={pipeline.stages.length <= 1}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full mt-2"
                      onClick={() => addStage(pIndex)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Stage
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <Button 
          className="w-full" 
          size="lg"
          onClick={() => onCreatePipelines(suggestions)}
          disabled={isCreating}
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating Pipelines...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Create {suggestions.length} Pipeline{suggestions.length > 1 ? 's' : ''}
            </>
          )}
        </Button>
      )}
    </div>
  )
}
