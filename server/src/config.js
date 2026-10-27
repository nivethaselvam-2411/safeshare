import 'dotenv/config';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default {
  port: process.env.PORT || 5000,
  mongo: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/safeshare',
  jwt: process.env.JWT_SECRET || 'dev-jwt-secret',
  masterKey: crypto.createHash('sha256').update(process.env.MASTER_KEY || 'dev-master-key').digest(),
  client: process.env.CLIENT_URL || 'http://localhost:5173',
  maxFileMB: Number(process.env.MAX_FILE_MB || 25),
  storageDir: path.join(__dirname, '..', 'storage'),
};
