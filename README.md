# GHL Cold Email Outreach Webhook

A Node.js webhook server that listens for GoHighLevel contact events, generates a personalized cold outreach email with Claude AI, and sends it back through GoHighLevel automatically.

## How It Works

1. GoHighLevel triggers a webhook when a contact enters a workflow step
2. This server extracts the contact's name, company, email, and industry
3. Claude writes a short, human-sounding cold email tailored to that contact
4. The server sends the email via the GHL API

---

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key — get it at [console.anthropic.com](https://console.anthropic.com/) |
| `GHL_API_KEY` | Your GoHighLevel API key — found in GHL > Settings > Integrations > API |
| `PORT` | (Optional) Port to listen on. Defaults to `3000`. Railway sets this automatically. |

---

## Deploy to Railway.app — Step by Step

### 1. Push this repo to GitHub

```bash
git init
git add .
git commit -m "initial commit"
gh repo create your-repo-name --public --push
```

Or push to an existing repo.

### 2. Create a new Railway project

1. Go to [railway.app](https://railway.app) and log in
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Railway will auto-detect Node.js and deploy it

### 3. Add environment variables

In your Railway project dashboard:

1. Click your service → **Variables** tab
2. Add the following:
   - `ANTHROPIC_API_KEY` = your Anthropic key
   - `GHL_API_KEY` = your GoHighLevel API key
3. Railway automatically injects `PORT` — do not set it manually

### 4. Get your public URL

After deploy, go to **Settings** → **Networking** → **Generate Domain**.

Your webhook URL will be:
```
https://your-app.up.railway.app/webhook
```

Your health check URL:
```
https://your-app.up.railway.app/health
```

### 5. Configure GoHighLevel Webhook

1. In GHL, open your **Workflow**
2. Add a **Webhook** action step
3. Set method to **POST**
4. Paste your Railway webhook URL: `https://your-app.up.railway.app/webhook`
5. Set the payload to **Custom** and map the fields (see sample payload below)

---

## Sample GHL Webhook Payload

Use this as a reference when building your GHL workflow webhook action. Map your contact fields to these keys:

```json
{
  "first_name": "Sarah",
  "company_name": "Apex Roofing Co",
  "email": "sarah@apexroofing.com",
  "industry": "Home Services",
  "contact_id": "abc123xyz",
  "contactId": "abc123xyz"
}
```

> **Tip:** In the GHL workflow webhook step, use the **Custom Body** option and map each field using GHL's merge tags (e.g. `{{contact.first_name}}`).

Example GHL custom body template:

```json
{
  "first_name": "{{contact.first_name}}",
  "company_name": "{{contact.company_name}}",
  "email": "{{contact.email}}",
  "industry": "{{contact.industry}}",
  "contact_id": "{{contact.id}}"
}
```

---

## Local Development

```bash
# Install dependencies
npm install

# Copy env file and fill in your keys
cp .env.example .env

# Start the server
npm start

# Or with auto-reload
npm run dev
```

Test your webhook locally with curl:

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Sarah",
    "company_name": "Apex Roofing Co",
    "email": "sarah@apexroofing.com",
    "industry": "Home Services",
    "contact_id": "abc123xyz"
  }'
```

Check health:

```bash
curl http://localhost:3000/health
```

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/webhook` | Receives GHL contact data and sends personalized email |
| `GET` | `/health` | Returns `server is running` |
