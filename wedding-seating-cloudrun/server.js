import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { Firestore } from '@google-cloud/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 8080);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const memoryStore = new Map();
const useFirestore = String(process.env.USE_FIRESTORE || 'true') !== 'false';
let firestore = null;

if (useFirestore) {
  try {
    firestore = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || undefined
    });
    console.log('Firestore enabled');
  } catch (error) {
    console.warn('Firestore init failed; fallback to memory store:', error.message);
  }
} else {
  console.log('Firestore disabled; using memory store');
}

function getDefaultProject(projectId) {
  return {
    projectId,
    guests: [],
    layouts: [
      {
        id: 'l1',
        name: '基本プラン',
        tables: [
          { id: 't1', name: '松', capacity: 8 },
          { id: 't2', name: '竹', capacity: 8 },
          { id: 't3', name: '梅', capacity: 8 },
          { id: 't4', name: '蘭', capacity: 8 }
        ],
        assignments: {},
        gridCols: 2
      }
    ],
    activeLayoutId: 'l1',
    updatedAt: new Date().toISOString()
  };
}

function cleanProjectId(raw) {
  return String(raw || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!Array.isArray(payload.guests)) return false;
  if (!Array.isArray(payload.layouts)) return false;
  if (typeof payload.activeLayoutId !== 'string') return false;
  return true;
}

async function readProject(projectId) {
  if (firestore) {
    const ref = firestore.collection('wedding_seating_projects').doc(projectId);
    const snap = await ref.get();
    if (snap.exists) {
      return snap.data();
    }
  }

  if (memoryStore.has(projectId)) {
    return memoryStore.get(projectId);
  }

  return getDefaultProject(projectId);
}

async function writeProject(projectId, data) {
  const payload = {
    ...data,
    projectId,
    updatedAt: new Date().toISOString()
  };

  if (firestore) {
    const ref = firestore.collection('wedding_seating_projects').doc(projectId);
    await ref.set(payload, { merge: true });
  }

  memoryStore.set(projectId, payload);
  return payload;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, storage: firestore ? 'firestore' : 'memory', now: new Date().toISOString() });
});

app.get('/api/projects/:projectId', async (req, res) => {
  const projectId = cleanProjectId(req.params.projectId);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project id' });
  }

  try {
    const data = await readProject(projectId);
    return res.json(data);
  } catch (error) {
    console.error('GET project failed:', error);
    return res.status(500).json({ error: 'Failed to read project' });
  }
});

app.put('/api/projects/:projectId', async (req, res) => {
  const projectId = cleanProjectId(req.params.projectId);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project id' });
  }

  if (!validatePayload(req.body)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    const saved = await writeProject(projectId, req.body);
    return res.json({ ok: true, updatedAt: saved.updatedAt });
  } catch (error) {
    console.error('PUT project failed:', error);
    return res.status(500).json({ error: 'Failed to save project' });
  }
});

const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Wedding Seating app listening on http://localhost:${PORT}`);
});
