import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { KeapClient } from "@/lib/keap-client"

// GET - List all custom fields
export async function GET() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const client = new KeapClient(accessToken.value)
    const customFields = await client.getCustomFields()
    
    console.log("[Custom Fields API] Found:", customFields.custom_fields?.length || 0, "fields")
    
    return NextResponse.json(customFields)
  } catch (error) {
    console.error("[Custom Fields API] Error:", error)
    return NextResponse.json({ 
      error: "Failed to fetch custom fields",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// POST - Create a new custom field
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("keap_access_token")

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { name, label, description, primitiveType } = body

    if (!name || !primitiveType) {
      return NextResponse.json({ 
        error: "Invalid request",
        details: "Required: { name: string, label?: string, description?: string, primitiveType: string }"
      }, { status: 400 })
    }

    // Validate name format (alphanumeric starting with letter)
    if (!/^[a-zA-Z]\w*$/.test(name)) {
      return NextResponse.json({
        error: "Invalid field name",
        details: "Name must start with a letter and contain only letters, numbers, and underscores"
      }, { status: 400 })
    }

    const client = new KeapClient(accessToken.value)
    const customField = await client.createCustomField({
      name,
      label: label || name,
      description: description || `Custom field: ${label || name}`,
      primitiveType: primitiveType.toUpperCase()
    })

    console.log("[Custom Fields API] Created field:", customField.id, customField.name)

    return NextResponse.json(customField)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[Custom Fields API] Error creating field:", errorMessage)
    
    // Handle conflict (field already exists)
    if (errorMessage.includes("409") || errorMessage.includes("Conflict")) {
      return NextResponse.json({
        error: "Custom field already exists",
        details: "A custom field with this name already exists"
      }, { status: 409 })
    }
    
    return NextResponse.json({ 
      error: "Failed to create custom field",
      details: errorMessage
    }, { status: 500 })
  }
}
