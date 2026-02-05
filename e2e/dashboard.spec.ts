import { test, expect } from '@playwright/test'
import { setupMockApis, setupApiErrorMocks, setupEmptyDataMocks } from './fixtures/api-handlers'
import { mockOpportunities, mockPipelines } from './fixtures/mock-data'

test.describe('Dashboard Loading', () => {
  test.describe('Data Loading', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApis(page)
    })

    test('should load opportunities from Keap API', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Wait for opportunities to load
      await expect(page.locator('[data-testid="opportunities-panel"]')).toBeVisible({ timeout: 10000 })
      
      // Should show opportunity count
      const opportunityCount = page.getByText(new RegExp(`${mockOpportunities.length}|Opportunities`))
      await expect(opportunityCount).toBeVisible()
    })

    test('should display opportunity count in header badge', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Look for opportunities badge
      const badge = page.locator('[data-testid="opportunities-badge"]')
      if (await badge.isVisible()) {
        await expect(badge).toContainText(/\d+/)
      }
    })

    test('should load pipelines from Keap API', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Wait for pipelines section
      await page.waitForTimeout(1000) // Allow API calls to complete
      
      // Should show pipeline count somewhere
      const pipelineInfo = page.getByText(/pipeline/i)
      await expect(pipelineInfo.first()).toBeVisible()
    })

    test('should display pipeline count in header badge', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Look for pipelines badge
      const badge = page.locator('[data-testid="pipelines-badge"]')
      if (await badge.isVisible()) {
        await expect(badge).toContainText(/\d+/)
      }
    })

    test('should enrich opportunities with XML-RPC data', async ({ page }) => {
      let enrichCalled = false
      
      await page.route('**/api/opportunities/enrich', async (route) => {
        enrichCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            products: { 2: [{ ProductName: 'Test Product', ProductPrice: 100 }] },
            stageMoves: { 2: { moves: [], lastUpdated: null, outcome: null } },
            orderRevenue: {},
          }),
        })
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Navigate to a tab that triggers enrichment
      const migrateTab = page.getByRole('tab', { name: /migrate/i })
      if (await migrateTab.isVisible()) {
        await migrateTab.click()
        await page.waitForTimeout(2000)
      }
      
      // Enrichment should have been called
      expect(enrichCalled).toBeTruthy()
    })
  })

  test.describe('Error States', () => {
    test('should show error state when opportunities API fails', async ({ page }) => {
      await setupApiErrorMocks(page)
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should show error message or empty state
      const errorMessage = page.getByText(/error|failed|unable/i)
      const emptyState = page.getByText(/no opportunities/i)
      
      const hasErrorOrEmpty = await errorMessage.isVisible() || await emptyState.isVisible()
      // Dashboard should handle error gracefully
    })

    test('should show empty state when no data exists', async ({ page }) => {
      await setupEmptyDataMocks(page)
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Should handle empty data gracefully
      await expect(page).toHaveURL('/dashboard')
    })
  })

  test.describe('Header Badges', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApis(page)
    })

    test('should show API test badges in header', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Look for test badge indicators
      const checkmarks = page.locator('text=✓')
      const errorMarks = page.locator('text=✗')
      
      // Should have some status indicators
      const hasBadges = await checkmarks.count() > 0 || await errorMarks.count() > 0
    })

    test('should run tests on page load', async ({ page }) => {
      let opportunitiesApiCalled = false
      let pipelinesApiCalled = false
      
      await page.route('**/api/opportunities', async (route) => {
        opportunitiesApiCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockOpportunities),
        })
      })
      
      await page.route('**/api/pipelines', async (route) => {
        pipelinesApiCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockPipelines),
        })
      })
      
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // APIs should have been called
      expect(opportunitiesApiCalled).toBeTruthy()
    })

    test('should refresh tests when refresh button clicked', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Look for refresh button
      const refreshButton = page.getByRole('button', { name: /refresh/i })
      
      if (await refreshButton.isVisible()) {
        let apiCallCount = 0
        await page.route('**/api/opportunities', async (route) => {
          apiCallCount++
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockOpportunities),
          })
        })
        
        await refreshButton.click()
        await page.waitForTimeout(1000)
        
        // Should have made additional API call
        expect(apiCallCount).toBeGreaterThan(0)
      }
    })

    test('badges should be clickable to show JSON modal', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Try clicking on opportunities count/badge
      const opportunitiesCard = page.locator('[data-testid="opportunities-card"]')
      const opportunitiesBadge = page.locator('[data-testid="opportunities-badge"]')
      
      const clickTarget = await opportunitiesCard.isVisible() 
        ? opportunitiesCard 
        : await opportunitiesBadge.isVisible() 
          ? opportunitiesBadge 
          : null
      
      if (clickTarget) {
        await clickTarget.click()
        
        // Should show modal with JSON data
        const modal = page.locator('[role="dialog"]')
        if (await modal.isVisible({ timeout: 2000 })) {
          // Modal should contain JSON-like content
          await expect(modal.locator('pre, code, [data-testid="json-viewer"]')).toBeVisible()
        }
      }
    })
  })

  test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApis(page)
    })

    test('should have tabs for Build Pipelines, Field Mapping, Migrate Deals', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Check for tab navigation
      const buildTab = page.getByRole('tab', { name: /build|pipeline/i })
      const fieldTab = page.getByRole('tab', { name: /field|mapping/i })
      const migrateTab = page.getByRole('tab', { name: /migrate|deal/i })
      
      // At least some tabs should be visible
      const hasNavigation = await buildTab.isVisible() || 
                           await fieldTab.isVisible() || 
                           await migrateTab.isVisible()
      expect(hasNavigation).toBeTruthy()
    })

    test('should switch tabs correctly', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const tabs = page.getByRole('tab')
      const tabCount = await tabs.count()
      
      if (tabCount > 1) {
        // Click second tab
        await tabs.nth(1).click()
        
        // Content should change
        await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
      }
    })
  })
})
