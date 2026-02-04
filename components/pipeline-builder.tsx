"use client"

import { useState, useRef } from "react"
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
import { cn } from "@/lib/utils"

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
  onStageCreated?: (stageName: string) => void
  existingPipelineNames?: string[]  // Names of pipelines that already exist
}

export function PipelineBuilder({ 
  suggestions, 
  onSuggestionsChange, 
  onCreatePipelines,
  onAnalyzeWithAI,
  isCreating,
  isAnalyzing,
  availableStages,
  onStageCreated,
  existingPipelineNames = []
}: PipelineBuilderProps) {
  const [expandedPipelines, setExpandedPipelines] = useState<Set<number>>(new Set([0]))
  
  // Check which pipelines already exist (case-insensitive)
  const existingNamesLower = existingPipelineNames.map(n => n.toLowerCase())
  const getPipelineExists = (name: string) => existingNamesLower.includes(name.toLowerCase().trim())
  
  // Count how many pipelines can be created (don't exist yet)
  const creatablePipelines = suggestions.filter(p => 
    p.name.trim() && 
    p.stages.some(s => s.trim()) && 
    !getPipelineExists(p.name)
  )
  
  // Drag state
  const [dragState, setDragState] = useState<{
    pipelineIndex: number
    stageIndex: number
  } | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    pipelineIndex: number
    stageIndex: number
  } | null>(null)
  
  const dragNodeRef = useRef<HTMLDivElement | null>(null)

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

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, pipelineIndex: number, stageIndex: number) => {
    setDragState({ pipelineIndex, stageIndex })
    dragNodeRef.current = e.currentTarget as HTMLDivElement
    
    // Add slight delay for visual feedback
    setTimeout(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = '0.5'
      }
    }, 0)
    
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', '') // Required for Firefox
  }

  const handleDragOver = (e: React.DragEvent, pipelineIndex: number, stageIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    // Only allow dropping within same pipeline
    if (dragState && dragState.pipelineIndex === pipelineIndex) {
      setDropTarget({ pipelineIndex, stageIndex })
    }
  }

  const handleDragLeave = () => {
    // Don't clear immediately to prevent flickering
  }

  const moveStage = (pipelineIndex: number, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    
    const newSuggestions = [...suggestions]
    const stages = [...newSuggestions[pipelineIndex].stages]
    
    // Remove the stage from original position
    const [movedStage] = stages.splice(fromIndex, 1)
    
    // Insert at target position (no adjustment needed - splice handles it)
    stages.splice(toIndex, 0, movedStage)
    
    newSuggestions[pipelineIndex] = { 
      ...newSuggestions[pipelineIndex], 
      stages 
    }
    
    console.log("[Drag] Reorder:", fromIndex, "→", toIndex, "Result:", stages.map((s, i) => `${i}:${s}`))
    onSuggestionsChange(newSuggestions)
  }

  const handleDrop = (e: React.DragEvent, pipelineIndex: number, stageIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!dragState || dragState.pipelineIndex !== pipelineIndex) {
      setDragState(null)
      setDropTarget(null)
      return
    }

    moveStage(pipelineIndex, dragState.stageIndex, stageIndex)
    
    setDragState(null)
    setDropTarget(null)
  }

  const handleDragEnd = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '1'
    }
    setDragState(null)
    setDropTarget(null)
    dragNodeRef.current = null
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
                className={`h-8 w-48 font-medium ${getPipelineExists(pipeline.name) ? 'border-amber-400 bg-amber-50' : ''}`}
                placeholder="Pipeline name..."
              />
              
              {/* Already exists warning */}
              {getPipelineExists(pipeline.name) && (
                <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300 flex-shrink-0">
                  Already Exists
                </Badge>
              )}
              
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
                  Drag stages to reorder. Edit names or use the defaults. All pipelines will be created in your Keap account.
                </p>
                
                <div className="space-y-1">
                  {pipeline.stages.map((stage, sIndex) => {
                    const isDragging = dragState?.pipelineIndex === pIndex && dragState?.stageIndex === sIndex
                    const isDropTarget = dropTarget?.pipelineIndex === pIndex && dropTarget?.stageIndex === sIndex
                    const showDropIndicator = isDropTarget && dragState && dragState.stageIndex !== sIndex
                    
                    return (
                      <div key={`stage-${pIndex}-${sIndex}`}>
                        {/* Drop indicator above */}
                        {showDropIndicator && dragState.stageIndex > sIndex && (
                          <div className="h-1 bg-primary rounded-full mx-2 mb-1 animate-pulse" />
                        )}
                        
                        <div 
                          draggable
                          onDragStart={(e) => handleDragStart(e, pIndex, sIndex)}
                          onDragOver={(e) => handleDragOver(e, pIndex, sIndex)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, pIndex, sIndex)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-md bg-muted/20 group transition-all",
                            isDragging && "opacity-50 scale-[0.98] shadow-lg ring-2 ring-primary/50",
                            isDropTarget && !isDragging && "bg-primary/10"
                          )}
                        >
                          <GripVertical 
                            className={cn(
                              "w-4 h-4 text-muted-foreground/50 flex-shrink-0 cursor-grab active:cursor-grabbing",
                              "hover:text-muted-foreground transition-colors"
                            )} 
                          />
                          <div className={cn(
                            "w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium flex-shrink-0",
                            "transition-transform",
                            isDragging && "scale-110"
                          )}>
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
                        
                        {/* Drop indicator below */}
                        {showDropIndicator && dragState.stageIndex < sIndex && (
                          <div className="h-1 bg-primary rounded-full mx-2 mt-1 animate-pulse" />
                        )}
                      </div>
                    )
                  })}
                  
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
          onClick={() => onCreatePipelines(creatablePipelines)}
          disabled={isCreating || creatablePipelines.length === 0}
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating Pipelines...
            </>
          ) : creatablePipelines.length === 0 ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              All Pipelines Already Exist
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Create {creatablePipelines.length} Pipeline{creatablePipelines.length > 1 ? 's' : ''}
              {creatablePipelines.length < suggestions.length && (
                <span className="text-xs opacity-70 ml-1">
                  ({suggestions.length - creatablePipelines.length} already exist)
                </span>
              )}
            </>
          )}
        </Button>
      )}
    </div>
  )
}
