import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import cfg from './config.js';
import { User, FileDoc, Audit } from './models/index.js';
import { storeVersion } from './utils/files.js';
import { audit } from './utils/audit.js';

await mongoose.connect(cfg.mongo);
await Promise.all([User.deleteMany(), FileDoc.deleteMany(), Audit.deleteMany()]);
await fs.rm(cfg.storageDir, { recursive: true, force: true });

const mk = async (name, email, role, pw) => User.create({ name, email, role, passwordHash: await bcrypt.hash(pw, 12) });
const admin = await mk('Aarav Admin', 'admin@safeshare.com', 'admin', 'Admin@123');
const alice = await mk('Alice Menon', 'alice@safeshare.com', 'member', 'Pass@1234');
const bob = await mk('Bob Kumar', 'bob@safeshare.com', 'member', 'Pass@1234');
const carol = await mk('Carol Iyer', 'carol@safeshare.com', 'member', 'Pass@1234');

async function add(owner, name, mimeType, versions) {
  const f = new FileDoc({ name, mimeType, owner: owner._id, versions: [] });
  for (const [text, note, by] of versions) await storeVersion(f, Buffer.from(text), (by || owner)._id, note);
  await f.save(); await audit(null, 'file.upload', { file: f, user: owner, details: { size: f.size, encrypted: 'AES-256-GCM' } });
  return f;
}
const budget = await add(alice, 'Q3-Budget-Forecast.csv', 'text/csv', [
  ['dept,budget\nEngineering,420000\nSales,310000\n', 'Initial draft'],
  ['dept,budget\nEngineering,450000\nSales,310000\nMarketing,180000\n', 'Added marketing line', bob],
  ['dept,budget\nEngineering,450000\nSales,335000\nMarketing,180000\nLegal,90000\n', 'Final numbers after CFO review']]);
budget.permissions.push({ user: bob._id, role: 'editor', canDownload: true, grantedBy: alice._id },
  { user: carol._id, role: 'viewer', canDownload: false, grantedBy: alice._id, expiresAt: new Date(Date.now() + 7 * 86400000) });
await budget.save();
await audit(null, 'file.share', { file: budget, user: alice, details: { with: 'bob@safeshare.com', role: 'editor' } });
await audit(null, 'file.share', { file: budget, user: alice, details: { with: 'carol@safeshare.com', role: 'viewer', canDownload: false } });

const nda = await add(alice, 'Vendor-NDA-2026.md', 'text/markdown', [['# Mutual NDA\n\nConfidential. Do not distribute.\n', 'Initial upload']]);
const roadmap = await add(bob, 'Product-Roadmap.json', 'application/json', [['{"q4":["SSO","audit export"],"q1":["mobile app"]}', 'Initial upload']]);
roadmap.permissions.push({ user: alice._id, role: 'viewer', canDownload: true, grantedBy: bob._id }); await roadmap.save();
await audit(null, 'file.share', { file: roadmap, user: bob, details: { with: 'alice@safeshare.com', role: 'viewer' } });
await audit(null, 'auth.login_failed', { user: carol, details: { reason: 'bad password' } });
console.log('Seeded.\n  admin@safeshare.com / Admin@123\n  alice@safeshare.com / Pass@1234\n  bob@safeshare.com   / Pass@1234\n  carol@safeshare.com / Pass@1234');
await mongoose.disconnect();
