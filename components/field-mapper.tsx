"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowRight, Plus, RefreshCw, Loader2, Check, X, Link2, Unlink } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Opportunity } from "./opportunities-panel"

interface DiscoveredField {
  path: string
  label: string
  type: string
  sampleValues: string[]
  count: number  // How many opportunities have this field
}

interface DealField {
  name: string
  label: string
  type: string
  isCustom: boolean
  id?: string
}

interface FieldMapping {
  sourceField: string
  targetField: string | null
}

interface Pipeline {
  id: string
  name: string
  stages?: Stage[]
}

interface Stage {
  id: string
  name: string
  pipeline_id?: string
  order?: number
}

// Individual mapping from opportunity stage name to target stage
interface PerStageMapping {
  opportunityStageName: string  // The stage name from opportunities (case-insensitive key)
  opportunityCount: number      // How many opportunities have this stage
  targetStageId: string | null  // The mapped target stage ID
  targetStageName: string | null // The mapped target stage name
  isAutoMatched: boolean        // True if auto-matched by name
}

interface StageMapping {
  pipelineId: string | null
  pipelineName: string | null
  stageId: string | null        // Legacy: fallback stage ID
  stageName: string | null      // Legacy: fallback stage name
  // New: per-stage mappings
  perStageMappings: PerStageMapping[]
  fallbackStageId: string | null
  fallbackStageName: string | null
}

interface KeapUser {
  id: number
  email_address?: string
  given_name?: string
  family_name?: string
}

interface OwnerMapping {
  userId: number | null
  userName: string | null
}

