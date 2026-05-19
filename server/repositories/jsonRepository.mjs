import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { emptyData } from '../empty-data.mjs';

export function createJsonRepository(dataFile) {
  async function readData() {
    try {
      const raw = await readFile(dataFile, 'utf-8');
      return { ...emptyData, ...JSON.parse(raw) };
    } catch {
      await writeData(emptyData);
      return emptyData;
    }
  }

  async function writeData(data) {
    await mkdir(dirname(dataFile), { recursive: true });
    await writeFile(dataFile, JSON.stringify({ ...emptyData, ...data }, null, 2), 'utf-8');
  }

  return { readData, writeData };
}
