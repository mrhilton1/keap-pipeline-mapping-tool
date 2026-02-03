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
}

interface StageSelectorProps {
  value: string
  onChange: (value: string) => void
  availableStages: StageOption[]
  placeholder?: string
  className?: string
}

export function StageSelector({ 
  value, 
  onChange, 
  availableStages,
  placeholder = "Select or create stage...",
  className
}: StageSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
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
      onChange(search.trim())
      setOpen(false)
      setSearch("")
    }
  }

  return (
    <div className={cn("relative", className)}>
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
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto"
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
