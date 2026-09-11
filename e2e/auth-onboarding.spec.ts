import { test, expect } from '@playwright/test';

test.describe('Browser Integration: Auth and Onboarding Flow', () => {
  test('register -> login -> complete onboarding with 10 words -> home', async ({ page }) => {
    let onboardingCompleted = false;

    await page.route('**/ws', async (route) => {
      const postData = route.request().postData() || '';

      if (postData.includes('registerUserRequest')) {
        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:registerUserResponse>
                  <read:success>true</read:success>
                </read:registerUserResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      if (postData.includes('loginRequest')) {
        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:loginResponse>
                  <read:accessToken>mock-test-token-123</read:accessToken>
                  <read:onboardingCompleted>${onboardingCompleted}</read:onboardingCompleted>
                </read:loginResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      if (postData.includes('getInitialVocabularyTestRequest')) {
        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:getInitialVocabularyTestResponse>
                  <read:testId>test-onboarding-1</read:testId>
                  <read:text>Alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar.</read:text>
                  <read:selectableWords>Alpha</read:selectableWords>
                  <read:selectableWords>bravo</read:selectableWords>
                  <read:selectableWords>charlie</read:selectableWords>
                  <read:selectableWords>delta</read:selectableWords>
                  <read:selectableWords>echo</read:selectableWords>
                  <read:selectableWords>foxtrot</read:selectableWords>
                  <read:selectableWords>golf</read:selectableWords>
                  <read:selectableWords>hotel</read:selectableWords>
                  <read:selectableWords>india</read:selectableWords>
                  <read:selectableWords>juliet</read:selectableWords>
                  <read:selectableWords>kilo</read:selectableWords>
                  <read:selectableWords>lima</read:selectableWords>
                </read:getInitialVocabularyTestResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      if (postData.includes('lookupWordRequest')) {
        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:lookupWordResponse>
                  <read:word>test</read:word>
                  <read:normalizedWord>test</read:normalizedWord>
                  <read:translation>prueba</read:translation>
                </read:lookupWordResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      if (postData.includes('setVocabularyStatusRequest')) {
        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:setVocabularyStatusResponse>
                  <read:success>true</read:success>
                </read:setVocabularyStatusResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      if (postData.includes('completeInitialVocabularyTestRequest')) {
        onboardingCompleted = true;
        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:completeInitialVocabularyTestResponse>
                  <read:success>true</read:success>
                </read:completeInitialVocabularyTestResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      if (
        postData.includes('getRecommendationsRequest') ||
        postData.includes('getContinueReadingRequest') ||
        postData.includes('getCollectionsRequest')
      ) {
        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:getRecommendationsResponse>
                  <read:recommendations/>
                </read:getRecommendationsResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      return route.continue();
    });

    // 1. Register
    await page.goto('/register');
    await page.fill('input#name, input[type="text"]', 'Test User');
    await page.fill('input#email, input[type="email"]', 'testuser@example.com');
    await page.fill('input#password, input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // 2. Redirects to /login
    await expect(page).toHaveURL(/.*\/login/);
    await page.fill('input#email, input[type="email"]', 'testuser@example.com');
    await page.fill('input#password, input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // 3. Redirects to /onboarding
    await expect(page).toHaveURL(/.*\/onboarding/);

    // 4. Click "Comenzar" to load test text
    const startBtn = page.getByRole('button', { name: /comenzar/i });
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }

    // 5. Verify Finalizar button is initially disabled
    const finishBtn = page.getByRole('button', { name: /finalizar onboarding/i });
    await expect(finishBtn).toBeVisible();
    await expect(finishBtn).toBeDisabled();

    // 6. Classify 10 words
    const words = [
      'bravo',
      'charlie',
      'delta',
      'echo',
      'foxtrot',
      'golf',
      'hotel',
      'india',
      'juliet',
      'kilo',
    ];

    for (const word of words) {
      const wordBtn = page.getByRole('button', { name: word, exact: true });
      await wordBtn.click();

      const popover = page.locator('.reader-popover');
      await expect(popover).toBeVisible();

      // Click KNOWN status
      const knownBtn = popover.getByRole('button', { name: 'KNOWN', exact: true });
      await knownBtn.click();
    }

    // 7. Verify Finalizar button becomes enabled at 10 classifications
    await expect(finishBtn).toBeEnabled();

    // 8. Submit and verify navigation to /home
    await finishBtn.click();
    await expect(page).toHaveURL(/.*\/home/);
  });
});
