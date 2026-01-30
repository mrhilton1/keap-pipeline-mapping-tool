export interface KeapTokens {
  accessToken: string
  refreshToken?: string
}

export interface KeapOpportunity {
  id: string
  opportunity_title: string
  contact?: {
    id: string
    first_name?: string
    last_name?: string
    email?: string
  }
  projected_revenue_high?: number
  projected_revenue_low?: number
  stage?: {
    id: string
    name: string
  }
  next_action_date?: string
  last_updated?: string
}

export interface KeapOpportunitiesResponse {
  opportunities: KeapOpportunity[]
  count: number
  next?: string
}

export interface KeapPipelineStage {
  id: string
  name: string
  order: number
}

export interface KeapPipeline {
  id: string
  name: string
  stages?: KeapPipelineStage[]
  active?: boolean
}

export interface KeapPipelinesResponse {
  pipelines: KeapPipeline[]
  count: number
}

export class KeapClient {
  private accessToken: string
  private baseUrl = "https://api.infusionsoft.com/crm/rest/v1"

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Keap API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getOpportunities() {
    return this.request<KeapOpportunitiesResponse>("/opportunities?limit=100", {
      method: "GET",
    })
  }

  async getPipelines() {
    return this.request<KeapPipelinesResponse>("/pipelines", {
      method: "GET",
    })
  }

  async createPipeline(data: { name: string; stages?: string[] }) {
    return this.request("/pipelines", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async createCustomField(data: { label: string; field_type: string }) {
    return this.request("/opportunityCustomFields", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateOpportunity(opportunityId: string, data: any) {
    return this.request(`/opportunities/${opportunityId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }
}
