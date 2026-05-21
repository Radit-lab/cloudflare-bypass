# Cloudflare Bypass

A standalone API server that bypasses Cloudflare Turnstile protection using a real browser. No third-party bypass tools — built from scratch with Playwright.

## How it works

1. Launches a real Chromium browser with anti-detection measures
2. Navigates to the target URL
3. Waits for Cloudflare to issue a `cf_clearance` cookie
4. Returns the cookie + user-agent
5. You inject the cookie into your own browser session

## Usage

### Start the server

```bash
npm install
npm start
```

### Call the API

```bash
curl -X POST http://localhost:8191/cloudflare \
  -H "Content-Type: application/json" \
  -d '{"mode":"iuam","domain":"https://market-qx.trade/en/sign-in"}'
```

Response:
```json
{
  "cf_clearance": "FAw86m0...",
  "user_agent": "Mozilla/5.0 ...",
  "elapsed": "1.23s"
}
```

### Use the cookie in your own script

```js
const response = await fetch('http://localhost:8191/cloudflare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: 'iuam', domain: 'https://example.com' }),
});
const { cf_clearance, user_agent } = await response.json();

// Now use with any HTTP client
const res = await fetch('https://example.com', {
  headers: {
    'User-Agent': user_agent,
    'Cookie': `cf_clearance=${cf_clearance};`
  }
});
```

## Why this works

Cloudflare's Turnstile detects headless browsers by checking:
- `navigator.webdriver` property
- Missing browser plugins
- Automation-specific flags

This solution masks all those signals before the page loads.
