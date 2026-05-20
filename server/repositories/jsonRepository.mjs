import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { emptyData } from '../empty-data.mjs';

export function createJsonRepository(dataFile) {
  const backupFile = `${dataFile}.bak`;
  let writeQueue = Promise.resolve();

  async function readData() {
    try {
      const raw = await readFile(dataFile, 'utf-8');
      return { ...emptyData, ...JSON.parse(raw) };
    } catch (error) {
      if (error?.code === 'ENOENT') {
        await writeData(emptyData);
        return { ...emptyData };
      }
      if (error instanceof SyntaxError) {
        return readBackupData(error);
      }
      throw error;
    }
  }

  async function readBackupData(originalError) {
    try {
      const raw = await readFile(backupFile, 'utf-8');
      return { ...emptyData, ...JSON.parse(raw) };
    } catch {
      throw new Error(`数据文件无法解析，且备份不可用：${originalError.message}`);
    }
  }

  function writeData(data) {
    writeQueue = writeQueue.then(() => writeDataAtomic(data), () => writeDataAtomic(data));
    return writeQueue;
  }

  async function writeDataAtomic(data) {
    await mkdir(dirname(dataFile), { recursive: true });
    try {
      await copyFile(dataFile, backupFile);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    const tempFile = `${dataFile}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    try {
      await writeFile(tempFile, JSON.stringify({ ...emptyData, ...data }, null, 2), 'utf-8');
      await rename(tempFile, dataFile);
    } catch (error) {
      await rm(tempFile, { force: true });
      throw error;
    }
  }

  return { readData, writeData };
}