const FIELD_TYPES = [
  { value: "TEXT", label: "Text (short)" },
  { value: "LONG_TEXT", label: "Text (long)" },
  { value: "INTEGER", label: "Integer" },
  { value: "NUMBER", label: "Number" },
  { value: "DECIMAL", label: "Decimal" },
  { value: "CURRENCY", label: "Currency" },
  { value: "PERCENT", label: "Percent" },
  { value: "BOOLEAN", label: "Yes/No" },
  { value: "DATE", label: "Date" },
  { value: "DATETIME", label: "Date & Time" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
  { value: "URL", label: "URL" },
]

// Standard deal fields (v2 API) - matches POST /v2/deals schema
const STANDARD_DEAL_FIELDS: DealField[] = [
  { name: "name", label: "Deal Name", type: "TEXT", isCustom: false },
  { name: "value.amount", label: "Value (Amount)", type: "NUMBER", isCustom: false },
  { name: "value.currency", label: "Value (Currency)", type: "TEXT", isCustom: false },
  { name: "contacts.id", label: "Primary Contact (1:1)", type: "REF", isCustom: false },
  { name: "owner_id", label: "Keep Original Owner", type: "REF", isCustom: false },
  { name: "estimated_close_time", label: "Estimated Close", type: "DATETIME", isCustom: false },
  { name: "closed_time", label: "Actual Close Date", type: "DATETIME", isCustom: false },
  { name: "created_time", label: "Created Time", type: "DATETIME", isCustom: false },
  { name: "last_updated_time", label: "Last Updated Time", type: "DATETIME", isCustom: false },
  { name: "status", label: "Status", type: "TEXT", isCustom: false },
]

// Special mapping targets that require different handling
const SPECIAL_DEAL_FIELDS: DealField[] = [
  { name: "value.average", label: "Value (Average)", type: "NUMBER", isCustom: false }, // Averages low & high revenue
  { name: "_deal_notes", label: "Add as Deal Note", type: "LONG_TEXT", isCustom: false },
  { name: "_products_note", label: "Add Products as Deal Note", type: "PRODUCTS", isCustom: false }, // Products → formatted note
  { name: "_stage_mapping", label: "Smart Stage Mapping", type: "STAGE", isCustom: false },
  { name: "_owner_mapping", label: "⚠️ Assign ALL to Same Owner", type: "USER", isCustom: false },
]

// Descriptions for standard fields to explain what they do
const FIELD_DESCRIPTIONS: Record<string, string> = {
  "contacts.id": "Each deal gets its own contact (by ID)",
  "owner_id": "Each deal keeps its original owner from the opportunity",
  "value.amount": "Numeric value only",
  "value.average": "Averages Low & High revenue (auto-links both fields)",
  "value.currency": "e.g., USD",
  "estimated_close_time": "Projected/estimated close date",
  "closed_time": "When deal was actually closed (WON/LOST date)",
  "created_time": "Preserve original creation date from opportunity",
  "last_updated_time": "Preserve last updated date from opportunity",
  "_deal_notes": "Creates note via /v2/deals/{id}/notes API",
  "_products_note": "Products formatted as deal note (name, qty, price)",
  "_stage_mapping": "Auto-match stages by name, map unmatched manually",
  "_owner_mapping": "⚠️ OVERRIDE: All deals assigned to ONE selected owner",
}

// Fields to hide from source list (not useful for migration)
const HIDDEN_SOURCE_FIELDS = [
  "id",                    // Opportunity ID - not needed
  "affiliate_id",          // Internal
  "stage.id",              // Use stage.name with pipeline mapping instead
  "stage.details.check_list_items",
  "stage.details.stage_order", // Not needed for migration
  "stage.details.probability",
  "stage.details.target_num_days",
  // User fields - use user.id with owner mapping instead
  "user.first_name",
  "user.last_name",
  // Contact fields - use contact.id with primary contact mapping instead
  "contact.email",
  "contact.first_name",
  "contact.last_name",
  "contact.company_name",
  // Stage move fields - outcome name not needed, lastUpdated is duplicate of last_updated
  "stageMoves.outcome",       // WON/LOST - not a mappable field
  "stageMoves.lastUpdated",   // Duplicate of REST API last_updated
  "stageMoves.moves",         // Raw moves array - not directly mappable
  "contact.phone_number",
  "contact.job_title",
]

// Revenue fields that can be averaged
const REVENUE_FIELDS = ["projected_revenue_low", "projected_revenue_high"]

// Default mappings - opportunity field → deal field
const DEFAULT_MAPPINGS: Record<string, string> = {
  "opportunity_title": "name",
  "projected_revenue_high": "value.average",  // Both revenue fields → average
  "projected_revenue_low": "value.average",   // Both revenue fields → average
  "contact.id": "contacts.id",           // Contact ID → Primary Contact
  "user.id": "owner_id",                 // User ID → Keep Original Owner (default)
  "estimated_close_date": "estimated_close_time",
  "stageMoves.outcomeDate": "closed_time",  // WON/LOST date → Actual Close Date
  "stageMoves.history": "_deal_notes",   // Stage history → Deal notes API
  "date_created": "created_time",        // Preserve original creation date
  "last_updated": "last_updated_time",   // Preserve last updated date
  "stage.name": "_stage_mapping",         // Stage name → Smart Pipeline stage mapping
  "opportunity_notes": "_deal_notes",     // Notes → Deal notes API
  "next_action_notes": "_deal_notes",     // Next action notes → Deal notes API
  "products": "_products_note",           // Products → formatted deal note
}

// Exported types for parent state management
export interface PerStageMappingExport {
  opportunityStageName: string
  opportunityCount: number
  targetStageId: string | null
  targetStageName: string | null
  isAutoMatched: boolean
}

export interface StageMappingExport {
  pipelineId: string | null
  pipelineName: string | null
  perStageMappings: PerStageMappingExport[]
  fallbackStageId: string | null
  fallbackStageName: string | null
}

export interface FieldMappingConfig {
  mappings: FieldMapping[]
  stageMapping: StageMapping
  ownerMapping: OwnerMapping
}

interface FieldMapperProps {
  opportunities: Opportunity[]
  pipelines?: Pipeline[]
  // Optional: pre-select a pipeline (from "Use Existing" flow)
  initialPipeline?: Pipeline | null
  // Optional: pass in saved config to persist across tab switches
  savedConfig?: FieldMappingConfig | null
  onConfigChange?: (config: FieldMappingConfig) => void
}

export function FieldMapper({ opportunities, pipelines: propPipelines, initialPipeline, savedConfig, onConfigChange }: FieldMapperProps) {
  const [customFields, setCustomFields] = useState<DealField[]>([])
  const [mappings, setMappings] = useState<FieldMapping[]>(savedConfig?.mappings || [])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)
  
  // Pipelines for stage mapping
  const [pipelines, setPipelines] = useState<Pipeline[]>(propPipelines || [])
  const [stageMapping, setStageMappingState] = useState<StageMapping>(() => {
    const saved = savedConfig?.stageMapping
    return {
      pipelineId: saved?.pipelineId || null,
      pipelineName: saved?.pipelineName || null,
      stageId: saved?.stageId || null,
      stageName: saved?.stageName || null,
      perStageMappings: saved?.perStageMappings || [],
      fallbackStageId: saved?.fallbackStageId || null,
      fallbackStageName: saved?.fallbackStageName || null
    }
  })
  
  // Users for owner mapping
  const [users, setUsers] = useState<KeapUser[]>([])
  const [ownerMapping, setOwnerMappingState] = useState<OwnerMapping>(savedConfig?.ownerMapping || {
    userId: null,
    userName: null
  })

  // Wrapper to notify parent of stage mapping changes
  const setStageMapping = (value: StageMapping | ((prev: StageMapping) => StageMapping)) => {
    setStageMappingState(prev => {
      const newVal = typeof value === 'function' ? value(prev) : value
      return newVal
    })
  }

  // Wrapper to notify parent of owner mapping changes  
  const setOwnerMapping = (value: OwnerMapping | ((prev: OwnerMapping) => OwnerMapping)) => {
    setOwnerMappingState(prev => {
      const newVal = typeof value === 'function' ? value(prev) : value
      return newVal
    })
  }

  // Notify parent of config changes
  useEffect(() => {
    if (configLoaded && onConfigChange) {
      onConfigChange({ mappings, stageMapping, ownerMapping })
    }
  }, [mappings, stageMapping, ownerMapping, configLoaded, onConfigChange])
  
  // Create field dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createForSource, setCreateForSource] = useState<string | null>(null)
  const [newFieldName, setNewFieldName] = useState("")
  const [newFieldLabel, setNewFieldLabel] = useState("")
  const [newFieldType, setNewFieldType] = useState("TEXT")

  // Discover fields from actual opportunity data
  const discoveredFields = useMemo(() => {
    const fieldMap = new Map<string, DiscoveredField>()
    
    const processValue = (path: string, value: any, label: string) => {
      if (value === null || value === undefined) return
      
      const existing = fieldMap.get(path)
      const sampleStr = typeof value === 'object' ? JSON.stringify(value) : String(value)
      const type = inferType(value)
      
      if (existing) {
        existing.count++
        if (existing.sampleValues.length < 3 && !existing.sampleValues.includes(sampleStr)) {
          existing.sampleValues.push(sampleStr.substring(0, 50))
        }
      } else {
        fieldMap.set(path, {
          path,
          label,
          type,
          sampleValues: [sampleStr.substring(0, 50)],
          count: 1
        })
      }
    }
    
    const inferType = (value: any): string => {
      if (typeof value === 'number') return value % 1 === 0 ? 'INTEGER' : 'DECIMAL'
      if (typeof value === 'boolean') return 'BOOLEAN'
      if (typeof value === 'string') {
        if (value.includes('@')) return 'EMAIL'
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'DATETIME'
        if (value.length > 100) return 'LONG_TEXT'
        return 'TEXT'
      }
      return 'TEXT'
    }
    
    const processObject = (obj: any, prefix: string, labelPrefix: string) => {
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'custom_fields' && Array.isArray(value)) {
          // Handle custom fields specially
          value.forEach((cf: any) => {
            const path = `custom_fields[${cf.id}]`
            processValue(path, cf.content, `Custom Field #${cf.id}`)
          })
        } else if (key === 'products' && Array.isArray(value)) {
          // Handle products array as a single mappable field
          if (value.length > 0) {
            const existing = fieldMap.get('products')
            const existingSamples = existing?.sampleValues || []
            const productNames = value
              .slice(0, 3)
              .map((p: any) => p.ProductName || `Product #${p.ProductId}`)
              .join(', ')
            const sample = value.length > 3 ? `${productNames}...` : productNames
            fieldMap.set('products', {
              path: 'products',
              label: 'Products (Line Items)',
              type: 'PRODUCTS',
              sampleValues: existingSamples.length < 3 ? [...existingSamples, `${value.length} items: ${sample}`] : existingSamples,
              count: (existing?.count || 0) + 1
            })
          }
        } else if (key === 'stageMoves' && value && typeof value === 'object') {
          // Handle stageMoves object specially - expose all useful fields
          
          // Outcome Date (WON/LOST date)
          if (value.outcomeDate) {
            const existing = fieldMap.get('stageMoves.outcomeDate')
            const existingSamples = existing?.sampleValues || []
            fieldMap.set('stageMoves.outcomeDate', {
              path: 'stageMoves.outcomeDate',
              label: 'Stage Moves → Outcome Date',
              type: 'TEXT',
              sampleValues: existingSamples.length < 3 ? [...existingSamples, value.outcomeDate.substring(0, 50)] : existingSamples,
              count: (existing?.count || 0) + 1
            })
          }
          
          // Last Updated (last stage move date)
          if (value.lastUpdated) {
            const existing = fieldMap.get('stageMoves.lastUpdated')
            const existingSamples = existing?.sampleValues || []
            fieldMap.set('stageMoves.lastUpdated', {
              path: 'stageMoves.lastUpdated',
              label: 'Stage Moves → Last Updated',
              type: 'TEXT',
              sampleValues: existingSamples.length < 3 ? [...existingSamples, value.lastUpdated.substring(0, 50)] : existingSamples,
              count: (existing?.count || 0) + 1
            })
          }
          
          // Outcome (WON/LOST)
          if (value.outcome) {
            const existing = fieldMap.get('stageMoves.outcome')
            const existingSamples = existing?.sampleValues || []
            fieldMap.set('stageMoves.outcome', {
              path: 'stageMoves.outcome',
              label: 'Stage Moves → Outcome (WON/LOST)',
              type: 'TEXT',
              sampleValues: existingSamples.length < 3 ? [...existingSamples, value.outcome] : existingSamples,
              count: (existing?.count || 0) + 1
            })
          }
          
          // Stage History (full formatted history for notes)
          const moves = Array.isArray(value) ? value : (value.moves || [])
          if (moves.length > 0) {
            const existing = fieldMap.get('stageMoves.history')
            const existingSamples = existing?.sampleValues || []
            const historyPreview = moves.slice(0, 2).map((m: any) => 
              `${m.MoveFromStageName || '?'} → ${m.MoveToStageName || '?'}`
            ).join(', ')
            const sample = moves.length > 2 ? `${historyPreview}... (${moves.length} moves)` : historyPreview
            
            fieldMap.set('stageMoves.history', {
              path: 'stageMoves.history',
              label: 'Stage Moves → Full History',
              type: 'LONG_TEXT',
              sampleValues: existingSamples.length < 3 ? [...existingSamples, sample] : existingSamples,
              count: (existing?.count || 0) + 1
            })
          }
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Nested object
          processObject(value, `${prefix}${key}.`, `${labelPrefix}${formatLabel(key)} → `)
        } else if (!Array.isArray(value)) {
          // Simple value
          const path = `${prefix}${key}`
          processValue(path, value, `${labelPrefix}${formatLabel(key)}`)
        }
      }
    }
    
    const formatLabel = (key: string): string => {
      return key
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
        .trim()
    }
    
    opportunities.forEach(opp => {
      processObject(opp, '', '')
    })
    
    // Sort by count (most common first) and filter out hidden/noise fields
    return Array.from(fieldMap.values())
      .filter(f => !HIDDEN_SOURCE_FIELDS.some(hidden => f.path === hidden || f.path.startsWith(hidden + '.')))
      .sort((a, b) => b.count - a.count)
  }, [opportunities])

  // Load custom fields, pipelines, and users from Keap
  const loadCustomFields = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch custom fields, pipelines, and users in parallel
      const [customFieldsRes, pipelinesRes, usersRes] = await Promise.all([
        fetch("/api/custom-fields"),
        fetch("/api/pipelines"),
        fetch("/api/users")
      ])
      
      const customFieldsData = await customFieldsRes.json()
      const pipelinesData = await pipelinesRes.json()
      const usersData = await usersRes.json()
      
      if (!customFieldsRes.ok) {
        throw new Error(customFieldsData.error || customFieldsData.details || "Failed to load custom fields")
      }
      
      const fields = (customFieldsData.custom_fields || []).map((f: any) => ({
        name: f.name,
        label: f.label,
        type: f.type.primitive_type,
        isCustom: true,
        id: f.id
      }))
      
      setCustomFields(fields)
      
      // Set pipelines if loaded
      if (pipelinesRes.ok && pipelinesData.pipelines) {
        setPipelines(pipelinesData.pipelines)
      }
      
      // Set users if loaded
      if (usersRes.ok && usersData.users) {
        setUsers(usersData.users)
      }
      
      // Initialize mappings with defaults (only if no saved config)
      if (!savedConfig?.mappings?.length) {
        const initialMappings = discoveredFields.map(df => ({
          sourceField: df.path,
          targetField: DEFAULT_MAPPINGS[df.path] || null
        }))
        setMappings(initialMappings)
      }
      
      setConfigLoaded(true)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomFields()
  }, [discoveredFields])

  // All available deal fields (standard + special + custom)
  const allDealFields = useMemo(() => {
    return [...STANDARD_DEAL_FIELDS, ...SPECIAL_DEAL_FIELDS, ...customFields]
  }, [customFields])

  // Update a mapping with special handling for revenue fields
  const updateMapping = (sourceField: string, targetField: string | null) => {
    setMappings(prev => {
      let newMappings = [...prev]
      
      // Find or create the mapping for this source field
      const existingIndex = newMappings.findIndex(m => m.sourceField === sourceField)
      if (existingIndex >= 0) {
        newMappings[existingIndex] = { ...newMappings[existingIndex], targetField }
      } else {
        newMappings.push({ sourceField, targetField })
      }
      
      // Special handling for revenue fields
      const isRevenueField = REVENUE_FIELDS.includes(sourceField)
      const otherRevenueField = sourceField === "projected_revenue_low" 
        ? "projected_revenue_high" 
        : "projected_revenue_low"
      
      if (isRevenueField && targetField) {
        // Case 1: Mapping to value.average - auto-link the other revenue field
        if (targetField === "value.average") {
          const otherIndex = newMappings.findIndex(m => m.sourceField === otherRevenueField)
          if (otherIndex >= 0) {
            newMappings[otherIndex] = { ...newMappings[otherIndex], targetField: "value.average" }
          } else {
            newMappings.push({ sourceField: otherRevenueField, targetField: "value.average" })
          }
        }
        
        // Case 2: Mapping to value.amount - check if other is also value.amount
        if (targetField === "value.amount") {
          const otherMapping = newMappings.find(m => m.sourceField === otherRevenueField)
          if (otherMapping?.targetField === "value.amount") {
            // Both mapped to value.amount - auto-change both to value.average
            newMappings = newMappings.map(m => {
              if (REVENUE_FIELDS.includes(m.sourceField) && m.targetField === "value.amount") {
                return { ...m, targetField: "value.average" }
              }
              return m
            })
          }
        }
      }
      
      return newMappings
    })
  }

  // Get current mapping for a source field
  const getMapping = (sourceField: string): string | null => {
    return mappings.find(m => m.sourceField === sourceField)?.targetField || null
  }

  // Open create dialog for a specific source field
  const openCreateDialog = (sourceField: string, suggestedLabel: string, suggestedType: string) => {
    setCreateForSource(sourceField)
    setNewFieldName(sourceField.replace(/[.\[\]]/g, '_').replace(/__+/g, '_'))
    setNewFieldLabel(suggestedLabel)
    setNewFieldType(suggestedType)
    setShowCreateDialog(true)
  }

  // Create custom field
  const createCustomField = async () => {
    if (!newFieldName.trim()) {
      setError("Field name is required")
      return
    }

    try {
      setCreating(true)
      setError(null)

      const res = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFieldName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").replace(/^[0-9]/, "_$&"),
          label: newFieldLabel || newFieldName,
          description: `Mapped from opportunity field: ${createForSource}`,
          primitiveType: newFieldType
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to create")
      }

      // Add to custom fields and auto-map
      const newField: DealField = {
        name: data.name,
        label: data.label,
        type: data.type.primitive_type,
        isCustom: true,
        id: data.id
      }
      setCustomFields(prev => [...prev, newField])
      
      // Auto-map to the new field
      if (createForSource) {
        updateMapping(createForSource, newField.name)
      }

      // Reset form
      setNewFieldName("")
      setNewFieldLabel("")
      setNewFieldType("TEXT")
      setCreateForSource(null)
      setShowCreateDialog(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create custom field")
    } finally {
      setCreating(false)
    }
  }

  // Get stages for the selected pipeline
  const selectedPipeline = pipelines.find(p => p.id === stageMapping.pipelineId)
  const availableStages = selectedPipeline?.stages || []

  // Compute unique opportunity stage names with counts
  const opportunityStages = useMemo(() => {
    const stageMap = new Map<string, { name: string; count: number }>()
    opportunities.forEach(opp => {
      const stageName = opp.stage?.name
      if (stageName) {
        const key = stageName.toLowerCase() // Case-insensitive key
        const existing = stageMap.get(key)
        if (existing) {
          existing.count++
        } else {
          stageMap.set(key, { name: stageName, count: 1 })
        }
      }
    })
    return Array.from(stageMap.values()).sort((a, b) => b.count - a.count)
  }, [opportunities])

  // Pre-select pipeline if passed from parent (Use Existing flow)
  useEffect(() => {
    if (initialPipeline && !stageMapping.pipelineId && opportunityStages.length > 0) {
      // Auto-select the pipeline and compute smart stage mapping
      const pipelineStages = initialPipeline.stages || []
      
      // Compute auto-matched stages
      const perStageMappings = opportunityStages.map(oppStage => {
        const matchedStage = pipelineStages.find(
          ps => (ps.name || '').toLowerCase() === (oppStage.name || '').toLowerCase()
        )
        return {
          opportunityStageName: oppStage.name || '',
          opportunityCount: oppStage.count || 0,
          targetStageId: matchedStage?.id || null,
          targetStageName: matchedStage?.name || null,
          isAutoMatched: !!matchedStage
        }
      })
      
      console.log("[FieldMapper] Pre-selecting pipeline:", initialPipeline.name)
      console.log("[FieldMapper] Computed perStageMappings:", perStageMappings)
      
      setStageMapping({
        pipelineId: initialPipeline.id,
        pipelineName: initialPipeline.name,
        stageId: null,
        stageName: null,
        perStageMappings,
        fallbackStageId: null,
        fallbackStageName: null
      })
    }
  }, [initialPipeline, opportunityStages])

  // Compute auto-matched and unmatched stages when pipeline changes
  const computePerStageMappings = (pipelineStages: Stage[]): PerStageMapping[] => {
    return opportunityStages.map(oppStage => {
      // Try to find a matching stage (case-insensitive)
      const matchedStage = pipelineStages.find(
        ps => (ps.name || '').toLowerCase() === (oppStage.name || '').toLowerCase()
      )
      return {
        opportunityStageName: oppStage.name || '',
        opportunityCount: oppStage.count || 0,
        targetStageId: matchedStage?.id || null,
        targetStageName: matchedStage?.name || null,
        isAutoMatched: !!matchedStage
      }
    })
  }

  // Handle pipeline selection - auto-compute stage mappings
  const handlePipelineChange = (pipelineId: string) => {
    const pipeline = pipelines.find(p => p.id === pipelineId)
    const pipelineStages = pipeline?.stages || []
    const perStageMappings = computePerStageMappings(pipelineStages)
    
    setStageMapping({
      pipelineId,
      pipelineName: pipeline?.name || null,
      stageId: null,
      stageName: null,
      perStageMappings,
      fallbackStageId: null,
      fallbackStageName: null
    })
  }

  // Handle stage selection (legacy - for fallback)
  const handleStageChange = (stageId: string) => {
    const stage = availableStages.find(s => s.id === stageId)
    setStageMapping(prev => ({
      ...prev,
      stageId,
      stageName: stage?.name || null
    }))
  }

  // Handle per-stage mapping change
  const handlePerStageMappingChange = (opportunityStageName: string, targetStageId: string | null) => {
    const stage = targetStageId ? availableStages.find(s => s.id === targetStageId) : null
    setStageMapping(prev => ({
      ...prev,
      perStageMappings: prev.perStageMappings.map(psm => 
        psm.opportunityStageName === opportunityStageName
          ? { ...psm, targetStageId, targetStageName: stage?.name || null, isAutoMatched: false }
          : psm
      )
    }))
  }

  // Handle fallback stage selection
  const handleFallbackStageChange = (stageId: string | null) => {
    const stage = stageId ? availableStages.find(s => s.id === stageId) : null
    setStageMapping(prev => ({
      ...prev,
      fallbackStageId: stageId,
      fallbackStageName: stage?.name || null
    }))
  }

  // Computed stats for stage mapping
  const perStageMappingsArray = stageMapping.perStageMappings || []
  const autoMatchedStages = perStageMappingsArray.filter(p => p.isAutoMatched)
  const unmatchedStages = perStageMappingsArray.filter(p => !p.isAutoMatched && !p.targetStageId)
  const manuallyMappedStages = perStageMappingsArray.filter(p => !p.isAutoMatched && p.targetStageId)
  
  // Count opportunities that would be skipped (unmatched + no fallback)
  const skippedOpportunityCount = stageMapping.fallbackStageId 
    ? 0 
    : unmatchedStages.reduce((sum, s) => sum + s.opportunityCount, 0)

  // Handle owner (user) selection
  const handleOwnerChange = (userId: string) => {
    const user = users.find(u => u.id.toString() === userId)
    const userName = user 
      ? `${user.given_name || ''} ${user.family_name || ''}`.trim() || user.email_address || 'Unknown'
      : null
    setOwnerMapping({
      userId: user?.id || null,
      userName
    })
  }

  // Count mapped fields
  const mappedCount = mappings.filter(m => m.targetField).length
  const totalFields = discoveredFields.length
  
  // Check if stage mapping is configured
  const hasStageMappingField = mappings.some(m => m.targetField === "_stage_mapping")
  const isStageMappingComplete = stageMapping.pipelineId && stageMapping.stageId

  if (opportunities.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No opportunities loaded.</p>
        <p className="text-sm">Load opportunities to discover available fields.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Field Mapping</h3>
          <p className="text-sm text-muted-foreground">
            {mappedCount} of {totalFields} fields mapped • Discovered from {opportunities.length} opportunities
          </p>
        </div>
        <div className="flex items-center gap-3">
          {configLoaded && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Auto-saved
            </span>
          )}
          <Button variant="outline" size="sm" onClick={loadCustomFields} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Info about special mappings */}
      <Alert className="bg-blue-50/50 border-blue-200">
        <AlertDescription className="text-sm">
          Most fields are mapped 1-to-1 (each deal gets its own value). For Stage and Owner, you can assign all deals to the same destination OR keep the original values.
        </AlertDescription>
      </Alert>

      {/* Mapping Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="text-left p-3 font-medium text-sm">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">Source</Badge>
                    <span className="ml-2">Opportunity Field</span>
                  </th>
                  <th className="w-10"></th>
                  <th className="text-left p-3 font-medium text-sm">
                    <Badge variant="outline" className="bg-green-50 text-green-700">Target</Badge>
                    <span className="ml-2">Deal Field</span>
                  </th>
                  <th className="w-32 p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : (
                  discoveredFields.map((field) => {
                    const currentMapping = getMapping(field.path)
                    const targetField = allDealFields.find(f => f.name === currentMapping)
                    
                    return (
                      <tr key={field.path} className="hover:bg-muted/30">
                        {/* Source field */}
                        <td className="p-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{field.label}</span>
                              <Badge variant="secondary" className="text-[10px]">{field.type}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">{field.path}</p>
                            {field.sampleValues.length > 0 && (
                              <p className="text-xs text-muted-foreground truncate max-w-xs">
                                e.g., {field.sampleValues[0]}
                              </p>
                            )}
                            <Badge variant="outline" className="text-[10px]">
                              {field.count}/{opportunities.length} records
                            </Badge>
                          </div>
                        </td>
                        
                        {/* Arrow */}
                        <td className="text-center">
                          {currentMapping ? (
                            <Link2 className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <Unlink className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                          )}
                        </td>
                        
                        {/* Target field selector */}
                        <td className="p-3">
                          <Select
                            value={currentMapping || "unmapped"}
                            onValueChange={(v) => updateMapping(field.path, v === "unmapped" ? null : v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {currentMapping === "_stage_mapping" ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-blue-700">
                                      {stageMapping.pipelineName 
                                        ? `${stageMapping.pipelineName} (${autoMatchedStages.length + manuallyMappedStages.length}/${opportunityStages.length} mapped)`
                                        : "Smart Stage Mapping"
                                      }
                                    </span>
                                    {stageMapping.pipelineId && (
                                      <Badge variant="outline" className={`text-[10px] ${unmatchedStages.length > 0 && !stageMapping.fallbackStageId ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                                        {unmatchedStages.length > 0 && !stageMapping.fallbackStageId ? `${skippedOpportunityCount} will skip` : 'Ready'}
                                      </Badge>
                                    )}
                                  </div>
                                ) : currentMapping === "_owner_mapping" ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-purple-700">
                                      {ownerMapping.userName 
                                        ? `Owner: ${ownerMapping.userName}`
                                        : "Select Deal Owner"
                                      }
                                    </span>
                                    {ownerMapping.userId && (
                                      <Badge variant="outline" className="text-[10px] bg-purple-50">Configured</Badge>
                                    )}
                                  </div>
                                ) : currentMapping ? (
                                  <div className="flex items-center gap-2">
                                    <span>{targetField?.label || currentMapping}</span>
                                    {targetField?.isCustom && (
                                      <Badge variant="secondary" className="text-[10px]">Custom</Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Not mapped</span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent 
                              position="popper" 
                              sideOffset={4}
                              className="max-h-[350px] overflow-y-auto z-50"
                            >
                              <SelectItem value="unmapped">
                                <span className="text-muted-foreground">— Not mapped —</span>
                              </SelectItem>
                              
                              {/* Standard Deal Fields */}
                              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                                Standard Deal Fields
                              </div>
                              {STANDARD_DEAL_FIELDS.map(df => (
                                <SelectItem key={df.name} value={df.name}>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <span>{df.label}</span>
                                      <Badge variant="outline" className="text-[9px]">{df.type}</Badge>
                                    </div>
                                    {FIELD_DESCRIPTIONS[df.name] && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {FIELD_DESCRIPTIONS[df.name]}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                              
                              {/* Special Mappings */}
                              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-blue-50 border-t mt-1">
                                ✨ Special Mappings
                              </div>
                              {SPECIAL_DEAL_FIELDS.map(df => (
                                <SelectItem key={df.name} value={df.name}>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <span className="text-blue-700">{df.label}</span>
                                      <Badge variant="outline" className="text-[9px] bg-blue-50">{df.type}</Badge>
                                    </div>
                                    {FIELD_DESCRIPTIONS[df.name] && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {FIELD_DESCRIPTIONS[df.name]}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                              
                              {/* Custom Fields */}
                              {customFields.length > 0 && (
                                <>
                                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-green-50 border-t mt-1">
                                    Custom Fields
                                  </div>
                                  {customFields.map(df => (
                                    <SelectItem key={df.name} value={df.name}>
                                      <div className="flex items-center justify-between w-full gap-2">
                                        <span>{df.label}</span>
                                        <Badge variant="secondary" className="text-[9px] ml-2">{df.type}</Badge>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                          
                          {/* Smart Stage Mapping - shown when _stage_mapping is selected */}
                          {currentMapping === "_stage_mapping" && (
                            <div className="mt-2 p-3 bg-blue-50/50 rounded border border-blue-100 space-y-3">
                              {/* Pipeline selector */}
                              <div>
                                <Label className="text-xs font-medium mb-1 block">Target Pipeline</Label>
                                <Select
                                  value={stageMapping.pipelineId || ""}
                                  onValueChange={handlePipelineChange}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-white">
                                    <SelectValue placeholder="Select target pipeline..." />
                                  </SelectTrigger>
                                  <SelectContent position="popper" className="max-h-[200px]">
                                    {pipelines.length === 0 ? (
                                      <div className="px-2 py-2 text-center text-xs text-muted-foreground">
                                        No pipelines available
                                      </div>
                                    ) : (
                                      pipelines.map(p => (
                                        <SelectItem key={p.id} value={p.id} className="text-xs">
                                          {p.name} ({p.stages?.length || 0} stages)
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {/* Stage mapping details - shown after pipeline selected */}
                              {stageMapping.pipelineId && (
                                <div className="space-y-2">
                                  {/* Auto-matched stages */}
                                  {autoMatchedStages.length > 0 && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1 text-xs font-medium text-green-700">
                                        <Check className="w-3 h-3" />
                                        Auto-Matched ({autoMatchedStages.length})
                                      </div>
                                      <div className="pl-4 space-y-0.5">
                                        {autoMatchedStages.map(psm => (
                                          <div key={psm.opportunityStageName} className="flex items-center gap-2 text-[11px] text-green-700">
                                            <span>"{psm.opportunityStageName}"</span>
                                            <span className="text-muted-foreground">({psm.opportunityCount})</span>
                                            <ArrowRight className="w-3 h-3" />
                                            <span className="font-medium">{psm.targetStageName}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Manually mapped stages */}
                                  {manuallyMappedStages.length > 0 && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1 text-xs font-medium text-blue-700">
                                        <Link2 className="w-3 h-3" />
                                        Manually Mapped ({manuallyMappedStages.length})
                                      </div>
                                      <div className="pl-4 space-y-1">
                                        {manuallyMappedStages.map(psm => (
                                          <div key={psm.opportunityStageName} className="flex items-center gap-2 text-[11px]">
                                            <span className="text-muted-foreground">"{psm.opportunityStageName}"</span>
                                            <span className="text-muted-foreground">({psm.opportunityCount})</span>
                                            <ArrowRight className="w-3 h-3 text-blue-500" />
                                            <Select
                                              value={psm.targetStageId || ""}
                                              onValueChange={(v) => handlePerStageMappingChange(psm.opportunityStageName, v || null)}
                                            >
                                              <SelectTrigger className="h-6 text-[11px] bg-white w-32">
                                                <SelectValue>{psm.targetStageName}</SelectValue>
                                              </SelectTrigger>
                                              <SelectContent position="popper" className="max-h-[150px]">
                                                <SelectItem value="" className="text-[11px] text-muted-foreground">— Unmapped —</SelectItem>
                                                {availableStages.map(s => (
                                                  <SelectItem key={s.id} value={s.id} className="text-[11px]">{s.name}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Unmatched stages - need mapping */}
                                  {unmatchedStages.length > 0 && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1 text-xs font-medium text-amber-700">
                                        <X className="w-3 h-3" />
                                        Needs Mapping ({unmatchedStages.length})
                                      </div>
                                      <div className="pl-4 space-y-1">
                                        {unmatchedStages.map(psm => (
                                          <div key={psm.opportunityStageName} className="flex items-center gap-2 text-[11px]">
                                            <span className="text-amber-700">"{psm.opportunityStageName}"</span>
                                            <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700">
                                              {psm.opportunityCount} opps
                                            </Badge>
                                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                            <Select
                                              value=""
                                              onValueChange={(v) => handlePerStageMappingChange(psm.opportunityStageName, v)}
                                            >
                                              <SelectTrigger className="h-6 text-[11px] bg-white w-32 border-amber-300">
                                                <SelectValue placeholder="Select stage..." />
                                              </SelectTrigger>
                                              <SelectContent position="popper" className="max-h-[150px]">
                                                {availableStages.map(s => (
                                                  <SelectItem key={s.id} value={s.id} className="text-[11px]">{s.name}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Fallback stage */}
                                  <div className="pt-2 border-t border-blue-200">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-xs font-medium">Fallback Stage (for unmapped)</Label>
                                      {unmatchedStages.length > 0 && !stageMapping.fallbackStageId && (
                                        <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700">
                                          {skippedOpportunityCount} will be skipped
                                        </Badge>
                                      )}
                                    </div>
                                    <Select
                                      value={stageMapping.fallbackStageId || "none"}
                                      onValueChange={(v) => handleFallbackStageChange(v === "none" ? null : v)}
                                    >
                                      <SelectTrigger className="h-8 text-xs bg-white mt-1">
                                        <SelectValue placeholder="No fallback (skip unmapped)" />
                                      </SelectTrigger>
                                      <SelectContent position="popper" className="max-h-[150px]">
                                        <SelectItem value="none" className="text-xs text-muted-foreground">
                                          No fallback — skip unmapped opportunities
                                        </SelectItem>
                                        {availableStages.map(s => (
                                          <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  {/* Summary */}
                                  <div className="pt-2 text-[10px] text-muted-foreground bg-white/50 rounded p-2 -mx-1">
                                    <div className="flex items-center justify-between">
                                      <span>
                                        <strong>{autoMatchedStages.reduce((s, p) => s + p.opportunityCount, 0)}</strong> auto-matched, 
                                        <strong className="ml-1">{manuallyMappedStages.reduce((s, p) => s + p.opportunityCount, 0)}</strong> manually mapped
                                        {skippedOpportunityCount > 0 && (
                                          <span className="text-amber-700 ml-1">
                                            , <strong>{skippedOpportunityCount}</strong> will skip
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Owner selector - shown when _owner_mapping is selected */}
                          {currentMapping === "_owner_mapping" && (
                            <div className="mt-2 p-2 bg-amber-50/50 rounded border border-amber-200 space-y-2">
                              {/* Warning callout */}
                              <div className="flex items-start gap-2 p-2 bg-amber-100/50 rounded text-[11px] text-amber-800">
                                <span className="text-amber-600 text-base leading-none">⚠️</span>
                                <div>
                                  <strong>Override Mode:</strong> ALL deals will be assigned to the selected owner, 
                                  replacing any original owner from Keap.
                                  <br />
                                  <span className="text-amber-600">Use "Keap Original Owner" to preserve existing owners.</span>
                                </div>
                              </div>
                              
                              <Select
                                value={ownerMapping.userId?.toString() || ""}
                                onValueChange={handleOwnerChange}
                              >
                                <SelectTrigger className="h-8 text-xs bg-white border-amber-300">
                                  <SelectValue placeholder="Select owner for ALL deals..." />
                                </SelectTrigger>
                                <SelectContent position="popper" className="max-h-[250px] w-[280px]">
                                  {users.length === 0 ? (
                                    <div className="px-2 py-2 text-center text-xs text-muted-foreground">
                                      No users found
                                    </div>
                                  ) : (
                                    users.map(user => {
                                      const fullName = `${user.given_name || ''} ${user.family_name || ''}`.trim()
                                      return (
                                        <SelectItem key={user.id} value={user.id.toString()} className="text-xs">
                                          <div className="flex flex-col">
                                            <span className="font-medium">{fullName || 'No name'}</span>
                                            <span className="text-[10px] text-muted-foreground">{user.email_address || `ID: ${user.id}`}</span>
                                          </div>
                                        </SelectItem>
                                      )
                                    })
                                  )}
                                </SelectContent>
                              </Select>
                              
                              {/* Show selected owner */}
                              {ownerMapping.userName && (
                                <div className="flex items-center gap-1 text-[10px] text-amber-700 font-medium">
                                  <Check className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">⚠️ ALL {opportunities.length} deals → {ownerMapping.userName}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        
                        {/* Create button */}
                        <td className="p-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => openCreateDialog(field.path, field.label, field.type)}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Create Field
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Field Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Deal Field</DialogTitle>
            <DialogDescription>
              Create a new custom field to store data from: <code className="bg-muted px-1 rounded">{createForSource}</code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fieldName">Field Name (API)</Label>
              <Input
                id="fieldName"
                placeholder="e.g., originalNotes"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Letters, numbers, underscores only. Must start with letter.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fieldLabel">Display Label</Label>
              <Input
                id="fieldLabel"
                placeholder="e.g., Original Notes"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fieldType">Field Type</Label>
              <Select value={newFieldType} onValueChange={setNewFieldType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createCustomField} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create & Map"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
