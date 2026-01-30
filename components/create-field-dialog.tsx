"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function CreateFieldDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false)
  const [fieldName, setFieldName] = useState("")
  const [fieldType, setFieldType] = useState("TEXT")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/fields/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: fieldName,
          field_type: fieldType,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create field")
      }

      toast({
        title: "Field Created",
        description: `Successfully created custom field "${fieldName}"`,
      })

      setOpen(false)
      setFieldName("")
      setFieldType("TEXT")
      onSuccess?.()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create field. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-transparent">
          <Plus className="w-4 h-4" />
          Create Custom Field
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Custom Deal Field</DialogTitle>
            <DialogDescription>Add a new custom field to track additional information on your deals</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="field-name">Field Name</Label>
              <Input
                id="field-name"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="e.g., Lead Source, Industry"
                required
              />
            </div>

            <div>
              <Label htmlFor="field-type">Field Type</Label>
              <Select value={fieldType} onValueChange={setFieldType}>
                <SelectTrigger id="field-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEXT">Text</SelectItem>
                  <SelectItem value="TEXTAREA">Text Area</SelectItem>
                  <SelectItem value="NUMBER">Number</SelectItem>
                  <SelectItem value="DATE">Date</SelectItem>
                  <SelectItem value="DROPDOWN">Dropdown</SelectItem>
                  <SelectItem value="CURRENCY">Currency</SelectItem>
                  <SelectItem value="PERCENT">Percent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !fieldName.trim()}>
              {loading ? "Creating..." : "Create Field"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
