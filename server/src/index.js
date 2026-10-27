import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cfg from './config.js';
import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';
import publicRoutes from './routes/public.js';
import auditRoutes from './routes/audit.js';
import adminRoutes from './routes/admin.js';

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || !cfg.client || cfg.client === '*' || origin === cfg.client || origin.endsWith('.onrender.com')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  exposedHeaders: ['Content-Disposition'],
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(morgan('dev'));

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60000, max: 100 }), authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api', adminRoutes); // /stats, /users

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: `Files can be up to ${cfg.maxFileMB} MB` });
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on our side' });
});

mongoose.connect(cfg.mongo).then(() => {
  app.listen(cfg.port, () => console.log(`SafeShare API ready on :${cfg.port}`));
}).catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
