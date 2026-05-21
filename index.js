import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const PORT = 8191;

// --- Core: Get cf_clearance cookie using a real browser ---
async function solveCloudflare(targetUrl) {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    locale: 'en-US',
    timezoneId: 'America/New_York',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // Remove Playwright's automation痕迹
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });

  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });

  // Wait for Cloudflare to clear (up to 30s)
  let cfClearance = null;
  for (let i = 0; i < 30; i++) {
    const cookies = await context.cookies();
    cfClearance = cookies.find(c => c.name === 'cf_clearance');
    if (cfClearance) break;
    await page.waitForTimeout(1000);
  }

  if (!cfClearance) {
    await browser.close();
    throw new Error('Cloudflare clearance failed — could not get cf_clearance cookie');
  }

  const userAgent = await page.evaluate(() => navigator.userAgent);
  await browser.close();

  return {
    cfClearance: cfClearance.value,
    domain: cfClearance.domain,
    userAgent,
  };
}

// --- API Server ---
import { createServer } from 'http';

const server = createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/cloudflare') {
    res.writeHead(404);
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { mode, domain, url } = JSON.parse(body);
      const target = url || domain;

      if (mode !== 'iuam') {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'Only iuam mode supported' }));
      }

      const start = Date.now();
      const result = await solveCloudflare(target);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2) + 's';

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        cf_clearance: result.cfClearance,
        user_agent: result.userAgent,
        elapsed,
      }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Cloudflare Bypass API running on http://localhost:${PORT}`);
  console.log(`POST /cloudflare with { "mode": "iuam", "domain": "https://..." }`);
});
