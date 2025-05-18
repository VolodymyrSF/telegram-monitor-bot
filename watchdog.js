import { exec, spawn } from 'child_process';
import { config } from 'dotenv'
import { sendErrorEmail } from './src/email/email.js'
import { client } from './src/telegram/telegram.js'

config()

import nodemailer from 'nodemailer'
import { decrypt } from './src/utils/encryption.js'

const log = (msg) => console.log(`[WATCHDOG]: ${msg}`)


const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: decrypt(process.env.SMTP_PASSWORD)
  }
})

transporter.verify(async function (error, success) {
  if (error) {
    log(`❌ SMTP не працює: ${error.message}`)
    await tryNotifyViaTelegram(`SMTP поламався нахуй: ${error.message}`)
    process.exit(1)
  } else {
    log('✅ SMTP працює. Запускаємо бота...')
    startBot()
  }
})

// Запуск бота
function startBot() {
  const child = spawn('node', ['index.js']);

  child.stdout.pipe(process.stdout);

  child.stderr.on('data', async (data) => {
    const msg = data.toString();
    log(`stderr: ${msg}`);

    // Ігнорувати некритичні помилки
    const isNonFatal = [
      'punycode',
      'warning',
      'deprecated',
      'ExperimentalWarning',
      '[User is already connected!]',
      '🔁 Спроба reconnect #1...',
      '🔁 Спроба reconnect #2...',
      '🔁 Спроба reconnect #3...',
      '🔁 Спроба reconnect #4...',
      '🔁 Спроба reconnect #5...'
    ].some(keyword => msg.toLowerCase().includes(keyword.toLowerCase()));

    if (!isNonFatal) {
      await handleError(`Критична помилка бота: ${msg}`);
    }
  });

  child.on('close', async (code) => {
    await handleError(`Бот завершився з кодом ${code}`);
  });

  // Передача введення з батьківського процесу до дочірнього
  process.stdin.pipe(child.stdin);
}

async function handleError(msg) {
  try {
    await sendErrorEmail(new Error(msg))
    log('📧 Email з помилкою надіслано')
  } catch (e) {
    log('❌ Не вдалося надіслати email. Пробую кинути в Telegram...')
    await tryNotifyViaTelegram(`Бот вмер. Email теж вмер. Тримай месагу тут:\n\n${msg}`)
  }
  process.exit(1)
}

async function tryNotifyViaTelegram(message) {
  try {
    await client.connect()
    await client.sendMessage('me', { message })
    log('📩 Повідомлення надіслано в Telegram')
  } catch (err) {
    log(`❌ Не вдалося надіслати в Telegram: ${err.message}`)
  }
}
