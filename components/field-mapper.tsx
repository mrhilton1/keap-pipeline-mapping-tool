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
  { name: "contacts.id", label: "Primary Contact", type: "REF", isCustom: false },
  { name: "owner_id", label: "Deal Owner", type: "REF", isCustom: false },
  { name: "estimated_close_time", label: "Estimated Close", type: "DATETIME", isCustom: false },
  { name: "status", label: "Status", type: "TEXT", isCustom: false },
]

// Special mapping targets that require different handling
const SPECIAL_DEAL_FIELDS: DealField[] = [
  { name: "_deal_notes", label: "Add as Deal Note", type: "LONG_TEXT", isCustom: false },
  { name: "_stage_mapping", label: "Map to Pipeline Stage", type: "STAGE", isCustom: false },
]

// Descriptions for standard fields to explain what they do
const FIELD_DESCRIPTIONS: Record<string, string> = {
  "contacts.id": "Links contact by ID, displays name",
  "owner_id": "Links user by ID, displays name",
  "value.amount": "Numeric value only",
  "value.currency": "e.g., USD",
  "_deal_notes": "Creates note via /v2/deals/{id}/notes API",
  "_stage_mapping": "Select pipeline & stage below",
}

// Fields to hide from source list (not useful for migration)
const HIDDEN_SOURCE_FIELDS = [
  "id",                    // Opportunity ID - not needed
  "affiliate_id",          // Internal
  "stage.id",              // Use stage.name with pipeline mapping instead
  "stage.details.check_list_items",
]

// Default mappings - opportunity field → deal field
const DEFAULT_MAPPINGS: Record<string, string> = {
  "opportunity_title": "name",
  "projected_revenue_high": "value.amount",
  "contact.id": "contacts.id",           // Contact ID → Primary Contact
  "user.id": "owner_id",                  // User ID → Deal Owner
  "estimated_close_date": "estimated_close_time",
  "stage.name": "_stage_mapping",         // Stage name → Pipeline stage selector
  "opportunity_notes": "_deal_notes",     // Notes → Deal notes API
  "next_action_notes": "_deal_notes",     // Next action notes → Deal notes API
}

interface FieldMapperProps {
  opportunities: Opportunity[]
}

export function FieldMapper({ opportunities }: FieldMapperProps) {
  const [customFields, setCustomFields] = useState<DealField[]>([])
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
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

  // Load custom fields from Keap
  const loadCustomFields = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/custom-fields")
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to load")
      }
      
      const fields = (data.custom_fields || []).map((f: any) => ({
        name: f.name,
        label: f.label,
        type: f.type.primitive_type,
        isCustom: true,
        id: f.id
      }))
      
      setCustomFields(fields)
      
      // Initialize mappings with defaults
      const initialMappings = discoveredFields.map(df => ({
        sourceField: df.path,
        targetField: DEFAULT_MAPPINGS[df.path] || null
      }))
      setMappings(initialMappings)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load custom fields")
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

  // Update a mapping
  const updateMapping = (sourceField: string, targetField: string | null) => {
    setMappings(prev => {
      const existing = prev.find(m => m.sourceField === sourceField)
      if (existing) {
        return prev.map(m => m.sourceField === sourceField ? { ...m, targetField } : m)
      }
      return [...prev, { sourceField, targetField }]
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

  // Count mapped fields
  const mappedCount = mappings.filter(m => m.targetField).length
  const totalFields = discoveredFields.length

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
        <Button variant="outline" size="sm" onClick={loadCustomFields} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

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
                                {currentMapping ? (
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
