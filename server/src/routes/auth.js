import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cfg from '../config.js';
import { User } from '../models/index.js';
import { auth } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';

const r = Router();
const sign = (u) => jwt.sign({ id: u._id }, cfg.jwt, { expiresIn: '8h' });
const pub = (u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role });
const strong = (p) => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

r.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '')) return res.status(400).json({ message: 'Enter your name and a valid email' });
  if (!strong(password)) return res.status(400).json({ message: 'Password needs 8+ characters with letters and numbers' });
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: 'That email is already registered' });
  const isFirst = (await User.countDocuments()) === 0;
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: isFirst ? 'admin' : 'member' });
  await audit(req, 'auth.register', { user });
  res.status(201).json({ token: sign(user), user: pub(user) });
});

r.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  const bad = () => res.status(401).json({ message: 'Incorrect email or password' });
  if (!user) return bad();
  if (user.lockUntil && user.lockUntil > new Date())
    return res.status(423).json({ message: 'Too many attempts. Account locked for 15 minutes.' });
  if (user.disabled) return res.status(403).json({ message: 'This account has been disabled by an admin' });
  if (!(await bcrypt.compare(password || '', user.passwordHash))) {
    user.failedLogins += 1;
    if (user.failedLogins >= 5) { user.lockUntil = new Date(Date.now() + 15 * 60000); user.failedLogins = 0; }
    await user.save();
    await audit(req, 'auth.login_failed', { user, details: { reason: 'bad password' } });
    return bad();
  }
  user.failedLogins = 0; user.lockUntil = undefined; user.lastLoginAt = new Date(); await user.save();
  await audit(req, 'auth.login', { user });
  res.json({ token: sign(user), user: pub(user) });
});

r.get('/me', auth, (req, res) => res.json({ user: pub(req.user) }));
export default r;
