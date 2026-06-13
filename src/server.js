// server.js — Local development server for Fracture Studio v6.0
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleAnalyze } from './analyze-handler.js';
import { handleTextStream } from './text-stream-handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '500kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.options('*', (req, res) => res.status(204).end());

app.post('/api/analyze', (req, res) => handleAnalyze(req, res));
app.post('/api/chat', (req, res) => handleTextStream(req, res, 'chat'));
app.post('/api/rebuttal', (req, res) => handleTextStream(req, res, 'rebuttal'));

app.get('/api/public-config', (req, res) => {
  res.json({ firebaseConfig: null });
});

app.post('/api/verify-sources', async (req, res) => {
  res.json({ claims: [], verified_at: new Date().toISOString() });
});

app.post('/api/report-pdf', (req, res) => {
  res.status(501).json({ error: 'PDF export requires deployment. Download text report instead.' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Fracture Studio v6.0 running on http://localhost:${PORT}`);
  console.log('Set OPENROUTER_API_KEY in .env to enable analysis.');
});
