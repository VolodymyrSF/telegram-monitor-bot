import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import input from 'input';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendNotificationEmail, sendErrorEmail } from './email.js';
import { readConfig, writeConfig } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Шлях до файлу з сесією
const SESSION_FILE_PATH = path.join(__dirname, '../session.txt');

// Створюємо StringSession
let stringSession = new StringSession('');

// Спробуємо завантажити збережену сесію, якщо вона існує
if (fs.existsSync(SESSION_FILE_PATH)) {
    const sessionData = fs.readFileSync(SESSION_FILE_PATH, 'utf8');
    stringSession = new StringSession(sessionData);
    console.log('Завантажено збережену сесію');
}

// Отримуємо дані для авторизації з .env
const apiId = parseInt(process.env.TELEGRAM_API_ID, 10);
const apiHash = process.env.TELEGRAM_API_HASH;
const phoneNumber = process.env.TELEGRAM_PHONE;


// Перевіряємо дані для авторизації
if (!apiId || !apiHash) {
    console.error('Помилка: Не знайдено API_ID або API_HASH в змінних середовища');
    process.exit(1);
}

// Створюємо клієнт Telegram
const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
});

// Функція для авторизації користувача
async function authorizeTelegram() {
    try {
        console.log('Підключення до Telegram...');

        // Якщо ми не авторизовані, виконуємо авторизацію
        if (!client.connected) {
            await client.start({
                phoneNumber: async () => phoneNumber || await input.text('Номер телефону: '),
                password: async () => await input.text('Пароль двоетапної перевірки (якщо є): '),
                phoneCode: async () => await input.text('Код підтвердження з Telegram: '),
                onError: (err) => console.error('Помилка авторизації:', err),
            });

            console.log('**Авторизація пройшла успішно!**');

            // Зберігаємо сесію для подальшого використання
            const sessionString = client.session.save();
            fs.writeFileSync(SESSION_FILE_PATH, sessionString);
            console.log('Сесію збережено для подальшого використання');
        }

        // Отримуємо інформацію про користувача
        const me = await client.getMe();
        console.log(`Увійшли як: ${me.firstName} ${me.lastName || ''} (@${me.username || 'немає username'})`);

        return true;
    } catch (error) {
        console.error('Помилка при авторизації:', error);
        throw error;
    }
}

