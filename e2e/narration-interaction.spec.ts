import { test, expect } from '@playwright/test';

test.describe('Browser Integration: Narration Interaction Flow', () => {
  test('start narration -> clicking a word stops narration & opens popover without auto-resuming', async ({ page }) => {
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
                  <read:readingId>reading-202</read:readingId>
                  <read:title>The Quiet Valley</read:title>
                  <read:language>en</read:language>
                  <read:progressStatus>IN_PROGRESS</read:progressStatus>
                  <read:currentPartOrdinal>1</read:currentPartOrdinal>
                  <read:paginationVersion>1</read:paginationVersion>
                  <read:tokens>
                    <read:value>Silence</read:value>
                    <read:normalizedValue>silence</read:normalizedValue>
                    <read:type>WORD</read:type>
                    <read:status>NEW</read:status>
                  </read:tokens>
                  <read:tokens>
                    <read:value> </read:value>
                    <read:type>WHITESPACE</read:type>
                  </read:tokens>
                  <read:tokens>
                    <read:value>covered</read:value>
                    <read:normalizedValue>covered</read:normalizedValue>
                    <read:type>WORD</read:type>
                    <read:status>KNOWN</read:status>
                  </read:tokens>
                  <read:tokens>
                    <read:value> </read:value>
                    <read:type>WHITESPACE</read:type>
                  </read:tokens>
                  <read:tokens>
                    <read:value>the</read:value>
                    <read:normalizedValue>the</read:normalizedValue>
                    <read:type>WORD</read:type>
                    <read:status>KNOWN</read:status>
                  </read:tokens>
                  <read:tokens>
                    <read:value> </read:value>
                    <read:type>WHITESPACE</read:type>
                  </read:tokens>
                  <read:tokens>
                    <read:value>valley</read:value>
                    <read:normalizedValue>valley</read:normalizedValue>
                    <read:type>WORD</read:type>
                    <read:status>LEARNING</read:status>
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
                  <read:word>silence</read:word>
                  <read:normalizedWord>silence</read:normalizedWord>
                  <read:translation>silencio</read:translation>
                </read:lookupWordResponse>
              </soapenv:Body>
            </soapenv:Envelope>
          `,
        });
      }

      return route.continue();
    });

    // Provide test-only mock for speech synthesis voices and events in headless environment
    await page.addInitScript(() => {
      sessionStorage.setItem('accessToken', 'mock-test-token-123');
      sessionStorage.setItem('onboardingCompleted', 'true');

      if (typeof window !== 'undefined') {
        class MockUtterance extends EventTarget {
          text = '';
          lang = 'en';
          voice = null;
          rate = 1;
          pitch = 1;
          volume = 1;
          onstart = null;
          onend = null;
          onerror = null;
          onpause = null;
          onresume = null;
          onmark = null;
          onboundary = null;
          constructor(text?: string) {
            super();
            if (text) this.text = text;
          }
        }
        window.SpeechSynthesisUtterance = MockUtterance as unknown as typeof SpeechSynthesisUtterance;

        const mockVoice = {
          default: true,
          lang: 'en-US',
          localService: true,
          name: 'Mock English Voice',
          voiceURI: 'mock-en',
        };
        window.speechSynthesis.getVoices = () => [mockVoice as unknown as SpeechSynthesisVoice];
        window.speechSynthesis.speak = () => {};
        window.speechSynthesis.cancel = () => {};
        window.speechSynthesis.pause = () => {};
        window.speechSynthesis.resume = () => {};
      }
    });

    await page.goto('/reading/reading-202');
    await expect(page.locator('h1')).toHaveText('The Quiet Valley');

    // Narration launch button should be present
    const narrationBtn = page.locator('button.narration-launch');
    await expect(narrationBtn).toBeVisible();

    // Start narration
    await narrationBtn.click();

    // The dock should now appear with playback controls
    const narrationDock = page.locator('.narration-dock');
    await expect(narrationDock).toBeVisible();

    // Now click a word ("Silence") in the reader stream
    const silenceToken = page.locator('button.reader-word, span.reader-token, button').filter({ hasText: /^Silence$/i }).first();
    await silenceToken.click();

    // Word popover opens
    const popover = page.locator('.reader-popover');
    await expect(popover).toBeVisible();

    // Observable state verification:
    // 1. Calling narration.stop() destroyed the dock from DOM
    await expect(narrationDock).not.toBeVisible();

    // 2. Launch button returned to IDLE state in the DOM
    await expect(narrationBtn).toBeVisible();

    // 3. No playing button or dock exists
    await expect(page.locator('.narration-primary')).toHaveCount(0);

    // 4. Verify no auto-resume: wait and confirm narration dock does NOT reappear
    await page.waitForTimeout(500);
    await expect(narrationDock).not.toBeVisible();
    await expect(narrationBtn).toBeVisible();
    await expect(popover).toBeVisible();
  });
});
