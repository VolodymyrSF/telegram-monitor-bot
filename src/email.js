import nodemailer from 'nodemailer'
import { readConfig } from './storage.js'
import { decrypt } from './encryption.js'
import dotenv from 'dotenv'

import moment from 'moment-timezone';

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

function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
}

async function sendNotificationEmail({ chatTitle,chatUsername, message, timestamp, keywords, chatId, messageId }) {
    const localTime = moment.utc(timestamp).tz('Europe/Kiev');
    const formattedLocalTime = localTime.format('YYYY-MM-DD HH:mm:ss');
    const config = await readConfig()
    // Зіставляємо chatId з групою для отримання назви
    const group = config.groups.find(g => g.chats.some(c => c.id.toString() === chatId.toString()))
    const envKey = group ? `GROUP_EMAIL_${group.name.toUpperCase()}` : null

    const rawRecipients = envKey && process.env[envKey] ? process.env[envKey] : process.env.SMTP_TO;

// Тут отримаємо масив:
    const recipientList = rawRecipients.split(',').map(email => email.trim());

    // Формуємо посилання на повідомлення
    let chatLink = ''
    let isPrivateLink = false
    if (messageId) {
        if (chatUsername) {
            // Публічний чат або канал
            chatLink = `https://t.me/${chatUsername}/${messageId}`
        } else {
            // Приватний чат або група за ID
            const idForLink = chatId.startsWith('-100') ? chatId.slice(4) : chatId
            chatLink = `https://t.me/c/${idForLink}/${messageId}`
            isPrivateLink = true
        }
    }
    const escapedMessage = escapeHtml(message)

    const mailOptions = {
        from: `"Telegram Monitor" <${process.env.SMTP_EMAIL}>`,
        to: recipientList,
        subject: `Ключове слово: ${keywords.join(', ')} у чаті "${chatTitle}"`,
        text:
          `Час: ${formattedLocalTime}\n` +
          `Чат: ${chatTitle}\n` +
          `Ключові слова: ${keywords.join(', ')}\n` +
          `Повідомлення:\n${message}` +
          (chatLink ? `\nПосилання: ${chatLink}` : '') +
          (isPrivateLink ? `\n⚠️ Посилання може відкриватись лише в Telegram додатку, якщо ви учасник чату.` : ''),
        html:
          `<p><b>Час:</b> ${formattedLocalTime}</p>` +
          `<p><b>Чат:</b> ${escapeHtml(chatTitle)}</p>` +
          `<p><b>Ключові слова:</b> ${escapeHtml(keywords.join(', '))}</p>` +
          `<p><b>Повідомлення:</b><br>${escapedMessage.replace(/\n/g, '<br>')}</p>` +
          (chatLink
            ? `<p><a href="${chatLink}">Перейти до повідомлення</a></p>`
            : '') +
          (isPrivateLink
            ? `<p style="color:red;"><b>⚠️ Посилання може відкриватись лише в Telegram додатку, якщо ви учасник чату.</b></p>`
            : '')
    }

    try {
        await transporter.sendMail(mailOptions)
        console.log(
          `✅ Notification sent to ${recipientList}: keywords [${keywords.join(', ')}] in chat "${chatTitle}"`
        )
    } catch (e) {
        console.error(`❌ Помилка надсилання email до ${recipientList}:`, e)
        await sendErrorEmail(e)
    }
}

async function sendErrorEmail(error) {
    const mailOptions = {
        from: `"Telegram Monitor Error" <${process.env.SMTP_EMAIL}>`,
        to: process.env.SMTP_EMAIL,
        subject: `Помилка моніторингу`,
        text: `Час: ${new Date().toISOString()}\nПомилка: ${error.message || error}`
    };

    await transporter.sendMail(mailOptions);
}

export { sendNotificationEmail, sendErrorEmail };