"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Check, 
  ChevronDown, 
  ChevronRight,
  Loader2,
  MoreVertical,
  Sparkles
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StageSelector, StageOption } from "./stage-selector"

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
  onAnalyzeWithAI?: () => void
  isCreating: boolean
  isAnalyzing?: boolean
  availableStages: StageOption[]
  onStageCreated?: (stageName: string) => void // Callback when a custom stage is created
}

export function PipelineBuilder({ 
  suggestions, 
  onSuggestionsChange, 
  onCreatePipelines,
  onAnalyzeWithAI,
  isCreating,
  isAnalyzing,
  availableStages,
  onStageCreated
}: PipelineBuilderProps) {
  const [expandedPipelines, setExpandedPipelines] = useState<Set<number>>(new Set([0]))

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
    newSuggestions[pipelineIndex].stages.push("")
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
      stages: [""],
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pipeline Structure</h3>
          <p className="text-sm text-muted-foreground">
            Edit the suggested structure before creating
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addPipeline}>
            <Plus className="w-4 h-4 mr-1" />
            Add Pipeline
          </Button>
          
          {/* Subtle AI option in dropdown */}
          {onAnalyzeWithAI && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={onAnalyzeWithAI}
                  disabled={isAnalyzing}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {isAnalyzing ? "Analyzing..." : "Analyze with AI"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Pipeline cards */}
      <div className="space-y-3">
        {suggestions.map((pipeline, pIndex) => (
          <Card key={pIndex} className="overflow-hidden">
            <div 
              className="flex items-center gap-2 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleExpanded(pIndex)}
            >
              {expandedPipelines.has(pIndex) ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              
              {/* Pipeline name input */}
              <Input
                value={pipeline.name}
                onChange={(e) => updatePipelineName(pIndex, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="h-8 w-48 font-medium"
                placeholder="Pipeline name..."
              />
              
              <Badge variant="secondary" className="flex-shrink-0">
                {pipeline.stages.filter(s => s.trim()).length} stages
              </Badge>
              
              {pipeline.matchingOpportunities.length > 0 && (
                <Badge variant="outline" className="flex-shrink-0">
                  {pipeline.matchingOpportunities.length} opportunities
                </Badge>
              )}
              
              <div className="ml-auto flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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
                <p className="text-xs text-muted-foreground mb-3">
                  Edit the stage names below, or use the defaults. All pipelines will be created in your Keap account.
                </p>
                
                <div className="space-y-2">
                  {pipeline.stages.map((stage, sIndex) => (
                    <div 
                      key={sIndex} 
                      className="flex items-center gap-2 p-2 rounded-md bg-muted/20 group"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 cursor-grab" />
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium flex-shrink-0">
                        {sIndex + 1}
                      </div>
                      
                      {/* Stage selector with search & create */}
                      <StageSelector
                        value={stage}
                        onChange={(value) => updateStageName(pIndex, sIndex, value)}
                        onCreateStage={onStageCreated}
                        availableStages={availableStages}
                        placeholder="Select or type stage name..."
                        className="flex-1"
                      />
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive flex-shrink-0"
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
                    className="w-full mt-2 border-dashed border"
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

      {/* Create button */}
      {suggestions.length > 0 && suggestions.some(p => p.stages.some(s => s.trim())) && (
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
