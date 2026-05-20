import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export function createAuthService(authFile) {
  const sessions = new Map();

  async function readAuth() {
    try {
      const raw = await readFile(authFile, 'utf-8');
      return JSON.parse(raw);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      const initialPassword = process.env.HR_ASSISTANT_ADMIN_PASSWORD;
      if (!initialPassword) {
        throw new Error('首次创建本地管理员前，请先设置 HR_ASSISTANT_ADMIN_PASSWORD 环境变量');
      }
      const initial = {
        users: [
          {
            id: 'local-admin',
            username: 'admin',
            name: '本地管理员',
            role: '系统管理员',
            password: hashPassword(initialPassword),
          },
        ],
      };
      await mkdir(dirname(authFile), { recursive: true });
      await writeFile(authFile, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
  }

  async function login(username, password) {
    const auth = await readAuth();
    const user = auth.users.find((item) => item.username === username);
    if (!user || !verifyPassword(String(password ?? ''), user.password)) return null;
    const token = randomUUID();
    const publicUser = { id: user.id, username: user.username, name: user.name, role: user.role };
    sessions.set(token, publicUser);
    return { token, user: publicUser };
  }

  function getSession(token) {
    return token ? sessions.get(token) : null;
  }

  return { login, getSession };
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = pbkdf2Sync(password, salt, 120000, 32, 'sha256');
  return timingSafeEqual(Buffer.from(hash, 'hex'), candidate);
}
