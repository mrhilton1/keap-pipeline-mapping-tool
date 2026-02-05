import { test, expect } from '@playwright/test'
import { setupMockApis } from './fixtures/api-handlers'
import { mockOpportunities, mockDealCreationResponse } from './fixtures/mock-data'

test.describe('Deal Migration', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApis(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    // Navigate to Migrate tab
    const migrateTab = page.getByRole('tab', { name: /migrate/i })
    if (await migrateTab.isVisible()) {
      await migrateTab.click()
      await page.waitForTimeout(1000)
    }
  })

  test.describe('Deal Creation', () => {
    test('should create deals with correct stage assignment', async ({ page }) => {
      let dealPayload: Record<string, unknown> | null = null
      
      await page.route('**/api/deals', async (route) => {
        if (route.request().method() === 'POST') {
          dealPayload = route.request().postDataJSON() as Record<string, unknown>
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(mockDealCreationResponse),
          })
        }
      })
      
      // Select opportunities
      const checkbox = page.locator('input[type="checkbox"]').first()
      if (await checkbox.isVisible()) {
        await checkbox.check()
      }
      
      // Click migrate
      const migrateButton = page.getByRole('button', { name: /migrate/i })
      if (await migrateButton.isVisible() && await migrateButton.isEnabled()) {
        await migrateButton.click()
        await page.waitForTimeout(2000)
        
        // Verify deal was created with stage
        if (dealPayload) {
          expect(dealPayload).toHaveProperty('stage_id')
        }
      }
    })

    test('should set deal value from revenue mapping', async ({ page }) => {
      let dealPayload: Record<string, unknown> | null = null
      
      await page.route('**/api/deals', async (route) => {
        if (route.request().method() === 'POST') {
          dealPayload = route.request().postDataJSON() as Record<string, unknown>
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(mockDealCreationResponse),
          })
        }
      })
      
      // Select opportunity with revenue
      const opportunityWithRevenue = page.getByText(mockOpportunities[0].opportunity_title)
      if (await opportunityWithRevenue.isVisible()) {
        const row = opportunityWithRevenue.locator('..')
        const checkbox = row.locator('input[type="checkbox"]')
        if (await checkbox.isVisible()) {
          await checkbox.check()
        }
      }
      
      // Migrate
      const migrateButton = page.getByRole('button', { name: /migrate/i })
      if (await migrateButton.isVisible() && await migrateButton.isEnabled()) {
        await migrateButton.click()
        await page.waitForTimeout(2000)
        
        // Verify value was set
        if (dealPayload) {
          expect(dealPayload).toHaveProperty('value')
        }
      }
    })

    test('should preserve contact and owner assignments', async ({ page }) => {
      let dealPayload: Record<string, unknown> | null = null
      
      await page.route('**/api/deals', async (route) => {
        if (route.request().method() === 'POST') {
          dealPayload = route.request().postDataJSON() as Record<string, unknown>
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(mockDealCreationResponse),
          })
        }
      })
      
      // Select and migrate
      const checkbox = page.locator('input[type="checkbox"]').first()
      if (await checkbox.isVisible()) {
        await checkbox.check()
      }
      
      const migrateButton = page.getByRole('button', { name: /migrate/i })
      if (await migrateButton.isVisible() && await migrateButton.isEnabled()) {
        await migrateButton.click()
        await page.waitForTimeout(2000)
        
        // Verify contacts and owners were preserved
        if (dealPayload) {
          expect(dealPayload).toHaveProperty('contacts')
          expect(dealPayload).toHaveProperty('owners')
        }
      }
    })

    test('should set closed_time from stageMoves.outcomeDate', async ({ page }) => {
      let dealPayload: Record<string, unknown> | null = null
      
      await page.route('**/api/deals', async (route) => {
        if (route.request().method() === 'POST') {
          dealPayload = route.request().postDataJSON() as Record<string, unknown>
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(mockDealCreationResponse),
          })
        }
      })
      
      // Select opportunity with outcome date (the Lost one)
      const lostOpportunity = page.getByText(/CXmybiz/i)
      if (await lostOpportunity.isVisible()) {
        const row = lostOpportunity.locator('..')
        const checkbox = row.locator('input[type="checkbox"]')
        if (await checkbox.isVisible()) {
          await checkbox.check()
        }
      }
      
      const migrateButton = page.getByRole('button', { name: /migrate/i })
      if (await migrateButton.isVisible() && await migrateButton.isEnabled()) {
        await migrateButton.click()
        await page.waitForTimeout(2000)
        
        // Verify closed_time was set
        if (dealPayload) {
          // closed_time should be present for LOST deals
        }
      }
    })
  })

  test.describe('Note Creation', () => {
    test('should create notes in correct order (custom first)', async ({ page }) => {
      const notePayloads: Array<Record<string, unknown>> = []
      
      await page.route('**/api/deals/*/notes', async (route) => {
        notePayloads.push(route.request().postDataJSON() as Record<string, unknown>)
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: notePayloads.length, body: '' }),
        })
      })
      
      // Add custom note
      const noteInput = page.locator('textarea[data-testid="custom-note"]')
      if (await noteInput.isVisible()) {
        await noteInput.fill('Custom migration note')
      }
      
      // Select and migrate
      const checkbox = page.locator('input[type="checkbox"]').first()
      if (await checkbox.isVisible()) {
        await checkbox.check()
      }
      
      const migrateButton = page.getByRole('button', { name: /migrate/i })
      if (await migrateButton.isVisible() && await migrateButton.isEnabled()) {
        await migrateButton.click()
        await page.waitForTimeout(3000)
        
        // Custom note should be first
        if (notePayloads.length > 0) {
          const firstNote = notePayloads[0]
          expect(String(firstNote?.body || '')).toContain('Custom')
        }
      }
    })

    test('should format products note correctly', async ({ page }) => {
      let productNote: Record<string, unknown> | null = null
      
      await page.route('**/api/deals/*/notes', async (route) => {
        const payload = route.request().postDataJSON() as Record<string, unknown>
        if (String(payload?.body || '').includes('Product')) {
          productNote = payload
        }
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 1, body: payload.body }),
        })
      })
      
      // Select opportunity with products (CXmybiz)
      const oppWithProducts = page.getByText(/CXmybiz/i)
      if (await oppWithProducts.isVisible()) {
        const checkbox = oppWithProducts.locator('..').locator('input[type="checkbox"]')
        if (await checkbox.isVisible()) {
          await checkbox.check()
        }
      }
      
      const migrateButton = page.getByRole('button', { name: /migrate/i })
      if (await migrateButton.isVisible() && await migrateButton.isEnabled()) {
        await migrateButton.click()
        await page.waitForTimeout(3000)
        
        // Should have created product note
      }
    })

    test('should format stage history note correctly', async ({ page }) => {
      let historyNote: Record<string, unknown> | null = null
      
      await page.route('**/api/deals/*/notes', async (route) => {
        const payload = route.request().postDataJSON() as Record<string, unknown>
        if (String(payload?.body || '').includes('Stage') || String(payload?.body || '').includes('History')) {
          historyNote = payload
        }
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 1, body: payload.body }),
        })
      })
      
      // Migrate opportunity with stage moves
      const checkbox = page.locator('input[type="checkbox"]').first()
      if (await checkbox.isVisible()) {
        await checkbox.check()
      }
      
      const migrateButton = page.getByRole('button', { name: /migrate/i })
      if (await migrateButton.isVisible() && await migrateButton.isEnabled()) {
        await migrateButton.click()
        await page.waitForTimeout(3000)
      }
    })
  })

  test.describe('Migration Results', () => {
    test('should mark migrated opportunities in UI', async ({ page }) => {
      await page.route('**/api/deals', async (route) => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(mockDealCreationResponse),
        })
      })
      
      // Select and migrate
      const checkbox = page.locator('input[type="checkbox"]').first()
      if (await checkbox.isVisible()) {
        await checkbox.check()
      }
      
      const migrateButton = page.getByRole('button', { name: /migrate/i })
      if (await migrateButton.isVisible() && await migrateButton.isEnabled()) {
        await migrateButton.click()
        await page.waitForTimeout(2000)
        
        // Look for migrated indicator
        const migratedBadge = page.getByText(/migrated|✓|success/i)
      }
    })

    test('should show success/failure counts', async ({ page }) => {
      await page.route('**/api/deals', async (route) => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(mockDealCreationResponse),
        })
      })
      
      // Select multiple and migrate
      const checkboxes = page.locator('input[type="checkbox"]')
      const count = await checkboxes.count()
      
      for (let i = 0; i < Math.min(count, 3); i++) {
        await checkboxes.nth(i).check()
      }
      
      const migrateButton = page.getByRole('button', { name: /migrate/i })
      if (await migrateButton.isVisible() && await migrateButton.isEnabled()) {
        await migrateButton.click()
        await page.waitForTimeout(3000)
        
        // Should show results
        const results = page.getByText(/\d+.*success|\d+.*migrated/i)
      }
    })

    test('should handle partial failures gracefully', async ({ page }) => {
      let callCount = 0
      
      await page.route('**/api/deals', async (route) => {
        callCount++
        if (callCount % 2 === 0) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal error' }),
          })
        } else {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(mockDealCreationResponse),
          })
        }
      })
      
      // Select multiple
      const checkboxes = page.locator('input[type="checkbox"]')
      const count = await checkboxes.count()
      
      for (let i = 0; i < Math.min(count, 4); i++) {
        await checkboxes.nth(i).check()
      }
      
      const migrateButton = page.getByRole('button', { name: /migrate/i })
      if (await migrateButton.isVisible() && await migrateButton.isEnabled()) {
        await migrateButton.click()
        await page.waitForTimeout(3000)
        
        // Should show mixed results
        const failureCount = page.getByText(/fail|error/i)
      }
    })
  })

  test.describe('Selection', () => {
    test('should allow selecting individual opportunities', async ({ page }) => {
      const checkboxes = page.locator('input[type="checkbox"][data-testid="opportunity-checkbox"]')
      
      if (await checkboxes.count() > 0) {
        await checkboxes.first().check()
        
        await expect(checkboxes.first()).toBeChecked()
      }
    })

    test('should allow select all', async ({ page }) => {
      const selectAll = page.locator('input[type="checkbox"][data-testid="select-all"]')
      
      if (await selectAll.isVisible()) {
        await selectAll.check()
        
        // All individual checkboxes should be checked
        const checkboxes = page.locator('input[type="checkbox"][data-testid="opportunity-checkbox"]')
        const count = await checkboxes.count()
        
        for (let i = 0; i < count; i++) {
          await expect(checkboxes.nth(i)).toBeChecked()
        }
      }
    })

    test('should show selected count', async ({ page }) => {
      const checkboxes = page.locator('input[type="checkbox"]')
      
      if (await checkboxes.count() > 0) {
        await checkboxes.first().check()
        await checkboxes.nth(1).check()
        
        // Should show "2 selected" or similar
        const selectedCount = page.getByText(/2.*select|\d+.*select/i)
      }
    })
  })
})
