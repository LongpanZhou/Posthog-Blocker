# No-PostHog 🛡️

A Chrome extension that blocks PostHog analytics tracking while maintaining website functionality.

## Features

**Payload-Based Detection** - Detects and blocks PostHog events by analyzing request payloads, not just URLs  
**Proxy Support** - Works with proxied PostHog instances (custom domains)  

## How It Works

1. **Intercepts Network Requests** - Monitors `fetch()`, `XMLHttpRequest.send()`, and `navigator.sendBeacon()`
2. **Decompresses Data** - Automatically decompresses gzip/lz64 encoded payloads
3. **Detects PostHog Signatures** - Looks for PostHog event structure: `"event"`, `"properties"`, and identifier fields
4. **Blocks Silently** - Returns fake success response so websites don't error
5. **Optional Logging** - Shows blocked events in console with event name, URL, and user ID

## Installation

### From Chrome Web Store
N/A not planned

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Go to `chrome://extensions/`
3. Enable **"Developer mode"** (top right)
4. Click **"Load unpacked"**
5. Select the `frontend/no-posthog/` folder

## Usage

### Basic Usage
The extension works automatically once installed. It blocks PostHog events by default.

### Toggle Settings

Click the extension icon to open the popup:

- **Blocking ON/OFF** - Enable/disable event blocking
- **Logging ON/OFF** - Enable/disable console logs of blocked events

### View Blocked Events

Open DevTools (F12) and check the Console tab. You'll see messages like:

```
[No-PostHog] Blocked:
📊 Event: $pageview
   URL: https://example.com/page
   Path: /page
   User: abc123def456...
```
## Technical Details

### Blocked Request Types
- Compressed payloads (gzip, lz64)
- Plain JSON payloads
- Batch events
- Single events
- Session recording streams

### PostHog Signature Detection
The extension looks for:
- `"event"` + `"properties"` (event structure)
- Plus one of: `"$lib"`, `"distinct_id"`, `"api_key"`, `"token"`