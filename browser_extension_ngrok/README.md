# EthicalStack Browser Extension

A Chrome/Edge MV3 extension that looks up ethical AI glossary terms using the EthicalStack API.

## Features

- Right-click selected text to lookup a term
- Automatic fallback search with "Did you mean..." suggestions
- Popup UI showing definitions, aliases, and sources
- Options page to set the API base URL

## Setup

1. Start the API locally:
   - `uvicorn app.main:app --reload`
2. In Chrome, open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this `browser_extension` folder.
5. Select text on any page, right-click, and choose **Lookup "<term>" in EthicalStack**.

## Configuration

- Open the extension menu and click **Options** to set the API base URL.
- Default base URL is `http://localhost:8000`.

## Notes

- The extension expects the API to allow cross-origin requests. If you see CORS errors, confirm the API CORS settings.
- Reload the extension after pulling updates.
