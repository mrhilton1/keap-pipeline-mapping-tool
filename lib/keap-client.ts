export interface KeapTokens {
  accessToken: string
  refreshToken?: string
}

// ============ Legacy v1 API Types (Opportunities) ============
export interface KeapOpportunity {
  id: string
  opportunity_title: string
  opportunity_notes?: string
  next_action_notes?: string
  contact?: {
    id: string
    first_name?: string
    last_name?: string
    email?: string
    phone_number?: string
    company_name?: string
    job_title?: string
  }
  projected_revenue_high?: number
  projected_revenue_low?: number
  estimated_close_date?: string
  stage?: {
    id: string
    name: string
    details?: {
      probability?: number
      stage_order?: number
      target_num_days?: number
    }
  }
  user?: {
    id: number
    first_name?: string
    last_name?: string
  }
  next_action_date?: string
  date_created?: string
  last_updated?: string
  affiliate_id?: number
  custom_fields?: Array<{
    id: number
    content: any
  }>
}

export interface KeapOpportunitiesResponse {
  opportunities: KeapOpportunity[]
  count: number
  next?: string
}

export interface KeapUser {
  id: number
  email_address?: string
  given_name?: string
  family_name?: string
  partner?: boolean
  status?: string
}

// ============ New v2 API Types (Pipelines, Stages, Deals) ============
export interface KeapPipeline {
  id: string
  name: string
}

export interface KeapPipelinesResponse {
  next_page_token?: string
  pipelines: KeapPipeline[]
}

export interface KeapStage {
  id: string
  name: string
  pipeline_id?: string
  order?: number
}

export interface KeapStagesResponse {
  next_page_token?: string
  stages: KeapStage[]
}

export interface KeapDeal {
  id: string
  name: string
  stage_id: string
  contact_id?: string
  value?: number
  currency?: string
  custom_fields?: Record<string, any>
}

export interface KeapDealsResponse {
  next_page_token?: string
  deals: KeapDeal[]
}

export interface CreatePipelineRequest {
  name: string
  stages: string[]  // Required! Array of stage names (at least 1)
}

export interface BulkCreateStagesRequest {
  stages: Array<{ name: string; order: number }>
}

export interface CreateDealRequest {
  name: string
  stage_id: string
  status: "OPEN" | "WON" | "LOST"        // Required
  owners: Array<{ id: string }>           // Required - array with owner IDs
  task_ids: string[]                      // Required (can be empty)
  value: {                                // Required
    amount: number
    currency: string
  }
  contacts: Array<{ id: string; primary_contact: boolean }>  // Required
  estimated_close_time?: string
  created_time?: string                   // Original creation date
  last_updated_time?: string              // Original last updated date
  custom_fields?: Record<string, any>
}

export interface CreateDealNoteRequest {
  body: string
  created_by?: string       // Owner ID who created the note
  created_time?: string     // ISO timestamp - may or may not be writable
}

export interface KeapDealNote {
  id: string
  deal_id: string
  body: string
  created_by?: string
  created_time?: string
  modified_time?: string
}

// Pipeline Outcomes
export interface KeapPipelineOutcome {
  id: string
  stage_id: string
  stage_name?: string
  outcome_type: "WON" | "LOST"
}

export interface KeapPipelineOutcomesResponse {
  outcomes: KeapPipelineOutcome[]
}

// Custom Field Types
export interface KeapCustomField {
  id: string
  name: string
  label: string
  description: string
  type: {
    discriminator: "SIMPLE" | "ARRAY" | "REF"
    primitive_type: string
    array?: any
    ref?: any
  }
  validators: any[]
  options?: any
  helper_text?: string
  default_value?: any
  display_options?: any
}

export interface KeapCustomFieldsResponse {
  next_page_token?: string
  custom_fields: KeapCustomField[]
}

export interface CreateCustomFieldRequest {
  name: string
  label: string
  description: string
  primitiveType: string  // TEXT, INTEGER, NUMBER, BOOLEAN, etc.
}

