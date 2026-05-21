<p align="center">
  <img src="assets/cloudflare-logo.jpg" width="120" height="120" alt="Cloudflare Logo">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933" alt="Node.js">
  <img src="https://img.shields.io/badge/Playwright-1.52%2B-45ba4b" alt="Playwright">
</p>

<p align="center">
  A lightweight, self-hosted API server that bypasses Cloudflare Turnstile protection — no third-party dependencies, built entirely from scratch with Playwright.
</p>

---

## Overview

Cloudflare Turnstile is a browser challenge that blocks automated requests. Most tools fail because they leave detectable fingerprints. This solution uses a real browser with anti-detection measures to obtain a valid `cf_clearance` cookie, which can then be reused across any HTTP client.

### How It Works

```
                          ┌─────────────────────────┐
                          │   Your Application /     │
                          │   CLI / Script           │
                          └──────────┬──────────────┘
                                     │ POST /cloudflare
                                     ▼
┌────────────────────────────────────────────────────────────┐
│                    Cloudflare Bypass API                    │
│                                                            │
│  1. Launches Chromium with anti-detection patches          │
│  2. Navigates to target URL                                │
│  3. Waits for Cloudflare to issue cf_clearance cookie      │
│  4. Returns { cf_clearance, user_agent, elapsed }          │
└────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────────┐
                          │   Inject cookie into     │
                          │   Playwright / curl /    │
                          │   axios / fetch          │
                          └─────────────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────────┐
                          │   Access protected page  │
                          │   Cloudflare-free        │
                          └─────────────────────────┘
```

### Why This Approach Wins

| Method | Cloudflare Bypass | Notes |
|--------|:-----------------:|-------|
| Standard Playwright / Puppeteer | ❌ | Bot fingerprints detectable |
| puppeteer-extra + StealthPlugin | ❌ | Turnstile catches modern versions |
| cloudscraper (Python) | ❌ | Only handles legacy JS challenges |
| FlareSolverr | ⚠️ | Requires Docker, heavy |
| **This project** | ✅ | Headless + headed, no Docker, fast |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- [Google Chrome](https://www.google.com/chrome/) or Chromium installed

### Installation

```bash
# Clone the repository
git clone https://github.com/Radit-lab/cloudflare-bypass.git
cd cloudflare-bypass

# Install dependencies
npm install
```

### Running the Server

```bash
npm start
```

The server starts on `http://localhost:8191` and is ready to accept requests.

---

## API Reference

### `POST /cloudflare`

Bypasses Cloudflare protection for a given URL and returns a clearance cookie.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | `string` | Yes | Must be `"iuam"` |
| `domain` | `string` | Yes | Full URL of the protected page (e.g. `https://example.com`) |

#### Example

```bash
curl -X POST http://localhost:8191/cloudflare \
  -H "Content-Type: application/json" \
  -d '{"mode":"iuam","domain":"https://example.com"}'
```

#### Success Response (200)

```json
{
  "cf_clearance": "FAw86m0.7yOI4vQUd...",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...",
  "elapsed": "1.23s"
}
```

| Field | Description |
|-------|-------------|
| `cf_clearance` | Cloudflare clearance cookie value |
| `user_agent` | Browser User-Agent string (must match the cookie) |
| `elapsed` | Time taken to obtain clearance |

---

## Integration Examples

### Node.js (fetch)

```javascript
const response = await fetch('http://localhost:8191/cloudflare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'iuam',
    domain: 'https://target-site.com'
  }),
});

const { cf_clearance, user_agent } = await response.json();

// Now make authenticated requests
const page = await fetch('https://target-site.com/dashboard', {
  headers: {
    'User-Agent': user_agent,
    'Cookie': `cf_clearance=${cf_clearance};`,
  },
});
```

### Python (requests)

```python
import requests

# Step 1: Get clearance
resp = requests.post('http://localhost:8191/cloudflare', json={
    'mode': 'iuam',
    'domain': 'https://target-site.com',
})
data = resp.json()

# Step 2: Access protected page
headers = {
    'User-Agent': data['user_agent'],
    'Cookie': f"cf_clearance={data['cf_clearance']};",
}
page = requests.get('https://target-site.com', headers=headers)
print(page.text)
```

### Playwright (full browser automation)

```javascript
import { chromium } from 'playwright';

// Step 1: Get clearance
const resp = await fetch('http://localhost:8191/cloudflare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: 'iuam', domain: 'https://target-site.com' }),
});
const { cf_clearance, user_agent } = await resp.json();

// Step 2: Launch browser with clearance cookie
const browser = await chromium.launch();
const context = await browser.newContext({ userAgent: user_agent });
await context.addCookies([{
  name: 'cf_clearance',
  value: cf_clearance,
  domain: '.target-site.com',
  path: '/',
  httpOnly: true,
  secure: true,
}]);

// Step 3: Navigate — no Cloudflare challenge
const page = await context.newPage();
await page.goto('https://target-site.com');
// Interact freely: fill forms, click buttons, scrape...
```

---

## Technical Details

### Anti-Detection Measures

Cloudflare Turnstile analyzes browser fingerprints to detect automation. This project defeats those checks by:

1. **Removing the `navigator.webdriver` flag** — the most common automation indicator
2. **Spoofing browser plugins** — real browsers expose plugin data
3. **Setting proper language and timezone** — matches a genuine user profile
4. **Running with a real Chrome profile** — avoids default flags that give away automation

### Cookie Reuse

The `cf_clearance` cookie is valid for the duration set by Cloudflare (typically minutes to hours). Within that window, any HTTP client can access protected pages without triggering the challenge — as long as the User-Agent matches.

---

## Contributing

Contributions are welcome. Open an issue or submit a pull request.

## License

[MIT](LICENSE)

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/Radit-lab">Radit-lab</a>
</p>
