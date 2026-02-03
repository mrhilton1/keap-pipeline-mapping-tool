"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight, Plus, RefreshCw, Loader2, Check, X, Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface OpportunityField {
  name: string
  label: string
  type: string
  example?: any
}

interface CustomField {
  id: string
  name: string
  label: string
  description: string
  type: {
    discriminator: string
    primitive_type: string
  }
}

// Standard opportunity fields from v1 API
const OPPORTUNITY_FIELDS: OpportunityField[] = [
  { name: "opportunity_title", label: "Title", type: "TEXT" },
  { name: "opportunity_notes", label: "Notes", type: "LONG_TEXT" },
  { name: "next_action_notes", label: "Next Action Notes", type: "TEXT" },
  { name: "projected_revenue_high", label: "Revenue (High)", type: "CURRENCY" },
  { name: "projected_revenue_low", label: "Revenue (Low)", type: "CURRENCY" },
  { name: "estimated_close_date", label: "Estimated Close", type: "DATE" },
  { name: "date_created", label: "Date Created", type: "DATETIME" },
  { name: "last_updated", label: "Last Updated", type: "DATETIME" },
  { name: "contact.email", label: "Contact Email", type: "EMAIL" },
  { name: "contact.phone_number", label: "Contact Phone", type: "PHONE" },
  { name: "contact.company_name", label: "Company Name", type: "TEXT" },
  { name: "stage.name", label: "Stage Name", type: "TEXT" },
  { name: "user.first_name", label: "Assigned User", type: "NAME" },
]

// Standard deal fields in v2 API
const DEAL_STANDARD_FIELDS = [
  { name: "name", label: "Deal Name", type: "TEXT" },
  { name: "value", label: "Value (Amount)", type: "CURRENCY" },
  { name: "stage_id", label: "Stage", type: "REF" },
  { name: "contact_ids", label: "Contacts", type: "ARRAY" },
  { name: "estimated_close_time", label: "Estimated Close", type: "DATETIME" },
]

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
  { value: "TIME", label: "Time" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
  { value: "URL", label: "URL" },
  { value: "NAME", label: "Name" },
]

export function FieldMapper() {
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  
  // New field form
  const [newFieldName, setNewFieldName] = useState("")
  const [newFieldLabel, setNewFieldLabel] = useState("")
  const [newFieldDescription, setNewFieldDescription] = useState("")
  const [newFieldType, setNewFieldType] = useState("TEXT")

  const loadCustomFields = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/custom-fields")
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to load")
      }
      
      setCustomFields(data.custom_fields || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load custom fields")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomFields()
  }, [])

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
          name: newFieldName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, ""),
          label: newFieldLabel || newFieldName,
          description: newFieldDescription || `Custom field for ${newFieldLabel || newFieldName}`,
          primitiveType: newFieldType
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to create")
      }

      // Reset form and refresh list
      setNewFieldName("")
      setNewFieldLabel("")
      setNewFieldDescription("")
      setNewFieldType("TEXT")
      setShowCreateDialog(false)
      await loadCustomFields()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create custom field")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source: Opportunity Fields */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700">Source</Badge>
              Opportunity Fields (v1)
            </CardTitle>
            <CardDescription>
              Standard fields available on opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {OPPORTUNITY_FIELDS.map((field) => (
                    <TableRow key={field.name}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{field.label}</p>
                          <p className="text-xs text-muted-foreground font-mono">{field.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {field.type}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Destination: Deal Custom Fields */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700">Destination</Badge>
                  Deal Custom Fields (v2)
                </CardTitle>
                <CardDescription>
                  Custom fields to store migrated data
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={loadCustomFields}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Field
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Custom Field</DialogTitle>
                      <DialogDescription>
                        Create a new custom field for deals to store opportunity data
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
                          Letters, numbers, underscores only. Start with letter.
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
                      <div className="space-y-2">
                        <Label htmlFor="fieldDesc">Description (optional)</Label>
                        <Input
                          id="fieldDesc"
                          placeholder="What this field stores..."
                          value={newFieldDescription}
                          onChange={(e) => setNewFieldDescription(e.target.value)}
                        />
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
                          "Create Field"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Standard deal fields */}
                    {DEAL_STANDARD_FIELDS.map((field) => (
                      <TableRow key={field.name} className="bg-muted/30">
                        <TableCell>
                          <div>
                            <p className="font-medium">{field.label}</p>
                            <p className="text-xs text-muted-foreground font-mono">{field.name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {field.type}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Custom fields */}
                    {customFields.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                          No custom fields created yet.
                          <br />
                          <span className="text-xs">Click &quot;Add Field&quot; to create one.</span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      customFields.map((field) => (
                        <TableRow key={field.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{field.label}</p>
                              <p className="text-xs text-muted-foreground font-mono">{field.name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {field.type.primitive_type}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Field Mapping Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Migration Field Mapping</CardTitle>
          <CardDescription>
            How opportunity fields will map to deal fields during migration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <Badge variant="outline" className="mb-1">opportunity_title</Badge>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <Badge variant="secondary" className="mb-1">name</Badge>
              </div>
              <Check className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <Badge variant="outline" className="mb-1">projected_revenue_high</Badge>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <Badge variant="secondary" className="mb-1">value.amount</Badge>
              </div>
              <Check className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <Badge variant="outline" className="mb-1">contact.id</Badge>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <Badge variant="secondary" className="mb-1">contact_ids[]</Badge>
              </div>
              <Check className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <Badge variant="outline" className="mb-1">opportunity_notes</Badge>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                {customFields.find(f => f.name === "opportunityNotes") ? (
                  <Badge variant="secondary" className="mb-1">opportunityNotes</Badge>
                ) : (
                  <Badge variant="destructive" className="mb-1">No target field</Badge>
                )}
              </div>
              {customFields.find(f => f.name === "opportunityNotes") ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <X className="w-4 h-4 text-red-500" />
              )}
            </div>
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <Badge variant="outline" className="mb-1">id</Badge>
                <span className="text-xs text-muted-foreground ml-2">(for tracking)</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                {customFields.find(f => f.name === "originalOpportunityId") ? (
                  <Badge variant="secondary" className="mb-1">originalOpportunityId</Badge>
                ) : (
                  <Badge variant="destructive" className="mb-1">No target field</Badge>
                )}
              </div>
              {customFields.find(f => f.name === "originalOpportunityId") ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <X className="w-4 h-4 text-red-500" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
