import { readDigestQueue, clearDigestQueue } from './queue/digestQueue.js'
import { sendErrorEmail } from './email/email.js'
import { readConfig } from './utils/storage.js'
import nodemailer from 'nodemailer'
import { decrypt } from './utils/encryption.js'
import dotenv from 'dotenv'
import moment from 'moment-timezone'
dotenv.config()

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: decrypt(process.env.SMTP_PASSWORD)
  }
})

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function sendDailyDigest() {
  try {
    const items = await readDigestQueue()
    if (!items.length) {
      console.log('📭 Digest порожній, нічого не шлемо.')
      return
    }

    const grouped = groupBy(items, i => i.groupName)
    const config = await readConfig()

    for (const groupName in grouped) {
      const messages = grouped[groupName]
      const group = config.groups.find(g => g.name === groupName)
      if (!group || !group.email) continue

      const recipientList = group.email.split(',').map(e => e.trim())

      const htmlLines = messages.map(msg => {
        const time = moment.utc(msg.timestamp).tz('Europe/Kiev').format('YYYY-MM-DD HH:mm:ss')
        const link = msg.chatUsername
          ? `https://t.me/${msg.chatUsername}/${msg.messageId}`
          : `https://t.me/c/${msg.chatId.replace('-100', '')}/${msg.messageId}`
        return `
                <hr>
                <p><b>Чат:</b> ${escapeHtml(msg.chatTitle)}</p>
                <p><b>Ключові слова:</b> ${escapeHtml(msg.keywords.join(', '))}</p>
                <p><b>Відправник:</b> ${escapeHtml(msg.sender)}</p>
                <p><b>Час:</b> ${time}</p>
                <p>${escapeHtml(msg.message).replace(/\n/g, '<br>')}</p>
                <p><a href="${link}">Перейти до повідомлення</a></p>
                `
      }).join('\n')

      const mailOptions = {
        from: `"Telegram Digest" <${process.env.SMTP_EMAIL}>`,
        to: recipientList,
        subject: `Щоденний дайджест: ${groupName}`,
        html: `<h2>📊 Щоденний дайджест групи "${groupName}"</h2>${htmlLines}`
      }

      await transporter.sendMail(mailOptions)
      console.log(`📤 Надіслано дайджест групі ${groupName}`)
    }

    await clearDigestQueue()
  } catch (err) {
    console.error('❌ Помилка при надсиланні дайджесту:', err)
    await sendErrorEmail(err)
  }
}
