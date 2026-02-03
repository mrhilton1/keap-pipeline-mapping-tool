"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, ChevronDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StageOption {
  name: string
  order?: number
  count?: number // How many opportunities use this stage
  isCustom?: boolean // Indicates this was created by user
}

interface StageSelectorProps {
  value: string
  onChange: (value: string) => void
  onCreateStage?: (stageName: string) => void // Callback when a new stage is created
  availableStages: StageOption[]
  placeholder?: string
  className?: string
}

export function StageSelector({ 
  value, 
  onChange,
  onCreateStage,
  availableStages,
  placeholder = "Select or create stage...",
  className
}: StageSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [openUpward, setOpenUpward] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Check position and determine if dropdown should open upward
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const dropdownHeight = 240 // max-h-60 = 15rem = 240px
      
      // Open upward if not enough space below but enough above
      setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > dropdownHeight)
    }
  }, [open])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
        setSearch("")
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Filter stages based on search
  const filteredStages = availableStages.filter(stage =>
    stage.name.toLowerCase().includes(search.toLowerCase())
  )

  // Check if search term matches any existing stage exactly
  const exactMatch = availableStages.some(
    stage => stage.name.toLowerCase() === search.toLowerCase()
  )

  // Show create option if search has value and no exact match
  const showCreateOption = search.trim() !== "" && !exactMatch

  const handleSelect = (stageName: string) => {
    onChange(stageName)
    setOpen(false)
    setSearch("")
  }

  const handleCreate = () => {
    if (search.trim()) {
      const newStageName = search.trim()
      onChange(newStageName)
      // Notify parent to add this to the available stages
      if (onCreateStage) {
        onCreateStage(newStageName)
      }
      setOpen(false)
      setSearch("")
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={open ? search : value}
          onChange={(e) => {
            setSearch(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-7 pr-8"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-7 w-7 hover:bg-transparent"
          onClick={() => setOpen(!open)}
        >
          <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
        </Button>
      </div>

      {open && (
        <div 
          ref={dropdownRef}
          className={cn(
            "absolute z-50 left-0 right-0 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto",
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          )}
        >
          {/* Create custom option - always at top when searching */}
          {showCreateOption && (
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left border-b"
              onClick={handleCreate}
            >
              <Plus className="w-4 h-4 text-primary" />
              <span>Create "<span className="font-medium">{search}</span>"</span>
            </button>
          )}

          {/* Existing stages */}
          {filteredStages.length === 0 && !showCreateOption ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No stages found. Type to create a custom stage.
            </div>
          ) : (
            filteredStages.map((stage, index) => (
              <button
                key={index}
                type="button"
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left",
                  value === stage.name && "bg-accent"
                )}
                onClick={() => handleSelect(stage.name)}
              >
                <div className="flex items-center gap-2">
                  {value === stage.name && <Check className="w-3 h-3 text-primary" />}
                  <span className={value === stage.name ? "font-medium" : ""}>{stage.name}</span>
                  {stage.isCustom && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">custom</span>
                  )}
                </div>
                {stage.count !== undefined && stage.count > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {stage.count} opp{stage.count !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
