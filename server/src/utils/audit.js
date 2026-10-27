import crypto from 'crypto';
import { Audit } from '../models/index.js';

// Tamper-evident audit trail: each entry stores sha256(prevHash + its own content).
// Editing or deleting any row breaks the chain, which /api/audit/verify detects.
let queue = Promise.resolve();
export const hashEntry = (e) => crypto.createHash('sha256').update(
  `${e.prevHash}|${e.seq}|${e.action}|${e.user || ''}|${e.file || ''}|${JSON.stringify(e.details || {})}|${new Date(e.createdAt).toISOString()}`
).digest('hex');

export function audit(req, action, { file, details, user } = {}) {
  const u = user || req?.user;
  const entry = {
    user: u?._id, userName: u?.name || 'Anonymous (share link)', action,
    file: file?._id, fileName: file?.name, details: JSON.parse(JSON.stringify(details || {})),
    ip: req?.ip, userAgent: req?.headers?.['user-agent']?.slice(0, 160), createdAt: new Date(),
  };
  queue = queue.then(async () => {
    const last = await Audit.findOne().sort({ seq: -1 });
    entry.seq = (last?.seq || 0) + 1;
    entry.prevHash = last?.hash || 'GENESIS';
    entry.hash = hashEntry(entry);
    await Audit.create(entry);
  }).catch((e) => console.error('audit failed', e));
  return queue;
}
