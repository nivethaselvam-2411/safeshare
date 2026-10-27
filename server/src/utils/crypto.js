import crypto from 'crypto';
import cfg from '../config.js';

// Envelope encryption: every file/version gets its own random 256-bit data key (DEK).
// The DEK encrypts the file (AES-256-GCM). The DEK itself is wrapped by the master key (KEK).
export function encryptBuffer(plain) {
  const dek = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', dek, iv);
  const data = Buffer.concat([c.update(plain), c.final()]);
  const tag = c.getAuthTag();
  const wIv = crypto.randomBytes(12);
  const w = crypto.createCipheriv('aes-256-gcm', cfg.masterKey, wIv);
  const wrapped = Buffer.concat([w.update(dek), w.final()]);
  const wrappedKey = Buffer.concat([wIv, w.getAuthTag(), wrapped]).toString('hex');
  return { data, iv: iv.toString('hex'), tag: tag.toString('hex'), wrappedKey,
           checksum: crypto.createHash('sha256').update(plain).digest('hex') };
}

export function decryptBuffer(data, { iv, tag, wrappedKey }) {
  const wk = Buffer.from(wrappedKey, 'hex');
  const u = crypto.createDecipheriv('aes-256-gcm', cfg.masterKey, wk.subarray(0, 12));
  u.setAuthTag(wk.subarray(12, 28));
  const dek = Buffer.concat([u.update(wk.subarray(28)), u.final()]);
  const d = crypto.createDecipheriv('aes-256-gcm', dek, Buffer.from(iv, 'hex'));
  d.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([d.update(data), d.final()]); // throws if ciphertext was tampered with
}
