import { Page, Route } from '@playwright/test'
import {
  mockOpportunities,
  mockPipelines,
  mockUsers,
  mockEnrichmentResponse,
  mockCustomFields,
  mockPipelineOutcomes,
  mockDealCreationResponse,
} from './mock-data'

/**
 * Mock API handlers for E2E tests
 * Intercepts API calls and returns mock data
 */

export async function setupMockApis(page: Page) {
  // Mock auth status - authenticated
  await page.route('**/api/auth/keap/status', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        tokenVerification: { valid: true, expiresIn: 3600 },
      }),
    })
  })

  // Mock opportunities
  await page.route('**/api/opportunities', async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockOpportunities),
      })
    } else {
      await route.continue()
    }
  })

  // Mock pipelines
  await page.route('**/api/pipelines', async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPipelines),
      })
    } else if (method === 'POST') {
      // Pipeline creation
      const body = route.request().postDataJSON()
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: Math.floor(Math.random() * 1000) + 100,
          name: body.name,
          stages: body.stages.map((s: { name: string }, i: number) => ({
            id: Math.floor(Math.random() * 1000) + 1000,
            name: s.name,
            order: i + 1,
          })),
        }),
      })
    }
  })

  // Mock pipeline outcomes
  await page.route('**/api/pipelines/*/outcomes', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockPipelineOutcomes),
    })
  })

  // Mock users
  await page.route('**/api/users', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUsers),
    })
  })

  // Mock opportunity enrichment (XML-RPC data)
  await page.route('**/api/opportunities/enrich', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockEnrichmentResponse),
    })
  })

  // Mock custom fields
  await page.route('**/api/custom-fields', async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCustomFields),
      })
    } else if (method === 'POST') {
      // Create custom field
      const body = route.request().postDataJSON()
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: Math.floor(Math.random() * 1000) + 10,
          ...body,
        }),
      })
    }
  })

  // Mock deal creation
  await page.route('**/api/deals', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(mockDealCreationResponse),
      })
    }
  })

  // Mock XML-RPC test endpoint
  await page.route('**/api/xmlrpc/test', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        productInterest: { success: true, count: 3 },
        stageMove: { success: true, count: 18 },
      }),
    })
  })
}

export async function setupUnauthenticatedMockApis(page: Page) {
  // Mock auth status - not authenticated
  await page.route('**/api/auth/keap/status', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: false,
        tokenVerification: null,
      }),
    })
  })

  // All other API calls return 401
  await page.route('**/api/**', async (route: Route) => {
    if (!route.request().url().includes('/auth/')) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      })
    } else {
      await route.continue()
    }
  })
}

export async function setupApiErrorMocks(page: Page) {
  await setupMockApis(page)

  // Override opportunities to return error
  await page.route('**/api/opportunities', async (route: Route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal server error' }),
    })
  })
}

export async function setupEmptyDataMocks(page: Page) {
  await page.route('**/api/auth/keap/status', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        tokenVerification: { valid: true },
      }),
    })
  })

  await page.route('**/api/opportunities', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/pipelines', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/users', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
}