// Функція для запуску моніторингу повідомлень
async function startMonitoring() {
    const config = readConfig();

    // Перевіряємо наявність чатів для моніторингу
    if (!config.chats || config.chats.length === 0) {
        console.warn('Увага: Не вказано жодного чату для моніторингу');
    }

    // Показуємо список чатів для моніторингу
    console.log(`Моніторинг ${config.chats.length} чатів:`);
    for (const chat of config.chats) {
        console.log(`- ${chat.title} (ID: ${chat.id})`);
    }

    /*
    // Слухаємо нові повідомлення
    client.addEventHandler(async (event) => {
        const message = event.message;
        const chatId = message.chatId?.toString();
        const text = message.text || message.message || '';

        if (!chatId || !text) return;

        // Перевіряємо, чи потрібно відстежувати цей чат
        const trackedChatIds = config.chats.map(c => c.id.toString());
        if (!trackedChatIds.includes(chatId)) {
            return;
        }

        // Оновлюємо статистику
        config.stats.messages += 1;

        // Перевіряємо ключові слова
        const foundKeywords = config.keywords.filter(kw =>
          text.toLowerCase().includes(kw.toLowerCase())
        );

        if (foundKeywords.length > 0) {
            config.stats.matches += 1;

            try {
                // Отримуємо інформацію про чат
                const chat = config.chats.find(c => c.id.toString() === chatId);

                // Отримуємо інформацію про відправника
                let senderName = 'Невідомий';
                if (message.sender) {
                    const sender = await message.getSender();
                    senderName = sender.firstName + (sender.lastName ? ` ${sender.lastName}` : '');
                }

                // Отримуємо інформацію про чат, якщо назва невідома
                let chatTitle = chat?.title;
                if (!chatTitle) {
                    try {
                        const entity = await client.getEntity(message.peerId);
                        chatTitle = entity.title || entity.firstName || `ID: ${chatId}`;
                    } catch (err) {
                        chatTitle = `ID: ${chatId}`;
                    }
                }

                // Надсилаємо сповіщення по email
                await sendNotificationEmail({
                    chatTitle,
                    message: text,
                    timestamp: new Date().toISOString(),
                    keywords: foundKeywords,
                    sender: senderName
                });

                config.stats.emails += 1;
            } catch (err) {
                console.error('Не вдалося надіслати повідомлення:', err.message);
                await sendErrorEmail(err);
            }
        }

        // Зберігаємо оновлену конфігурацію
        writeConfig(config);
    }, new NewMessage({}));

     */

    client.addEventHandler(async (event) => {
        const message = event.message;
        const chatId = message.chatId?.toString();
        const text = message.text || message.message || '';

        console.log(`Отримано повідомлення з чату ${chatId}: "${text}"`); // Додано логування

        if (!chatId || !text) return;

        const config = readConfig();
        const trackedChatIds = config.chats.map(c => c.id.toString());
        console.log('Відстежувані ID чатів:', trackedChatIds); // Додано логування

        if (!trackedChatIds.includes(chatId)) {
            console.log(`Чат ${chatId} не відстежується.`); // Додано логування
            return;
        }

        config.stats.messages += 1;

        const foundKeywords = config.keywords.filter(kw =>
          text.toLowerCase().includes(kw.toLowerCase())
        );
        console.log('Знайдені ключові слова:', foundKeywords); // Додано логування

        if (foundKeywords.length > 0) {
            config.stats.matches += 1;

            try {
                const chat = config.chats.find(c => c.id.toString() === chatId);

                let senderName = 'Невідомий';
                if (message.sender) {
                    const sender = await message.getSender();
                    senderName = sender.firstName + (sender.lastName ? ` ${sender.lastName}` : '');
                }

                let chatTitle = chat?.title;
                if (!chatTitle) {
                    try {
                        const entity = await client.getEntity(message.peerId);
                        chatTitle = entity.title || entity.firstName || `ID: ${chatId}`;
                    } catch (err) {
                        chatTitle = `ID: ${chatId}`;
                    }
                }

                await sendNotificationEmail({
                    chatTitle,
                    message: text,
                    timestamp: new Date().toISOString(),
                    keywords: foundKeywords,
                    sender: senderName
                });

                config.stats.emails += 1;
            } catch (err) {
                console.error('Не вдалося надіслати повідомлення:', err.message);
                await sendErrorEmail(err);
            }
        }

        writeConfig(config);
    }, new NewMessage({}));
    client.on('disconnected', async () => {
        console.warn('⚠️ Telegram клієнт роз’єднався! Спробую reconnect...');
        const success = await reconnectTelegram();
        if (!success) {
            console.error('🚫 Реконект провалено. Бот відключений.');
        }
    });
    console.log('Моніторинг запущено. Очікуємо нові повідомлення...');

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

async function reconnectTelegram(retryCount = 5) {
    for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
            console.warn(`Спроба reconnect #${attempt}...`);
            await client.connect();
            if (client.connected) {
                console.log('✅ Знову підключились до Telegram');
                return true;
            }
        } catch (err) {
            console.error(`❌ Спроба reconnect #${attempt} обісралась:`, err.message);
        }
        await new Promise(res => setTimeout(res, 30000));
    }

    const error = new Error('❌ Не вдалося перепідключитись до Telegram після кількох спроб.');
    await sendErrorEmail(error);
    return false;
}
export {
    client,
    authorizeTelegram,
    startMonitoring,
    getAvailableChats
};