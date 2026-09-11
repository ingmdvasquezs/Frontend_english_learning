import { test, expect } from '@playwright/test';

test.describe('Browser Integration: Vocabulary Status Interaction', () => {
  test('click word in reader -> change status -> SOAP request dispatched & UI state updated', async ({ page }) => {
    let capturedWord = '';
    let capturedStatus = '';

    await page.route('**/ws', async (route) => {
      const postData = route.request().postData() || '';

      if (postData.includes('getReadingReaderDataRequest')) {
        return route.fulfill({
          status: 200,
          contentType: 'text/xml',
          body: `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="http://soap.com/english-reading/readings">
              <soapenv:Body>
                <read:getReadingReaderDataResponse>
                  <read:readingId>reading-101</read:readingId>
                  <read:title>The Forest Adventure</read:title>
                  <read:language>en</read:language>
                  <read:progressStatus>IN_PROGRESS</read:progressStatus>
                  <read:currentPartOrdinal>1</read:currentPartOrdinal>
                  <read:paginationVersion>1</read:paginationVersion>
                  <read:tokens>
                    <read:value>The</read:value>
                    <read:normalizedValue>the</read:normalizedValue>
                    <read:type>WORD</read:type>
                    <read:status>KNOWN</read:status>
                  </read:tokens>
                  <read:tokens>
                    <read:value> </read:value>
                    <read:type>WHITESPACE</read:type>
                  </read:tokens>
                  <read:tokens>
                    <read:value>journey</read:value>
                    <read:normalizedValue>journey</read:normalizedValue>
                    <read:type>WORD</read:type>
                    <read:status>NEW</read:status>
                  </read:tokens>
                  <read:tokens>
                    <read:value> </read:value>
                    <read:type>WHITESPACE</read:type>
                  </read:tokens>
                  <read:tokens>
                    <read:value>begins</read:value>
                    <read:normalizedValue>begins</read:normalizedValue>
                    <read:type>WORD</read:type>
                    <read:status>KNOWN</read:status>
                  </read:tokens>
                </read:getReadingReaderDataResponse>
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
                  <read:word>journey</read:word>
                  <read:normalizedWord>journey</read:normalizedWord>
                  <read:translation>viaje</read:translation>
                </read:lookupWordResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      if (postData.includes('setVocabularyStatusRequest')) {
        const wordMatch = postData.match(/<read:word>(.*?)<\/read:word>/);
        const statusMatch = postData.match(/<read:status>(.*?)<\/read:status>/);
        if (wordMatch) capturedWord = wordMatch[1];
        if (statusMatch) capturedStatus = statusMatch[1];

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

      return route.continue();
    });

    // Seed session to be authenticated with onboarding completed
    await page.addInitScript(() => {
      sessionStorage.setItem('accessToken', 'mock-test-token-123');
      sessionStorage.setItem('onboardingCompleted', 'true');
    });

    // Navigate directly to reader page
    await page.goto('/reading/reading-101');

    // Wait for reading to load
    await expect(page.locator('h1')).toHaveText('The Forest Adventure');

    // Find the word "journey"
    const journeyToken = page.locator('button.reader-word, span.reader-token, button').filter({ hasText: /^journey$/i }).first();
    await expect(journeyToken).toBeVisible();

    // Click the word
    await journeyToken.click();

    // Popover appears
    const popover = page.locator('.reader-popover');
    await expect(popover).toBeVisible();

    // Click status "LEARNING"
    const learningBtn = popover.getByRole('button', { name: 'LEARNING', exact: true });
    await learningBtn.click();

    // Verify SOAP request was dispatched
    expect(capturedWord.toLowerCase()).toBe('journey');
    expect(capturedStatus).toBe('LEARNING');

    // Verify the popover now marks LEARNING as active
    await expect(learningBtn).toHaveAttribute('aria-pressed', 'true');
  });
});
