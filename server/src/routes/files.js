import { Router } from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import cfg from '../config.js';
import { FileDoc, User, Audit } from '../models/index.js';
import { auth } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';
import { RANK, accessOf, storeVersion, readVersion, safeVersion, fileDto } from '../utils/files.js';

const r = Router();
r.use(auth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: cfg.maxFileMB * 1024 * 1024 } });
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PREVIEWABLE = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain|text\/csv|application\/json|text\/markdown)$/;

// Loads the file and enforces the minimum role. Unknown/unauthorised files both return 404 (no existence leak).
const withFile = (min) => wrap(async (req, res, next) => {
  const file = await FileDoc.findById(req.params.id).catch(() => null);
  const access = file && accessOf(file, req.user._id);
  if (!file || !access || (file.deletedAt && access.role !== 'owner')) return res.status(404).json({ message: 'File not found' });
  if (RANK[access.role] < RANK[min]) {
    await audit(req, 'access.denied', { file, details: { needed: min, had: access.role } });
    return res.status(403).json({ message: `You need ${min} access to do this` });
  }
  req.file_ = file; req.access = access; next();
});

// ---------- list ----------
r.get('/', wrap(async (req, res) => {
  const { scope = 'mine', q } = req.query; const me = req.user._id;
  const filter = scope === 'trash' ? { owner: me, deletedAt: { $ne: null } }
    : scope === 'shared' ? { deletedAt: null, 'permissions.user': me }
    : { owner: me, deletedAt: null };
  if (q) filter.name = new RegExp(esc(q), 'i');
  let files = await FileDoc.find(filter).sort({ updatedAt: -1 }).populate('owner', 'name email');
  if (scope === 'shared') files = files.filter((f) => accessOf(f, me)); // drops expired grants
  res.json(files.map((f) => fileDto(f, accessOf(f, me))));
}));

// ---------- upload ----------
r.post('/', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose a file to upload' });
  const name = path.basename(req.file.originalname);
  const file = new FileDoc({ name, mimeType: req.file.mimetype, owner: req.user._id, versions: [] });
  await storeVersion(file, req.file.buffer, req.user._id, 'Initial upload');
  await file.save();
  await audit(req, 'file.upload', { file, details: { size: file.size, encrypted: 'AES-256-GCM' } });
  res.status(201).json(fileDto(file, { role: 'owner', canDownload: true }));
}));

// ---------- detail ----------
r.get('/:id', withFile('viewer'), wrap(async (req, res) => {
  const f = await req.file_.populate([
    { path: 'owner', select: 'name email' }, { path: 'versions.uploadedBy', select: 'name' },
    { path: 'permissions.user', select: 'name email' }]);
  const isOwner = req.access.role === 'owner';
  await audit(req, 'file.view', { file: f });
  res.json({
    ...fileDto(f, req.access),
    versions: f.versions.map(safeVersion).reverse(),
    permissions: isOwner ? f.permissions : [],
    links: isOwner ? f.links.map((l) => ({ token: l.token, expiresAt: l.expiresAt, maxDownloads: l.maxDownloads, downloads: l.downloads,
      revoked: l.revoked, hasPassword: !!l.passwordHash, createdAt: l.createdAt })) : [],
  });
}));

r.get('/:id/activity', withFile('viewer'), wrap(async (req, res) => {
  if (req.access.role !== 'owner') return res.status(403).json({ message: 'Only the owner can see file activity' });
  res.json(await Audit.find({ file: req.file_._id }).sort({ seq: -1 }).limit(50).select('-prevHash -hash -userAgent'));
}));

// ---------- download / preview ----------
async function send(req, res, inline) {
  const out = await readVersion(req.file_, req.query.version);
  if (!out) return res.status(404).json({ message: 'Version not found' });
  const f = req.file_;
  res.setHeader('Content-Type', f.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(f.name)}"`);
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
  res.send(out.buffer);
}
r.get('/:id/download', withFile('viewer'), wrap(async (req, res) => {
  if (!req.access.canDownload) {
    await audit(req, 'access.denied', { file: req.file_, details: { needed: 'download' } });
    return res.status(403).json({ message: 'This file is view-only for you' });
  }
  await audit(req, 'file.download', { file: req.file_, details: { version: Number(req.query.version || req.file_.currentVersion) } });
  await send(req, res, false);
}));
r.get('/:id/preview', withFile('viewer'), wrap(async (req, res) => {
  if (!PREVIEWABLE.test(req.file_.mimeType || '')) return res.status(415).json({ message: 'Preview not available for this file type' });
  await send(req, res, true);
}));