export class KeapClient {
  private accessToken: string
  // Legacy API for opportunities
  private legacyBaseUrl = "https://api.infusionsoft.com/crm/rest/v1"
  // New v2 Pipelines API - CORRECT URL: /services/v2/ (not slaapi.keapapis.com!)
  private pipelinesBaseUrl = "https://api.infusionsoft.com/services/v2"

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async request<T>(baseUrl: string, endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${baseUrl}${endpoint}`
    console.log(`[Keap API] ${options?.method || 'GET'} ${url}`)
    
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })

    const responseText = await response.text()
    console.log(`[Keap API] Response status: ${response.status}`)
    
    if (!response.ok) {
      console.error(`[Keap API] Error response: ${responseText}`)
      let errorMessage = `Keap API error: ${response.status} ${response.statusText}`
      try {
        const errorJson = JSON.parse(responseText)
        errorMessage = errorJson.message || errorJson.error || errorMessage
      } catch {
        // Use status text if not JSON
      }
      throw new Error(errorMessage)
    }

    try {
      return JSON.parse(responseText) as T
    } catch {
      console.error(`[Keap API] Failed to parse JSON: ${responseText}`)
      throw new Error('Failed to parse Keap API response')
    }
  }

  // ============ Legacy v1 API Methods (Opportunities) ============
  
  async getOpportunities(limit = 1000): Promise<KeapOpportunitiesResponse> {
    // Include custom_fields in the response
    return this.request<KeapOpportunitiesResponse>(
      this.legacyBaseUrl, 
      `/opportunities?limit=${limit}&optional_properties=custom_fields`,
      { method: "GET" }
    )
  }

  async getOpportunity(id: string): Promise<KeapOpportunity> {
    return this.request<KeapOpportunity>(
      this.legacyBaseUrl,
      `/opportunities/${id}`,
      { method: "GET" }
    )
  }

  // v1 Pipelines (fallback - returns array of pipelines with stages)
  async getV1Pipelines(): Promise<any[]> {
    return this.request<any[]>(
      this.legacyBaseUrl,
      `/opportunity/stage_pipeline`,
      { method: "GET" }
    )
  }

  // v1 Users - fetches all users in the Keap account
  async getUsers(): Promise<KeapUser[]> {
    const response = await this.request<{ users: KeapUser[] }>(
      this.legacyBaseUrl,
      `/users`,
      { method: "GET" }
    )
    return response.users || []
  }

  // ============ New v2 API Methods (Pipelines) ============

  async getPipelines(pageSize = 100): Promise<KeapPipelinesResponse> {
    return this.request<KeapPipelinesResponse>(
      this.pipelinesBaseUrl,
      `/pipelines?page_size=${pageSize}`,
      { method: "GET" }
    )
  }

  async createPipeline(data: CreatePipelineRequest): Promise<KeapPipeline> {
    // v2 API requires stages as array of strings (at least 1)
    const stages = data.stages && data.stages.length > 0 
      ? data.stages 
      : ["Stage 1"]  // Default stage if none provided
    
    return this.request<KeapPipeline>(
      this.pipelinesBaseUrl,
      "/pipelines/",  // Note: trailing slash required
      { 
        method: "POST",
        body: JSON.stringify({ 
          name: data.name,
          stages: stages
        })
      }
    )
  }

  async bulkCreateStages(pipelineId: string, stages: string[]): Promise<{ stages: KeapStage[] }> {
    const stagesWithOrder = stages.map((name, index) => ({
      name,
      order: index + 1
    }))
    
    return this.request<{ stages: KeapStage[] }>(
      this.pipelinesBaseUrl,
      `/pipelines/${pipelineId}/stages/bulk`,
      {
        method: "POST",
        body: JSON.stringify({ stages: stagesWithOrder })
      }
    )
  }

  async getPipelineStages(pipelineId: string): Promise<KeapStagesResponse> {
    return this.request<KeapStagesResponse>(
      this.pipelinesBaseUrl,
      `/pipelines/${pipelineId}/stages`,
      { method: "GET" }
    )
  }

  async getPipelineOutcomes(pipelineId: string): Promise<KeapPipelineOutcomesResponse> {
    return this.request<KeapPipelineOutcomesResponse>(
      this.pipelinesBaseUrl,
      `/pipelines/${pipelineId}/outcomes`,
      { method: "GET" }
    )
  }

  // ============ New v2 API Methods (Stages) ============

  async getStages(pageSize = 100): Promise<KeapStagesResponse> {
    return this.request<KeapStagesResponse>(
      this.pipelinesBaseUrl,
      `/stages?page_size=${pageSize}`,
      { method: "GET" }
    )
  }

  async createStage(data: { name: string; pipeline_id: string; order?: number }): Promise<KeapStage> {
    return this.request<KeapStage>(
      this.pipelinesBaseUrl,
      "/stages",
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    )
  }

  // ============ New v2 API Methods (Deals) ============

  async getDeals(pageSize = 100): Promise<KeapDealsResponse> {
    return this.request<KeapDealsResponse>(
      this.pipelinesBaseUrl,
      `/deals?page_size=${pageSize}`,
      { method: "GET" }
    )
  }

  async createDeal(data: CreateDealRequest): Promise<KeapDeal> {
    return this.request<KeapDeal>(
      this.pipelinesBaseUrl,
      "/deals",
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    )
  }

  async createDealsBulk(deals: CreateDealRequest[]): Promise<{ deals: KeapDeal[] }> {
    return this.request<{ deals: KeapDeal[] }>(
      this.pipelinesBaseUrl,
      "/deals/bulk",
      {
        method: "POST",
        body: JSON.stringify({ deals })
      }
    )
  }

  async moveDeal(dealId: string, stageId: string): Promise<KeapDeal> {
    return this.request<KeapDeal>(
      this.pipelinesBaseUrl,
      `/deals/${dealId}:move`,
      {
        method: "POST",
        body: JSON.stringify({ stage_id: stageId })
      }
    )
  }

  async getDealsForStage(stageId: string): Promise<KeapDealsResponse> {
    return this.request<KeapDealsResponse>(
      this.pipelinesBaseUrl,
      `/stages/${stageId}/deals`,
      { method: "GET" }
    )
  }

  async createDealNote(dealId: string, data: CreateDealNoteRequest): Promise<KeapDealNote> {
    return this.request<KeapDealNote>(
      this.pipelinesBaseUrl,
      `/deals/${dealId}/notes`,
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    )
  }

  // ============ Custom Fields API Methods ============

  async getCustomFields(pageSize = 100): Promise<KeapCustomFieldsResponse> {
    return this.request<KeapCustomFieldsResponse>(
      this.pipelinesBaseUrl,
      `/customFields/?page_size=${pageSize}`,
      { method: "GET" }
    )
  }

  async createCustomField(data: CreateCustomFieldRequest): Promise<KeapCustomField> {
    return this.request<KeapCustomField>(
      this.pipelinesBaseUrl,
      "/customFields/",
      {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          label: data.label,
          description: data.description,
          type: {
            discriminator: "SIMPLE",
            primitive_type: data.primitiveType
          },
          validators: []
        })
      }
    )
  }

  async deleteCustomField(fieldId: string): Promise<void> {
    return this.request<void>(
      this.pipelinesBaseUrl,
      `/customFields/${fieldId}`,
      { method: "DELETE" }
    )
  }
}
