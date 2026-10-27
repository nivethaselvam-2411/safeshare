import mongoose from 'mongoose';
const { Schema, model } = mongoose;

export const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  disabled: { type: Boolean, default: false },
  failedLogins: { type: Number, default: 0 },
  lockUntil: Date,
  lastLoginAt: Date,
}, { timestamps: true }));

const VersionSchema = new Schema({
  number: Number, size: Number, checksum: String,
  storageName: String, iv: String, tag: String, wrappedKey: String,
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
  note: String,
}, { _id: false });

export const FileDoc = model('FileDoc', new Schema({
  name: { type: String, required: true },
  mimeType: String,
  size: Number,
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  currentVersion: { type: Number, default: 1 },
  versions: [VersionSchema],
  permissions: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['viewer', 'editor'], default: 'viewer' },
    canDownload: { type: Boolean, default: false },
    expiresAt: Date,
    grantedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    _id: false,
  }],
  links: [{
    token: String, passwordHash: String, expiresAt: Date,
    maxDownloads: Number, downloads: { type: Number, default: 0 },
    revoked: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }, _id: false,
  }],
  deletedAt: Date,
}, { timestamps: true }));

export const Audit = model('Audit', new Schema({
  seq: { type: Number, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  action: { type: String, index: true },
  file: { type: Schema.Types.ObjectId, ref: 'FileDoc', index: true },
  fileName: String,
  ip: String, userAgent: String,
  details: Schema.Types.Mixed,
  createdAt: Date,
  prevHash: String, hash: String,
}));
