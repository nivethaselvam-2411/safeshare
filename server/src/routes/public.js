import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { FileDoc } from '../models/index.js';
import { audit } from '../utils/audit.js';
import { readVersion } from '../utils/files.js';

const r = Router();
r.use(rateLimit({ windowMs: 10 * 60000, max: 40 }));
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

async function findLink(token) {
  const file = await FileDoc.findOne({ 'links.token': token, deletedAt: null }).populate('owner', 'name');
  const link = file?.links.find((l) => l.token === token);
  if (!link || link.revoked || link.expiresAt < new Date()) return {};
  if (link.maxDownloads && link.downloads >= link.maxDownloads) return {};
  return { file, link };
}

r.get('/:token', wrap(async (req, res) => {
  const { file, link } = await findLink(req.params.token);
  if (!file) return res.status(404).json({ message: 'This link has expired or been revoked' });
  res.json({ name: file.name, size: file.size, mimeType: file.mimeType, sharedBy: file.owner.name,
    expiresAt: link.expiresAt, hasPassword: !!link.passwordHash,
    remaining: link.maxDownloads ? link.maxDownloads - link.downloads : null });
}));

r.post('/:token/download', wrap(async (req, res) => {
  const { file, link } = await findLink(req.params.token);
  if (!file) return res.status(404).json({ message: 'This link has expired or been revoked' });
  if (link.passwordHash && !(await bcrypt.compare(req.body.password || '', link.passwordHash))) {
    await audit(req, 'link.bad_password', { file });
    return res.status(401).json({ message: 'Incorrect link password' });
  }
  const out = await readVersion(file);
  link.downloads += 1; await file.save();
  await audit(req, 'link.download', { file, details: { token: req.params.token.slice(0, 6) + '…' } });
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
  res.send(out.buffer);
}));
export default r;
