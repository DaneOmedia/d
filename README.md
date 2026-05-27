# Mortgage AI Underwriter

An AI-powered mortgage pre-underwriting agent. Upload your documents (1003, paystubs, bank statements, W2s) and get back a structured underwriting decision with conditions, risk flags, and guideline notes — powered by Claude.

---

## How to Run Locally

### 1. Clone and install dependencies

```bash
git clone <your-repo>
cd <repo-folder>

# Install all dependencies (root + server + client)
npm run install:all
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
TEAM_PASSWORD=optionlogin
PORT=3001
NODE_ENV=development
```

- `ANTHROPIC_API_KEY` — Get yours at [console.anthropic.com](https://console.anthropic.com/)
- `TEAM_PASSWORD` — Password to log into the app (default: `optionlogin`)
- `PORT` — Backend port (default: `3001`)

### 3. Start the app

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend (port 5173) concurrently.

Open: **http://localhost:5173**

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic Claude API key |
| `TEAM_PASSWORD` | Yes | Login password for the app |
| `PORT` | No | Backend port (default: 3001) |
| `NODE_ENV` | No | `development` or `production` |

---

## Usage

1. **Log in** with your team password
2. **Upload documents** — drag & drop or click to browse (PDF, JPG, PNG)
3. **Label each document** using the dropdown (1003, Paystub, W2, Bank Statement, etc.)
4. **Select loan parameters** — Loan type (Conventional/FHA/VA/USDA), purpose, and occupancy
5. **Click "Run Pre-Underwrite Analysis"**
6. Review the structured results: verdict, extracted data, conditions, risk flags, compensating factors, and guideline notes
7. Use **"New Scenario (same docs)"** to re-run with different loan parameters on the same files

---

## Deploy to Railway

### 1. Push to GitHub

```bash
git add .
git commit -m "initial commit"
git push origin main
```

### 2. Create Railway project

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select your repository
3. Railway auto-detects Node.js

### 3. Set environment variables

In your Railway service → **Variables** tab, add:
- `ANTHROPIC_API_KEY` = your Anthropic key
- `TEAM_PASSWORD` = your login password
- `NODE_ENV` = `production`

Railway automatically injects `PORT` — do not set it manually.

### 4. Build command

Railway will use the `railway.json` config:
- **Build**: `npm run build` (builds the React client)
- **Start**: `node server/index.js` (serves API + static files)

### 5. Get your URL

After deploy → **Settings** → **Networking** → **Generate Domain**

---

## Supported Document Types

- **1003 / URLA** — Uniform Residential Loan Application
- **Paystubs** — Most recent 30-day paystubs
- **W2s** — Last 2 years
- **Bank Statements** — Last 2 months
- **Tax Returns** — 1040s (used for self-employed income)
- **Credit Reports** — Tri-merge credit reports
- **Purchase Contracts** — Sales agreements
- **Other** — VOE, gift letters, LOE, etc.

---

## Loan Programs

| Program | Min FICO | Max LTV | Max DTI |
|---|---|---|---|
| Conventional | 620 | 97% (primary) | 50% w/ DU Approve |
| FHA | 580 | 96.5% | 57% w/ comp. factors |
| VA | 580 (overlay) | 100% | 41% guideline |
| USDA | 640 | 100% + fee | 41% |

---

## Architecture

```
/client          React + Vite + Tailwind CSS frontend
/server          Node.js + Express backend
  /routes        auth.js, analyze.js
  /utils         claude.js (AI integration)
.env             API keys and config (not committed)
railway.json     Railway deployment config
```
