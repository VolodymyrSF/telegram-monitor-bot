import fs from 'fs/promises';
import path from 'path';

const DIGEST_PATH = path.join(process.cwd(), 'queue', 'daily_digest.json');

async function ensureDirectoryExists(filePath) {
  const dir = path.dirname(filePath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    console.error('❌ Не вдалося створити директорію для digest:', err.message);
  }
}

// Головна фішка — не додавати дублікатів (по chatId + messageId)
export async function addToDigestQueue(item) {
  try {
    await ensureDirectoryExists(DIGEST_PATH);

    let data = [];
    try {
      const raw = await fs.readFile(DIGEST_PATH, 'utf8');
      data = JSON.parse(raw);
    } catch {
      // нічого, файл просто ще не створено
    }

    const exists = data.some(
      i => i.chatId === item.chatId && i.messageId === item.messageId
    );
    if (!exists) {
      data.push(item);
      await fs.writeFile(DIGEST_PATH, JSON.stringify(data, null, 2), 'utf8');
      console.log(`📥 Додано в digest: ${item.chatTitle} (${item.messageId})`);
    } else {
      console.log(`⚠️ Дубль. Пропускаємо: ${item.chatTitle} (${item.messageId})`);
    }
  } catch (err) {
    console.error('❌ Digest Queue write error:', err);
  }
}

export async function readDigestQueue() {
  try {
    await ensureDirectoryExists(DIGEST_PATH);
    const raw = await fs.readFile(DIGEST_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function clearDigestQueue() {
  try {
    await ensureDirectoryExists(DIGEST_PATH);
    await fs.writeFile(DIGEST_PATH, '[]', 'utf8');
    console.log('🧹 Digest queue очищено.');
  } catch (err) {
    console.error('❌ Digest Queue clear error:', err);
  }
}