// ---------- versions ----------
r.post('/:id/versions', withFile('editor'), upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose a file to upload' });
  const n = await storeVersion(req.file_, req.file.buffer, req.user._id, req.body.note || 'New version');
  await req.file_.save();
  await audit(req, 'file.version_upload', { file: req.file_, details: { version: n, size: req.file.size } });
  res.status(201).json({ version: n });
}));
r.post('/:id/versions/:n/restore', withFile('editor'), wrap(async (req, res) => {
  const old = req.file_.versions.find((v) => v.number === Number(req.params.n));
  if (!old) return res.status(404).json({ message: 'Version not found' });
  const n = (req.file_.versions.at(-1).number) + 1;
  req.file_.versions.push({ ...old.toObject(), number: n, uploadedBy: req.user._id, uploadedAt: new Date(), note: `Restored from v${old.number}` });
  req.file_.currentVersion = n; req.file_.size = old.size;
  await req.file_.save();
  await audit(req, 'file.version_restore', { file: req.file_, details: { from: old.number, to: n } });
  res.json({ version: n });
}));

// ---------- sharing (owner only) ----------
r.post('/:id/share', withFile('owner'), wrap(async (req, res) => {
  const { email, role = 'viewer', canDownload = false, expiresAt } = req.body;
  const target = await User.findOne({ email: (email || '').toLowerCase() });
  if (!target) return res.status(404).json({ message: 'No user with that email. Ask them to register first.' });
  if (String(target._id) === String(req.user._id)) return res.status(400).json({ message: 'You already own this file' });
  if (!['viewer', 'editor'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
  const perm = { user: target._id, role, canDownload: role === 'editor' ? true : !!canDownload, expiresAt: expiresAt ? new Date(expiresAt) : undefined, grantedBy: req.user._id };
  const i = req.file_.permissions.findIndex((p) => String(p.user) === String(target._id));
  if (i >= 0) req.file_.permissions[i] = perm; else req.file_.permissions.push(perm);
  await req.file_.save();
  await audit(req, 'file.share', { file: req.file_, details: { with: target.email, role, canDownload: perm.canDownload, expiresAt: perm.expiresAt } });
  res.json({ ok: true });
}));
r.delete('/:id/share/:userId', withFile('owner'), wrap(async (req, res) => {
  req.file_.permissions = req.file_.permissions.filter((p) => String(p.user) !== req.params.userId);
  await req.file_.save();
  await audit(req, 'file.unshare', { file: req.file_, details: { userId: req.params.userId } });
  res.json({ ok: true });
}));

r.post('/:id/links', withFile('owner'), wrap(async (req, res) => {
  const { password, expiresInHours = 24, maxDownloads } = req.body;
  const link = { token: crypto.randomBytes(24).toString('base64url'), createdBy: req.user._id,
    expiresAt: new Date(Date.now() + Math.min(Number(expiresInHours) || 24, 24 * 30) * 3600000),
    maxDownloads: maxDownloads ? Number(maxDownloads) : undefined,
    passwordHash: password ? await bcrypt.hash(password, 10) : undefined };
  req.file_.links.push(link); await req.file_.save();
  await audit(req, 'link.create', { file: req.file_, details: { expiresAt: link.expiresAt, passwordProtected: !!password, maxDownloads: link.maxDownloads } });
  res.status(201).json({ token: link.token });
}));
r.delete('/:id/links/:token', withFile('owner'), wrap(async (req, res) => {
  const l = req.file_.links.find((x) => x.token === req.params.token);
  if (l) l.revoked = true;
  await req.file_.save(); await audit(req, 'link.revoke', { file: req.file_ });
  res.json({ ok: true });
}));

// ---------- trash ----------
r.delete('/:id', withFile('owner'), wrap(async (req, res) => {
  req.file_.deletedAt = new Date(); await req.file_.save();
  await audit(req, 'file.trash', { file: req.file_ }); res.json({ ok: true });
}));
r.post('/:id/restore', withFile('owner'), wrap(async (req, res) => {
  req.file_.deletedAt = undefined; await req.file_.save();
  await audit(req, 'file.restore', { file: req.file_ }); res.json({ ok: true });
}));
r.delete('/:id/permanent', withFile('owner'), wrap(async (req, res) => {
  await Promise.all(req.file_.versions.map((v) => fs.unlink(path.join(cfg.storageDir, v.storageName)).catch(() => {})));
  await audit(req, 'file.delete', { file: req.file_, details: { versions: req.file_.versions.length, note: 'ciphertext shredded' } });
  await req.file_.deleteOne(); res.json({ ok: true });
}));

export default r;
