/**
 * Mock data fixtures for E2E tests
 * These simulate Keap API responses for isolated testing
 */

export const mockOpportunities = [
  {
    id: 2,
    opportunity_title: 'CXmybiz',
    next_action_date: null,
    next_action_notes: '',
    opportunity_notes: 'This is the opportunity note and it is static',
    estimated_close_date: null,
    include_in_forecast: 0,
    projected_revenue_low: 750,
    projected_revenue_high: 5000,
    contact: {
      id: 210,
      email: 'test@example.com',
      first_name: 'Mike',
      last_name: 'Hilton',
      company_name: 'CXMYBIZ',
      job_title: '',
      phone_number: '(480) 283-7598',
    },
    stage: {
      id: 30,
      name: 'Lost',
      details: {
        probability: 0,
        stage_order: 5,
        target_num_days: 0,
        check_list_items: [],
      },
      reasons: [],
    },
    user: {
      id: 1,
      first_name: 'Mike',
      last_name: 'Hilton',
    },
    date_created: '2018-04-06T16:13:58.000+0000',
    last_updated: '2026-02-03T20:31:48.000+0000',
    affiliate_id: 0,
    custom_fields: [],
  },
  {
    id: 5,
    opportunity_title: 'NAMS, Inc',
    next_action_date: '2019-02-12T17:00:00.000+0000',
    next_action_notes: '',
    opportunity_notes: '',
    estimated_close_date: null,
    include_in_forecast: 0,
    projected_revenue_low: 2000,
    projected_revenue_high: 24000,
    contact: {
      id: 4123,
      email: 'jennifer@mynams.com',
      first_name: 'Jen',
      last_name: 'Perdew',
      company_name: 'NAMS, Inc',
      job_title: '',
      phone_number: '(256) 318-5202',
    },
    stage: {
      id: 44,
      name: 'Win',
      details: {
        probability: 0,
        stage_order: 600,
        target_num_days: 0,
        check_list_items: [],
      },
      reasons: [],
    },
    user: {
      id: 1,
      first_name: 'Mike',
      last_name: 'Hilton',
    },
    date_created: '2019-02-12T17:11:48.000+0000',
    last_updated: '2019-04-23T19:37:09.000+0000',
    affiliate_id: 0,
    custom_fields: [],
  },
  {
    id: 33,
    opportunity_title: 'Person NotesTest',
    next_action_date: null,
    next_action_notes: 'This is the next action note',
    opportunity_notes: 'This is the opportunity note',
    estimated_close_date: null,
    include_in_forecast: 0,
    projected_revenue_low: 0,
    projected_revenue_high: 0,
    contact: {
      id: 6009,
      email: null,
      first_name: null,
      last_name: null,
      company_name: null,
      job_title: null,
      phone_number: null,
    },
    stage: {
      id: 18,
      name: 'New Opportunity',
      details: {
        probability: 0,
        stage_order: 10,
        target_num_days: 1,
        check_list_items: [],
      },
      reasons: [],
    },
    user: {
      id: 1,
      first_name: 'Mike',
      last_name: 'Hilton',
    },
    date_created: '2024-09-12T00:29:24.000+0000',
    last_updated: '2024-09-12T00:29:24.000+0000',
    affiliate_id: 0,
    custom_fields: [],
  },
]

export const mockPipelines = [
  {
    id: 1,
    name: 'Sales Pipeline',
    stages: [
      { id: 101, name: 'New Lead', order: 1 },
      { id: 102, name: 'Qualified', order: 2 },
      { id: 103, name: 'Proposal', order: 3 },
      { id: 104, name: 'Won', order: 4 },
      { id: 105, name: 'Lost', order: 5 },
    ],
  },
  {
    id: 2,
    name: 'Partner Pipeline',
    stages: [
      { id: 201, name: 'Initial Contact', order: 1 },
      { id: 202, name: 'Evaluation', order: 2 },
      { id: 203, name: 'Negotiation', order: 3 },
      { id: 204, name: 'Closed', order: 4 },
    ],
  },
  {
    id: 3,
    name: 'BOB',
    stages: [
      { id: 301, name: 'New Opportunity', order: 1 },
      { id: 302, name: 'Win', order: 2 },
      { id: 303, name: 'Lost', order: 3 },
    ],
  },
]

export const mockUsers = [
  {
    id: 1,
    first_name: 'Mike',
    last_name: 'Hilton',
    email: 'mike@example.com',
  },
  {
    id: 2,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
  },
]

export const mockProducts = [
  {
    ObjectId: 2,
    Qty: 1,
    ProductId: 26,
    Id: 5,
    DiscountPercent: 0,
    ProductName: 'Custom Implementation Work',
    ProductPrice: 500,
  },
  {
    ObjectId: 2,
    Qty: 1,
    ProductId: 4,
    Id: 9,
    DiscountPercent: 0,
    ProductName: '15 Secrets Guide',
    ProductPrice: 19.99,
  },
]

export const mockStageMoves = {
  moves: [
    {
      MoveToStage: 18,
      OpportunityId: 2,
      MoveDate: '20180406T12:13:58',
      MoveFromStage: 18,
      Id: 2,
      MoveToStageName: 'New Opportunity',
      MoveFromStageName: 'New Opportunity',
    },
    {
      MoveToStage: 30,
      OpportunityId: 2,
      MoveDate: '20180406T12:37:24',
      MoveFromStage: 40,
      Id: 6,
      MoveToStageName: 'Lost',
      MoveFromStageName: 'Custom Stage 1',
    },
  ],
  lastUpdated: '2018-04-06T12:37:24',
  outcomeDate: '2018-04-06T12:37:24',
  outcome: 'LOST',
}

export const mockEnrichmentResponse = {
  products: {
    2: mockProducts,
  },
  stageMoves: {
    2: mockStageMoves,
  },
  orderRevenue: {
    2: 520.99,
  },
}

export const mockCustomFields = [
  {
    id: 1,
    field_name: 'custom_field_1',
    label: 'Source Campaign',
    field_type: 'Text',
    record_type: 'DEAL',
  },
  {
    id: 2,
    field_name: 'custom_field_2',
    label: 'Priority Level',
    field_type: 'Dropdown',
    record_type: 'DEAL',
  },
]

export const mockPipelineOutcomes = [
  { id: 1, stageId: 104, status: 'WON' },
  { id: 2, stageId: 105, status: 'LOST' },
]

export const mockDealCreationResponse = {
  id: 12345,
  name: 'CXmybiz',
  pipeline_id: 1,
  stage_id: 101,
  value: { amount: 2875, currency: 'USD' },
  status: 'ACTIVE',
  contacts: [{ id: 210, primary: true }],
  owners: [{ id: 1 }],
}
