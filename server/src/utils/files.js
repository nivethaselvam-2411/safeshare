import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import cfg from '../config.js';
import { encryptBuffer, decryptBuffer } from './crypto.js';

export const RANK = { viewer: 1, editor: 2, owner: 3 };

export function accessOf(file, userId) {
  const id = String(userId);
  if (String(file.owner._id || file.owner) === id) return { role: 'owner', canDownload: true };
  const p = file.permissions.find((x) => String(x.user._id || x.user) === id && (!x.expiresAt || x.expiresAt > new Date()));
  return p ? { role: p.role, canDownload: p.role === 'editor' || p.canDownload, expiresAt: p.expiresAt } : null;
}

export async function storeVersion(file, buffer, userId, note) {
  const enc = encryptBuffer(buffer);
  const storageName = crypto.randomUUID() + '.enc';
  await fs.mkdir(cfg.storageDir, { recursive: true });
  await fs.writeFile(path.join(cfg.storageDir, storageName), enc.data);
  const number = (file.versions.at(-1)?.number || 0) + 1;
  file.versions.push({ number, size: buffer.length, checksum: enc.checksum, storageName, iv: enc.iv, tag: enc.tag,
    wrappedKey: enc.wrappedKey, uploadedBy: userId, note });
  file.currentVersion = number; file.size = buffer.length;
  return number;
}

export async function readVersion(file, number) {
  const v = file.versions.find((x) => x.number === Number(number || file.currentVersion));
  if (!v) return null;
  const raw = await fs.readFile(path.join(cfg.storageDir, v.storageName));
  return { buffer: decryptBuffer(raw, v), version: v };
}

// Never leak storage names / keys to the client.
export const safeVersion = (v) => ({ number: v.number, size: v.size, checksum: v.checksum, uploadedBy: v.uploadedBy, uploadedAt: v.uploadedAt, note: v.note });
export const fileDto = (f, access) => ({
  _id: f._id, name: f.name, mimeType: f.mimeType, size: f.size, owner: f.owner, currentVersion: f.currentVersion,
  versionCount: f.versions.length, sharedCount: f.permissions.length, createdAt: f.createdAt, updatedAt: f.updatedAt,
  deletedAt: f.deletedAt, access,
});
