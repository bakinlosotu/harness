# Harness

Bring-your-own-key multi-model assistant supporting OpenAI, Google Gemini, Anthropic (Claude), and xAI (Grok) with document RAG, free web search, and Gmail integration.

## Features

- **Multi-Model Intelligence**: Switch seamlessly between OpenAI (GPT-4o, o1, o3-mini), Google Gemini (Gemini 2.5 Flash, 2.0 Pro), Anthropic (Claude 3.5 Sonnet), and xAI (Grok) using your own API keys.
- **Document Grounding (RAG)**: Attach PDFs, Word (.docx), TXT, Markdown, CSV, or JSON. Harness parses pages, indexes content with BM25, and grounds answers with exact citations.
- **Free Web Search**: Toggle live web search with citations using Tavily free tier (1,000 searches/month), Gemini grounding, or Wikipedia fallback.
- **Gmail Integration (No OAuth)**: Connect your Gmail mailbox using a Google App Password. Browse your inbox, search emails, view threads, draft contextual replies with AI, save to Gmail drafts, or send directly with a single click. Or simply paste an email in Paste mode.
- **Zero Cloud Storage & Private**: No remote database. Conversations, documents, and settings are stored locally in your browser (IndexedDB and sessionStorage/localStorage). API keys and credentials are never logged or stored on the server.

---

## Local Development & Run

### Prerequisites
- Node.js 20+

### Option A: Full Application (Frontend + Gmail & Proxy Server)
```bash
npm install
npm run build
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Option B: Vite Dev Mode with Server Proxy
Terminal 1 (Vite dev server):
```bash
npm run dev
```

Terminal 2 (API backend for Gmail & Proxy):
```bash
npm start
```

---

## Deploying on Render

1. Push your repository to GitHub.
2. In Render Dashboard, click **New +** -> **Web Service**.
3. Connect your repository.
4. Set the following build and start commands:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. In Environment Variables, set:
   - `NODE_VERSION`: `20`
6. Click **Create Web Service**.

> **Note:** Do NOT configure any API keys on Render. Users provide their own keys in the app interface.

---

## Where to Get Your API Keys

- **Google Gemini (Free tier)**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- **OpenAI**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys) *(Requires prepaid balance)*
- **Anthropic (Claude)**: [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
- **xAI (Grok)**: [console.x.ai](https://console.x.ai)
- **Tavily (Free web search)**: [app.tavily.com](https://app.tavily.com) *(1,000 free searches/month, no credit card required)*

### Setting up a Gmail App Password

1. Visit [myaccount.google.com](https://myaccount.google.com) and go to the **Security** tab.
2. Ensure **2-Step Verification** is turned on.
3. Open [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
4. Enter an app name (such as `Harness`) and click **Create**.
5. Copy the generated 16-character password and paste it into the Keys modal in Harness.
*(Note: Some enterprise/school Google Workspace accounts restrict App Passwords. You can always use the "Paste email" feature without an App Password.)*

---

## Privacy & Security

- **Client-Side Storage**: All chats, metadata, and uploaded documents reside in your browser's IndexedDB.
- **Direct & Stateless Proxy**: When running the server, credentials and keys pass through in-memory for the duration of the request only and are never saved to disk or database.
