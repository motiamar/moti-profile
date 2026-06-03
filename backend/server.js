// server.js — Express entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const chatRoutes = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: allow the static frontend and localhost for local dev.
// Set FRONTEND_URL on Render to your GitHub Pages / Netlify / Vercel URL.
const allowedOrigins = [
  'http://localhost:5173',  // Vite dev server
  'http://localhost:4173',  // Vite preview
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Lightweight healthcheck — used by the frontend wake-up ping
app.get('/health', (_, res) => res.send('OK'));

app.use('/', chatRoutes);

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
