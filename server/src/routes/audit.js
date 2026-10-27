import { Router } from 'express';
import { Audit, FileDoc } from '../models/index.js';
import { auth, adminOnly } from '../middleware/auth.js';
import { hashEntry } from '../utils/audit.js';

const r = Router();
r.use(auth);
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

r.get('/', wrap(async (req, res) => {
  const { action, page = 1, limit = 25 } = req.query;
  const filter = {};
  if (action) filter.action = new RegExp('^' + action.replace(/[^\w.]/g, ''));
  if (req.user.role !== 'admin') {
    const mine = await FileDoc.find({ owner: req.user._id }).distinct('_id');
    filter.$or = [{ user: req.user._id }, { file: { $in: mine } }];
  }
  const [items, total] = await Promise.all([
    Audit.find(filter).sort({ seq: -1 }).skip((page - 1) * limit).limit(Number(limit)).select('-userAgent'),
    Audit.countDocuments(filter)]);
  res.json({ items, total, pages: Math.ceil(total / limit) });
}));

// Re-computes the hash chain end to end. Any edited/removed row is reported.
r.get('/verify', adminOnly, wrap(async (req, res) => {
  let prev = 'GENESIS', count = 0, expectedSeq = 1;
  for await (const e of Audit.find().sort({ seq: 1 }).lean().cursor()) {
    count++;
    if (e.seq !== expectedSeq || e.prevHash !== prev || hashEntry({ ...e, user: e.user, file: e.file }) !== e.hash)
      return res.json({ valid: false, checked: count, brokenAt: e.seq });
    prev = e.hash; expectedSeq++;
  }
  res.json({ valid: true, checked: count });
}));
export default r;
