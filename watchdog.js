import { exec, spawn } from 'child_process';
import { config } from 'dotenv'
import { sendErrorEmail } from './src/email.js'
import { client } from './src/telegram.js'

config()

import nodemailer from 'nodemailer'
import { decrypt } from './src/encryption.js'

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


  child.stdout.pipe(process.stdout); // Просто перенаправляємо stdout бота на stdout watchdog
  child.stderr.on('data', async (data) => {
    log(`stderr: ${data}`);
    await handleError(`Помилка бота: ${data}`);
  });

  child.stderr.on('data', async (data) => {
    log(`stderr: ${data}`);
    await handleError(`Помилка бота: ${data}`);
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
