import fs from 'fs/promises'; // Використовуємо fs.promises для асинхронних операцій
import path from 'path';

const ENV_PATH = path.resolve(process.cwd(), '.env');

async function setEnvVariable(key, value) {
  try {
    await fs.access(ENV_PATH);
    const env = await fs.readFile(ENV_PATH, 'utf8');
    const lines = env.split('\n');

    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(`${key}=`)) {
        lines[i] = `${key}=${value}`;
        found = true;
        break;
      }
    }

    if (!found) {
      lines.push(`${key}=${value}`);
    }

    await fs.writeFile(ENV_PATH, lines.join('\n'));
    return true;

  } catch (error) {
    if (error.code === 'ENOENT') {
      // Файл не існує, створюємо його
      await fs.writeFile(ENV_PATH, `${key}=${value}\n`);
      return true;
    } else {
      console.error('Помилка при роботі з .env файлом:', error);
      return false;
    }
  }
}

export { setEnvVariable };