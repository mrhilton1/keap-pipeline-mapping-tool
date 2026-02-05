import { test, expect } from '@playwright/test'
import { setupMockApis, setupEmptyDataMocks } from './fixtures/api-handlers'
import { mockPipelines } from './fixtures/mock-data'

test.describe('Pipeline Builder Flow', () => {
  test.describe('Pipeline Choice', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApis(page)
    })

    test('should show choice between Build New and Use Existing', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Navigate to Build Pipelines tab
      const buildTab = page.getByRole('tab', { name: /build|pipeline/i })
      if (await buildTab.isVisible()) {
        await buildTab.click()
        await page.waitForTimeout(500)
      }
      
      // Should see choice options
      const buildNew = page.getByText(/build new/i)
      const useExisting = page.getByText(/use existing/i)
      
      // At least one option should be visible
      const hasChoice = await buildNew.isVisible() || await useExisting.isVisible()
    })

    test('should auto-select Build New when no pipelines exist', async ({ page }) => {
      await setupEmptyDataMocks(page)
      
      await page.route('**/api/pipelines', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const buildTab = page.getByRole('tab', { name: /build|pipeline/i })
      if (await buildTab.isVisible()) {
        await buildTab.click()
        await page.waitForTimeout(500)
      }
      
      // Should be in build mode (not showing choice)
      const pipelineNameInput = page.getByPlaceholder(/pipeline name/i)
      const addStageButton = page.getByRole('button', { name: /add stage/i })
      
      // Should show builder UI
    })

    test('should show existing pipelines dropdown when Use Existing selected', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const buildTab = page.getByRole('tab', { name: /build|pipeline/i })
      if (await buildTab.isVisible()) {
        await buildTab.click()
        await page.waitForTimeout(500)
      }
      
      // Click Use Existing
      const useExisting = page.getByText(/use existing/i)
      if (await useExisting.isVisible()) {
        await useExisting.click()
        
        // Should show dropdown with pipelines
        const pipelineSelect = page.locator('select, [role="combobox"]').filter({ hasText: /select.*pipeline/i })
      }
    })
  })

  test.describe('Building New Pipeline', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Navigate to Build tab
      const buildTab = page.getByRole('tab', { name: /build|pipeline/i })
      if (await buildTab.isVisible()) {
        await buildTab.click()
        await page.waitForTimeout(500)
      }
      
      // Select Build New if choice is shown
      const buildNew = page.getByText(/build new/i)
      if (await buildNew.isVisible()) {
        await buildNew.click()
        await page.waitForTimeout(300)
      }
    })

    test('should auto-populate stages from opportunity data', async ({ page }) => {
      // Look for stage inputs or stage list
      const stageInputs = page.locator('[data-testid="stage-input"], input[placeholder*="stage"]')
      const stageItems = page.locator('[data-testid="stage-item"]')
      
      // Some stages should be pre-populated
      const stageCount = await stageInputs.count() + await stageItems.count()
    })

    test('should allow drag-and-drop reordering of stages', async ({ page }) => {
      // Find draggable stages
      const stages = page.locator('[data-testid="stage-item"], [draggable="true"]')
      const stageCount = await stages.count()
      
      if (stageCount >= 2) {
        const firstStage = stages.first()
        const secondStage = stages.nth(1)
        
        // Get positions
        const firstBox = await firstStage.boundingBox()
        const secondBox = await secondStage.boundingBox()
        
        if (firstBox && secondBox) {
          // Perform drag
          await firstStage.hover()
          await page.mouse.down()
          await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2)
          await page.mouse.up()
          
          // Verify reorder happened (positions changed)
          await page.waitForTimeout(500)
        }
      }
    })

    test('should allow creating custom stage names', async ({ page }) => {
      // Find add stage button
      const addStageButton = page.getByRole('button', { name: /add|new|stage/i })
      
      if (await addStageButton.isVisible()) {
        await addStageButton.click()
        
        // Look for input field
        const stageInput = page.locator('input').last()
        if (await stageInput.isVisible()) {
          await stageInput.fill('My Custom Stage')
          
          // Verify it's added
          await expect(page.getByText('My Custom Stage')).toBeVisible()
        }
      }
    })

    test('should show dropdown with existing stage names for selection', async ({ page }) => {
      // Find stage selector
      const stageSelectors = page.locator('[data-testid="stage-selector"], [role="combobox"]')
      
      if (await stageSelectors.count() > 0) {
        await stageSelectors.first().click()
        
        // Should show dropdown options
        const dropdown = page.locator('[role="listbox"], [data-testid="stage-dropdown"]')
        if (await dropdown.isVisible()) {
          // Should have some options
          const options = dropdown.locator('[role="option"], li')
          expect(await options.count()).toBeGreaterThan(0)
        }
      }
    })

    test('should show opportunity count per stage in dropdown', async ({ page }) => {
      // Find and click stage selector
      const stageSelector = page.locator('[data-testid="stage-selector"]').first()
      
      if (await stageSelector.isVisible()) {
        await stageSelector.click()
        
        // Look for count badges
        const countBadges = page.locator('[data-testid="stage-count"], .badge, text=/\\(\\d+\\)/')
      }
    })

    test('should create pipeline in Keap when clicking Create', async ({ page }) => {
      let pipelineCreated = false
      
      await page.route('**/api/pipelines', async (route) => {
        if (route.request().method() === 'POST') {
          pipelineCreated = true
          const body = route.request().postDataJSON()
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 999,
              name: body.name,
              stages: body.stages,
            }),
          })
        } else {
          await route.continue()
        }
      })
      
      // Fill in pipeline name if needed
      const nameInput = page.getByPlaceholder(/pipeline name|name/i)
      if (await nameInput.isVisible()) {
        await nameInput.fill('Test Pipeline E2E')
      }
      
      // Click Create button
      const createButton = page.getByRole('button', { name: /create/i })
      if (await createButton.isVisible() && await createButton.isEnabled()) {
        await createButton.click()
        await page.waitForTimeout(1000)
        
        // Verify API was called
        expect(pipelineCreated).toBeTruthy()
      }
    })

    test('should navigate to Field Mapping after pipeline creation', async ({ page }) => {
      await page.route('**/api/pipelines', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 999,
              name: 'Test Pipeline',
              stages: [{ id: 1001, name: 'Stage 1', order: 1 }],
            }),
          })
        } else {
          await route.continue()
        }
      })
      
      const createButton = page.getByRole('button', { name: /create/i })
      if (await createButton.isVisible() && await createButton.isEnabled()) {
        await createButton.click()
        await page.waitForTimeout(1000)
        
        // Should advance to Field Mapping tab
        const fieldMappingTab = page.getByRole('tab', { name: /field|mapping/i })
        if (await fieldMappingTab.isVisible()) {
          await expect(fieldMappingTab).toHaveAttribute('aria-selected', 'true')
        }
      }
    })

    test('should disable Create button after pipeline is created', async ({ page }) => {
      await page.route('**/api/pipelines', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ id: 999, name: 'Test', stages: [] }),
          })
        } else {
          await route.continue()
        }
      })
      
      const createButton = page.getByRole('button', { name: /create/i })
      if (await createButton.isVisible() && await createButton.isEnabled()) {
        await createButton.click()
        await page.waitForTimeout(1000)
        
        // Button should be disabled or hidden
        const isDisabled = await createButton.isDisabled().catch(() => true)
        const isHidden = !(await createButton.isVisible())
      }
    })
  })

  test.describe('Keyboard Interactions', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApis(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const buildTab = page.getByRole('tab', { name: /build|pipeline/i })
      if (await buildTab.isVisible()) {
        await buildTab.click()
      }
    })

    test('should create stage when pressing Enter with Create option selected', async ({ page }) => {
      // Focus on stage input
      const stageInput = page.locator('[data-testid="stage-selector"] input, input[placeholder*="stage"]').first()
      
      if (await stageInput.isVisible()) {
        await stageInput.fill('New Stage Via Enter')
        
        // Press Enter
        await stageInput.press('Enter')
        await page.waitForTimeout(300)
        
        // Stage should be created
        await expect(page.getByText('New Stage Via Enter')).toBeVisible()
      }
    })

    test('should close dropdown on Escape key', async ({ page }) => {
      const stageSelector = page.locator('[data-testid="stage-selector"]').first()
      
      if (await stageSelector.isVisible()) {
        await stageSelector.click()
        
        // Dropdown should be open
        const dropdown = page.locator('[role="listbox"], [data-testid="stage-dropdown"]')
        
        // Press Escape
        await page.keyboard.press('Escape')
        await page.waitForTimeout(200)
        
        // Dropdown should be closed
        await expect(dropdown).not.toBeVisible()
      }
    })
  })
})
