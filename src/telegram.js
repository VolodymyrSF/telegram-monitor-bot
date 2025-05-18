import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'
import { NewMessage } from 'telegram/events/index.js'
import input from 'input'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { sendNotificationEmail, sendErrorEmail } from './email.js'
import { readConfig, writeConfig } from './storage.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_FILE_PATH = path.join(__dirname, '../session.txt');

let stringSession = new StringSession('');
try {
    const sessionData = await fs.readFile(SESSION_FILE_PATH, 'utf8')
    stringSession = new StringSession(sessionData)
    console.log('✅ Збережену сесію завантажено')
} catch {
    console.log('📂 Сесію не знайдено. Стартуємо з нуля')
}

const apiId = parseInt(process.env.TELEGRAM_API_ID, 10);
const apiHash = process.env.TELEGRAM_API_HASH;
const phoneNumber = process.env.TELEGRAM_PHONE;

if (!apiId || !apiHash) {
    console.error('❌ API_ID або API_HASH не задані')
    process.exit(1);
}

const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
});

let lastEventTime = Date.now();

async function authorizeTelegram() {
    try {
        if (!client.connected) {
            await client.start({
                phoneNumber: async () => phoneNumber || await input.text('Номер телефону: '),
                password: async () => await input.text('Пароль (2FA): '),
                phoneCode: async () => await input.text('Код підтвердження з Telegram: '),
                onError: (err) => console.error('⛔ Авторизація облажалась:', err),
            });

            const sessionString = client.session.save();
            await fs.writeFile(SESSION_FILE_PATH, sessionString)
            console.log('🔐 Сесію збережено');
        }

        const me = await client.getMe();
        console.log(`👤 Увійшли як: ${me.firstName} ${me.lastName || ''} (@${me.username || 'без username'})`);
        return true;
    } catch (error) {
        console.error('💀 Авторизація не вдалася:', error);
        await sendErrorEmail(error)
        throw error;
    }
}

async function startMonitoring() {
    const config = await readConfig()
    const hasChats = config.groups && config.groups.some(group => Array.isArray(group.chats) && group.chats.length > 0);
    if (!hasChats) {
        console.log('⚠️ Немає жодного чату для моніторингу');
        return;
    }

    try {
        client.addEventHandler(async (event) => {
            try {
                lastEventTime = Date.now();

                const message = event.message
                const chatId = message.chatId?.toString()
                const text = message.text || message.message || ''
                if (!chatId || !text) return

                const config = await readConfig()
                const relevantGroups = config.groups.filter(group =>
                  group.chats.some(chat => chat.id.toString() === chatId)
                )
                if (!relevantGroups.length) return

                config.stats.messages += 1

                const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                for (const group of relevantGroups) {
                    const foundKeywords = group.keywords?.filter(kw =>
                      new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i').test(text)
                    ) || []

                    if (foundKeywords.length) {
                        config.stats.matches += 1

                        try {
                            const sender = message.sender ? await message.getSender() : null
                            const senderName = sender ? `${sender.firstName} ${sender.lastName || ''}` : 'Невідомий'

                            const chat = group.chats.find(c => c.id.toString() === chatId)
                            const chatTitle = chat?.title || `ID: ${chatId}`

                            const recipient = process.env[`GROUP_EMAIL_${group.name.toUpperCase()}`] || process.env.SMTP_TO

                            if (recipient) {
                                await sendNotificationEmail({
                                    chatTitle,
                                    message: text,
                                    timestamp: new Date().toISOString(),
                                    keywords: foundKeywords,
                                    chatId,
                                    messageId: message.id,
                                    sender: senderName,
                                    recipient
                                })
                                config.stats.emails += 1
                            }
                        } catch (err) {
                            console.error('📨 Не вдалося надіслати повідомлення:', err.message)
                            await sendErrorEmail(err)
                        }
                    }
                }

                await writeConfig(config)
            } catch (innerErr) {
                console.error('🔥 В середині event handler щось згоріло:', innerErr)
                await sendErrorEmail(innerErr)
            }
        }, new NewMessage({}))
    } catch (outerErr) {
        console.error('💣 addEventHandler зламався нахуй:', outerErr)
        await sendErrorEmail(outerErr)
    }

    client.on('disconnected', async () => {
        console.warn('🔌 Втрата підключення! Спробую reconnect...');
        const success = await reconnectTelegram();
        if (!success) {
            console.error('🚫 Реконект обісрався. Бот ляг.');
        }
    });

    setInterval(async () => {
        if (Date.now() - lastEventTime > 120000) {
            console.warn('🕳️ Підозріло довго нема евентів... Підключення могло здохнути');
            await reconnectTelegram();
        }
    }, 60000);

    console.log('🟢 Моніторинг запущено!');
}

async function reconnectTelegram(retryCount = 5) {
    for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
            console.warn(`🔁 Спроба reconnect #${attempt}...`);
            await client.connect();
            if (client.connected) {
                console.log('✅ Успішний reconnect!');
                return true;
            }
        } catch (err) {
            console.error(`❌ reconnect #${attempt} впав:`, err.message);
        }
        await new Promise(res => setTimeout(res, 30000));
    }

    const error = new Error('🚨 Не вдалося перепідключитись до Telegram після кількох спроб.');
    await sendErrorEmail(error);
    return false;
}

// Функція для отримання списку всіх доступних діалогів
async function getAvailableChats() {
    try {
        const dialogs = await client.getDialogs();
        return dialogs.map(dialog => ({
            id: dialog.id.toString(),
            title: dialog.title || dialog.name || `ID: ${dialog.id}`,
            type: dialog.isChannel ? 'channel' : (dialog.isGroup ? 'group' : 'private')
        }));
    } catch (error) {
        console.error('Помилка при отриманні списку чатів:', error);
        return [];
    }
}

process.on('unhandledRejection', (reason) => {
    console.error('❗ Unhandled Promise rejection:', reason);
    sendErrorEmail(reason);
});

process.on('uncaughtException', (err) => {
    console.error('💀 Uncaught Exception:', err);
    sendErrorEmail(err);
});

export {
    client,
    authorizeTelegram,
    startMonitoring,
}
