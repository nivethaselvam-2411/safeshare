import jwt from 'jsonwebtoken';
import cfg from '../config.js';
import { User } from '../models/index.js';

export async function auth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const payload = jwt.verify(h.replace('Bearer ', ''), cfg.jwt);
    const user = await User.findById(payload.id);
    if (!user || user.disabled) return res.status(401).json({ message: 'Session is no longer valid' });
    req.user = user; next();
  } catch { res.status(401).json({ message: 'Please sign in to continue' }); }
}
export const adminOnly = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Admins only' });
