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
    const user = auth.users.find((item) => item.username === username && item.status !== '停用');
    if (!user || !verifyPassword(String(password ?? ''), user.password)) return null;
    const token = randomUUID();
    const publicUser = { id: user.id, username: user.username, name: user.name, role: user.role };
    sessions.set(token, publicUser);
    return { token, user: publicUser };
  }

  function getSession(token) {
    return token ? sessions.get(token) : null;
  }

  async function listUsers() {
    const auth = await readAuth();
    return auth.users.map(publicUser);
  }

  async function createUser(input) {
    const auth = await readAuth();
    const username = String(input.username ?? '').trim();
    const password = String(input.password ?? '');
    if (!username || !password) throw new Error('username 和 password 为必填');
    if (auth.users.some((item) => item.username === username)) throw new Error('账号已存在');
    const user = {
      id: `auth-${Date.now()}-${randomUUID().slice(0, 8)}`,
      username,
      name: String(input.name ?? username).trim() || username,
      role: String(input.role ?? '招聘专员').trim() || '招聘专员',
      status: input.status === '停用' ? '停用' : '启用',
      password: hashPassword(password),
    };
    auth.users = [user, ...auth.users];
    await writeAuth(auth);
    return publicUser(user);
  }

  async function updateUser(id, patch) {
    const auth = await readAuth();
    const target = auth.users.find((item) => item.id === id);
    if (!target) throw new Error('账号不存在');
    if (patch.username && auth.users.some((item) => item.id !== id && item.username === patch.username)) throw new Error('账号已存在');
    const next = {
      ...target,
      username: patch.username ? String(patch.username).trim() : target.username,
      name: patch.name ? String(patch.name).trim() : target.name,
      role: patch.role ? String(patch.role).trim() : target.role,
      status: patch.status === '停用' ? '停用' : patch.status === '启用' ? '启用' : target.status,
      password: patch.password ? hashPassword(String(patch.password)) : target.password,
    };
    auth.users = auth.users.map((item) => item.id === id ? next : item);
    await writeAuth(auth);
    return publicUser(next);
  }

  async function writeAuth(auth) {
    await mkdir(dirname(authFile), { recursive: true });
    await writeFile(authFile, JSON.stringify(auth, null, 2), 'utf-8');
  }

  return { login, getSession, listUsers, createUser, updateUser };
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    status: user.status ?? '启用',
  };
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
