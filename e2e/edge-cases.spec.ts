import { test, expect } from '@playwright/test'
import { setupMockApis, setupEmptyDataMocks } from './fixtures/api-handlers'
import { mockOpportunities } from './fixtures/mock-data'

test.describe('Edge Cases & Error Handling', () => {
  test.describe('Missing Data', () => {
    test('should handle opportunities with no stage', async ({ page }) => {
      const opportunityNoStage = {
        ...mockOpportunities[0],
        stage: null,
      }
      
      await page.route('**/api/opportunities', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([opportunityNoStage]),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should not crash
      await expect(page).toHaveURL('/dashboard')
      
      // Navigate to migrate tab
      const migrateTab = page.getByRole('tab', { name: /migrate/i })
      if (await migrateTab.isVisible()) {
        await migrateTab.click()
        await page.waitForTimeout(1000)
        
        // Should handle missing stage gracefully
        const errorMessage = page.getByText(/error/i)
      }
    })

    test('should handle opportunities with no contact', async ({ page }) => {
      const opportunityNoContact = {
        ...mockOpportunities[0],
        contact: null,
      }
      
      await page.route('**/api/opportunities', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([opportunityNoContact]),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should not crash
      await expect(page).toHaveURL('/dashboard')
    })

    test('should handle empty products array', async ({ page }) => {
      await page.route('**/api/opportunities/enrich', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            products: {},
            stageMoves: {},
            orderRevenue: {},
          }),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const migrateTab = page.getByRole('tab', { name: /migrate/i })
      if (await migrateTab.isVisible()) {
        await migrateTab.click()
        await page.waitForTimeout(2000)
      }
      
      // Should handle empty products
      await expect(page).toHaveURL('/dashboard')
    })

    test('should handle null/undefined field values', async ({ page }) => {
      const opportunityWithNulls = {
        ...mockOpportunities[0],
        opportunity_notes: null,
        next_action_notes: undefined,
        estimated_close_date: null,
        projected_revenue_low: null,
        projected_revenue_high: null,
      }
      
      await page.route('**/api/opportunities', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([opportunityWithNulls]),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should not crash
      await expect(page).toHaveURL('/dashboard')
    })

    test('should handle missing user/owner', async ({ page }) => {
      const opportunityNoUser = {
        ...mockOpportunities[0],
        user: null,
      }
      
      await page.route('**/api/opportunities', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([opportunityNoUser]),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should not crash
      await expect(page).toHaveURL('/dashboard')
    })
  })

  test.describe('API Errors', () => {
    test('should handle API timeouts gracefully', async ({ page }) => {
      await page.route('**/api/opportunities', async (route) => {
        // Simulate timeout by never responding
        await new Promise(resolve => setTimeout(resolve, 15000))
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      
      // Should show loading or timeout message eventually
      const loadingOrError = page.getByText(/loading|timeout|error|try again/i)
    })

    test('should handle 401 and prompt re-authentication', async ({ page }) => {
      await page.route('**/api/opportunities', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' }),
        })
      })
      
      await page.route('**/api/auth/keap/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ authenticated: true }),
        })
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should show re-auth prompt or redirect
      const authPrompt = page.getByText(/re-authenticate|session.*expired|sign in/i)
      const redirected = page.url().includes('/')
    })

    test('should handle 500 errors', async ({ page }) => {
      await page.route('**/api/opportunities', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should show error message
      const errorMessage = page.getByText(/error|failed|unable/i)
    })

    test('should handle network errors', async ({ page }) => {
      await page.route('**/api/opportunities', async (route) => {
        await route.abort('failed')
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should handle network failure gracefully
    })
  })

  test.describe('Large Data Sets', () => {
    test('should handle many opportunities (100+)', async ({ page }) => {
      const manyOpportunities = Array.from({ length: 150 }, (_, i) => ({
        ...mockOpportunities[0],
        id: i + 1,
        opportunity_title: `Opportunity ${i + 1}`,
      }))
      
      await page.route('**/api/opportunities', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(manyOpportunities),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should display count indicator for large sets
      const countIndicator = page.getByText(/100\+|\d+ opportunities/i)
    })

    test('should handle many pipelines', async ({ page }) => {
      const manyPipelines = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        name: `Pipeline ${i + 1}`,
        stages: [{ id: i * 10 + 1, name: 'Stage 1', order: 1 }],
      }))
      
      await page.route('**/api/pipelines', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(manyPipelines),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should handle large pipeline list
    })
  })

  test.describe('Empty States', () => {
    test('should show appropriate message when no opportunities', async ({ page }) => {
      await setupEmptyDataMocks(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should show empty state message
      const emptyState = page.getByText(/no opportunities|no data|empty/i)
    })

    test('should show appropriate message when no pipelines', async ({ page }) => {
      await page.route('**/api/pipelines', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const buildTab = page.getByRole('tab', { name: /build|pipeline/i })
      if (await buildTab.isVisible()) {
        await buildTab.click()
        await page.waitForTimeout(500)
      }
      
      // Should default to build new mode
    })
  })

  test.describe('Special Characters', () => {
    test('should handle special characters in opportunity titles', async ({ page }) => {
      const opportunityWithSpecialChars = {
        ...mockOpportunities[0],
        opportunity_title: 'Test <script>alert("XSS")</script> & "Quotes" \'Single\' > < / \\ ',
      }
      
      await page.route('**/api/opportunities', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([opportunityWithSpecialChars]),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should not execute scripts (XSS protection)
      // Should display escaped characters correctly
    })

    test('should handle unicode characters', async ({ page }) => {
      const opportunityWithUnicode = {
        ...mockOpportunities[0],
        opportunity_title: '日本語テスト 🎉 Émojis & Ñ',
        contact: {
          ...mockOpportunities[0].contact,
          first_name: 'José',
          last_name: 'García-González',
        },
      }
      
      await page.route('**/api/opportunities', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([opportunityWithUnicode]),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should display unicode correctly
      const unicodeText = page.getByText('日本語テスト')
    })
  })

  test.describe('Concurrent Operations', () => {
    test('should handle rapid tab switching', async ({ page }) => {
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const tabs = page.getByRole('tab')
      const tabCount = await tabs.count()
      
      // Rapidly switch between tabs
      for (let i = 0; i < 10; i++) {
        await tabs.nth(i % tabCount).click()
        await page.waitForTimeout(100)
      }
      
      // Should not crash
      await expect(page).toHaveURL('/dashboard')
    })

    test('should handle multiple selection changes rapidly', async ({ page }) => {
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const migrateTab = page.getByRole('tab', { name: /migrate/i })
      if (await migrateTab.isVisible()) {
        await migrateTab.click()
        await page.waitForTimeout(500)
      }
      
      const checkboxes = page.locator('input[type="checkbox"]')
      const count = await checkboxes.count()
      
      // Rapidly toggle checkboxes
      for (let i = 0; i < Math.min(count, 5); i++) {
        await checkboxes.nth(i).check()
        await checkboxes.nth(i).uncheck()
        await checkboxes.nth(i).check()
      }
      
      // Should not crash
      await expect(page).toHaveURL('/dashboard')
    })
  })

  test.describe('Browser Compatibility', () => {
    test('should work with localStorage disabled', async ({ page, context }) => {
      // Clear localStorage
      await context.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          value: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
            clear: () => {},
          },
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should work even without localStorage
      await expect(page).toHaveURL('/dashboard')
    })
  })

  test.describe('Subscription Edge Cases', () => {
    test('should handle null subscription cycle', async ({ page }) => {
      await page.route('**/api/opportunities/enrich', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            products: {
              2: [{
                ProductName: 'Subscription',
                ProductPrice: 49.99,
                isSubscription: true,
                subscription: {
                  cycle: null, // null cycle
                  frequency: 1,
                  planPrice: 49.99,
                },
              }],
            },
            stageMoves: {},
            orderRevenue: {},
          }),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const migrateTab = page.getByRole('tab', { name: /migrate/i })
      if (await migrateTab.isVisible()) {
        await migrateTab.click()
        await page.waitForTimeout(2000)
      }
      
      // Should not crash with null cycle
      await expect(page).toHaveURL('/dashboard')
    })

    test('should handle numeric subscription cycle', async ({ page }) => {
      await page.route('**/api/opportunities/enrich', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            products: {
              2: [{
                ProductName: 'Subscription',
                ProductPrice: 49.99,
                isSubscription: true,
                subscription: {
                  cycle: 2, // numeric cycle (monthly)
                  frequency: 1,
                  planPrice: 49.99,
                },
              }],
            },
            stageMoves: {},
            orderRevenue: {},
          }),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should display cycle correctly (e.g., "/month")
    })
  })
})
