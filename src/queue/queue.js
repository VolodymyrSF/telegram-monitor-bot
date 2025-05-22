import fs from 'fs/promises';
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QUEUE_PATH = path.join(__dirname, '../../src/queue//errors.json');

export async function pushToQueue(item) {
  try {
    let data = [];
    try {
      const raw = await fs.readFile(QUEUE_PATH, 'utf8');
      data = JSON.parse(raw);
    } catch {}

    data.push(item);
    await fs.writeFile(QUEUE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Queue write error:', err);
  }
}

export async function readQueue() {
  try {
    const raw = await fs.readFile(QUEUE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function clearQueue() {
  try {
    await fs.writeFile(QUEUE_PATH, '[]', 'utf8');
  } catch (err) {
    console.error('❌ Queue clear error:', err);
  }
}
