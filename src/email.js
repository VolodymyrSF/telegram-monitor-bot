import nodemailer from 'nodemailer'
import { readConfig } from './storage.js'
import { decrypt } from './encryption.js'
import dotenv from 'dotenv'
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

async function sendNotificationEmail({ chatTitle, message, timestamp, keywords }) {
    const mailOptions = {
        from: `"Telegram Monitor" <${process.env.SMTP_EMAIL}>`,
        to: process.env.SMTP_TO,
        subject: `Ключове слово ${keywords.join(', ')} в чаті: ${chatTitle}`,
        text: `Час: ${timestamp}
Чат: ${chatTitle}
Ключові слова: ${keywords.join(', ')}
Повідомлення:
${message}`
    }

    await transporter.sendMail(mailOptions)
    console.log(`Notification with [${keywords.join(', ')}] keywords in [${chatTitle}] chat has been sent to [${process.env.SMTP_TO}]`)
}

async function sendErrorEmail(error) {
    const mailOptions = {
        from: `"Telegram Monitor Error" <${process.env.SMTP_EMAIL}>`,
        to: process.env.SMTP_EMAIL,
        subject: `Помилка моніторингу`,
        text: `Час: ${new Date().toISOString()}
Помилка: ${error.message || error}`
    }

    await transporter.sendMail(mailOptions)
}

export { sendNotificationEmail, sendErrorEmail }
