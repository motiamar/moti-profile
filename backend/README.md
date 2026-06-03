# Backend — Moti's Portfolio Chatbot API

Express API server. Deployed on **Render** (free tier).

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Lightweight healthcheck (used by frontend wake-up ping) |
| POST | `/ask` | Main chatbot endpoint — `{ question, clientId }` |
| POST | `/reset` | Clear conversation memory for a client — `{ clientId }` |

## Local development

```bash
cd backend
cp .env.example .env   # then fill in OPENAI_API_KEY
npm install
npm run dev            # node --watch server.js  →  http://localhost:3000
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | Your OpenAI API key |
| `FRONTEND_URL` | Yes (prod) | URL of the static frontend — used for CORS |
| `PORT` | No | Port to listen on (Render sets this automatically) |

## Deploy to Render

1. Connect this repository on render.com
2. Set **Root Directory** to `backend`
3. Set **Build Command** to `npm install`
4. Set **Start Command** to `npm start`
5. Add environment variables: `OPENAI_API_KEY` and `FRONTEND_URL`
