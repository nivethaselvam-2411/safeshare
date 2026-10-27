import { Router } from 'express';
import { User, FileDoc, Audit } from '../models/index.js';
import { auth, adminOnly } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';

const r = Router();
r.use(auth);
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Dashboard numbers for any signed-in user (scoped to them); admins get org-wide extras.
r.get('/stats', wrap(async (req, res) => {
  const me = req.user._id;
  const mine = await FileDoc.find({ owner: me, deletedAt: null });
  const shared = await FileDoc.countDocuments({ deletedAt: null, 'permissions.user': me });
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d; });
  const filter = req.user.role === 'admin' ? {} : { $or: [{ user: me }, { file: { $in: mine.map((f) => f._id) } }] };
  const recent = await Audit.find({ ...filter, createdAt: { $gte: days[0] } }).select('createdAt action');
  const activity = days.map((d) => ({ day: d.toLocaleDateString('en', { weekday: 'short' }),
    count: recent.filter((e) => e.createdAt >= d && e.createdAt < new Date(+d + 86400000)).length }));
  const out = {
    files: mine.length, shared, versions: mine.reduce((s, f) => s + f.versions.length, 0),
    storage: mine.reduce((s, f) => s + f.versions.reduce((a, v) => a + v.size, 0), 0),
    links: mine.reduce((s, f) => s + f.links.filter((l) => !l.revoked && l.expiresAt > new Date()).length, 0),
    activity, denied: recent.filter((e) => e.action === 'access.denied').length,
  };
  if (req.user.role === 'admin') {
    out.org = { users: await User.countDocuments(), files: await FileDoc.countDocuments(), events: await Audit.countDocuments(),
      failedLogins: await Audit.countDocuments({ action: 'auth.login_failed', createdAt: { $gte: days[0] } }) };
  }
  res.json(out);
}));

r.get('/users', adminOnly, wrap(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).select('-passwordHash');
  const counts = await FileDoc.aggregate([{ $group: { _id: '$owner', n: { $sum: 1 } } }]);
  res.json(users.map((u) => ({ ...u.toObject(), files: counts.find((c) => String(c._id) === String(u._id))?.n || 0 })));
}));

r.patch('/users/:id', adminOnly, wrap(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) return res.status(400).json({ message: "You can't change your own account here" });
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: 'User not found' });
  if (['admin', 'member'].includes(req.body.role)) u.role = req.body.role;
  if (typeof req.body.disabled === 'boolean') u.disabled = req.body.disabled;
  await u.save();
  await audit(req, 'admin.user_update', { details: { target: u.email, role: u.role, disabled: u.disabled } });
  res.json({ ok: true });
}));
export default r;
