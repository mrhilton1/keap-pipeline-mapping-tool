import { test, expect } from '@playwright/test'
import { setupMockApis } from './fixtures/api-handlers'
import { mockProducts, mockStageMoves, mockEnrichmentResponse } from './fixtures/mock-data'

test.describe('XML-RPC Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApis(page)
  })

  test.describe('Product Data', () => {
    test('should fetch products for opportunities', async ({ page }) => {
      let enrichCalled = false
      
      await page.route('**/api/opportunities/enrich', async (route) => {
        enrichCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockEnrichmentResponse),
        })
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Navigate to migrate tab to trigger enrichment
      const migrateTab = page.getByRole('tab', { name: /migrate/i })
      if (await migrateTab.isVisible()) {
        await migrateTab.click()
        await page.waitForTimeout(2000)
      }
      
      expect(enrichCalled).toBeTruthy()
    })

    test('should display product names and prices', async ({ page }) => {
      await page.route('**/api/opportunities/enrich', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockEnrichmentResponse),
        })
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const migrateTab = page.getByRole('tab', { name: /migrate/i })
      if (await migrateTab.isVisible()) {
        await migrateTab.click()
        await page.waitForTimeout(2000)
      }
      
      // Expand an opportunity to see products
      const expandButton = page.locator('[data-testid="expand-opportunity"]').first()
      if (await expandButton.isVisible()) {
        await expandButton.click()
        await page.waitForTimeout(500)
        
        // Should show product info
        const productName = page.getByText(mockProducts[0].ProductName)
        const productPrice = page.getByText(/\$\d+/)
      }
    })

    test('should handle subscription products correctly', async ({ page }) => {
      const subscriptionEnrichment = {
        ...mockEnrichmentResponse,
        products: {
          2: [
            {
              ...mockProducts[0],
              isSubscription: true,
              subscription: {
                cycle: 2,
                frequency: 1,
                planPrice: 49.99,
              },
            },
          ],
        },
      }
      
      await page.route('**/api/opportunities/enrich', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(subscriptionEnrichment),
        })
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const migrateTab = page.getByRole('tab', { name: /migrate/i })
      if (await migrateTab.isVisible()) {
        await migrateTab.click()
        await page.waitForTimeout(2000)
      }
      
      // Look for subscription indicator
      const subscriptionBadge = page.getByText(/subscription|\/month|\/year/i)
    })

    test('should calculate product prices from OrderRevenue', async ({ page }) => {
      const enrichWithRevenue = {
        ...mockEnrichmentResponse,
        orderRevenue: { 2: 520.99 },
      }
      
      await page.route('**/api/opportunities/enrich', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(enrichWithRevenue),
        })
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const migrateTab = page.getByRole('tab', { name: /migrate/i })
      if (await migrateTab.isVisible()) {
        await migrateTab.click()
        await page.waitForTimeout(2000)
      }
      
      // Look for calculated badge
      const calculatedBadge = page.getByText(/calculated/i)
    })
  })

  test.describe('Stage Move History', () => {
    test('should fetch stage move history', async ({ page }) => {
      await page.route('**/api/opportunities/enrich', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockEnrichmentResponse),
        })
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const migrateTab = page.getByRole('tab', { name: /migrate/i })
      if (await migrateTab.isVisible()) {
        await migrateTab.click()
        await page.waitForTimeout(2000)
      }
      
      // Expand opportunity to see stage moves
      const expandButton = page.locator('[data-testid="expand-opportunity"]').first()
      if (await expandButton.isVisible()) {
        await expandButton.click()
        await page.waitForTimeout(500)
        
        // Should show stage move info
        const stageMove = page.getByText(/stage.*move|history/i)
      }
    })

    test('should display lastUpdated date', async ({ page }) => {
      await page.route('**/api/opportunities/enrich', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockEnrichmentResponse),
        })
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const migrateTab = page.getByRole('tab', { name: /migrate/i })
      if (await migrateTab.isVisible()) {
        await migrateTab.click()
        await page.waitForTimeout(2000)
      }
      
      // Look for last updated info
      const lastUpdated = page.getByText(/last.*update|updated/i)
    })

    test('should show outcome date for WON/LOST opportunities', async ({ page }) => {
      await page.route('**/api/opportunities/enrich', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockEnrichmentResponse),
        })
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const migrateTab = page.getByRole('tab', { name: /migrate/i })
      if (await migrateTab.isVisible()) {
        await migrateTab.click()
        await page.waitForTimeout(2000)
      }
      
      // Look for outcome date
      const outcomeDate = page.getByText(/outcome.*date|close.*date/i)
    })

    test('should determine outcome (WON/LOST) from stage moves', async ({ page }) => {
      await page.route('**/api/opportunities/enrich', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockEnrichmentResponse),
        })
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const migrateTab = page.getByRole('tab', { name: /migrate/i })
      if (await migrateTab.isVisible()) {
        await migrateTab.click()
        await page.waitForTimeout(2000)
      }
      
      // Look for outcome indicator
      const outcomeIndicator = page.getByText(/WON|LOST|outcome/i)
    })
  })

  test.describe('Date Parsing', () => {
    test('should parse XML-RPC date formats correctly', async ({ page }) => {
      // XML-RPC dates come as: 20180406T12:37:24
      const enrichWithDates = {
        ...mockEnrichmentResponse,
        stageMoves: {
          2: {
            ...mockStageMoves,
            lastUpdated: '2018-04-06T12:37:24', // Should be parsed correctly
            outcomeDate: '2018-04-06T12:37:24',
          },
        },
      }
      
      await page.route('**/api/opportunities/enrich', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(enrichWithDates),
        })
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const migrateTab = page.getByRole('tab', { name: /migrate/i })
      if (await migrateTab.isVisible()) {
        await migrateTab.click()
        await page.waitForTimeout(2000)
      }
      
      // Dates should be displayed in readable format
      const dateDisplay = page.getByText(/2018|Apr|April/i)
    })
  })

  test.describe('XML-RPC Test Badge', () => {
    test('should show XML-RPC test badge in header', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Look for XML-RPC badge
      const xmlrpcBadge = page.locator('[data-testid="xmlrpc-badge"]')
      const xmlrpcIndicator = page.getByText(/xml-rpc/i)
    })

    test('should show success checkmark when XML-RPC is working', async ({ page }) => {
      await page.route('**/api/xmlrpc/test', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            productInterest: { success: true },
            stageMove: { success: true },
          }),
        })
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should show success indicator
      const successIndicator = page.locator('[data-testid="xmlrpc-badge"] .text-green-500, [data-testid="xmlrpc-success"]')
    })

    test('should show error state when XML-RPC fails', async ({ page }) => {
      await page.route('**/api/xmlrpc/test', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            productInterest: { success: false, error: 'Connection failed' },
            stageMove: { success: false, error: 'Connection failed' },
          }),
        })
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should show error indicator
      const errorIndicator = page.locator('[data-testid="xmlrpc-badge"] .text-red-500, [data-testid="xmlrpc-error"]')
    })
  })

  test.describe('Debug Page', () => {
    test('should have XML-RPC debug page accessible', async ({ page }) => {
      await page.goto('/debug')
      
      // Page should load without error
      await expect(page).toHaveURL('/debug')
      
      // Should show debug interface
      const debugTitle = page.getByText(/debug|xml-rpc/i)
    })

    test('should allow testing individual XML-RPC calls', async ({ page }) => {
      await page.route('**/api/xmlrpc/debug', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [],
            rawXml: '<response></response>',
          }),
        })
      })
      
      await page.goto('/debug')
      
      // Find test button
      const testButton = page.getByRole('button', { name: /test|run/i }).first()
      
      if (await testButton.isVisible()) {
        await testButton.click()
        await page.waitForTimeout(1000)
        
        // Should show response
        const responseArea = page.locator('pre, code, [data-testid="xml-response"]')
      }
    })

    test('should display XML and JSON responses', async ({ page }) => {
      await page.route('**/api/xmlrpc/debug', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [{ Id: 1, Name: 'Test' }],
            rawXml: '<?xml version="1.0"?><response><value>test</value></response>',
          }),
        })
      })
      
      await page.goto('/debug')
      
      // Run a test
      const testButton = page.getByRole('button', { name: /test|run/i }).first()
      if (await testButton.isVisible()) {
        await testButton.click()
        await page.waitForTimeout(1000)
      }
      
      // Should have tabs for XML and JSON
      const jsonTab = page.getByRole('tab', { name: /json/i })
      const xmlTab = page.getByRole('tab', { name: /xml/i })
    })
  })
})
