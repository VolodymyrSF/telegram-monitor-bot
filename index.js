import { config } from 'dotenv';
config(); // Викликаємо config() одразу на початку

import { sendErrorEmail } from './src/email/email.js'

import { authorizeTelegram, startMonitoring } from './src/telegram/telegram.js';
import { startCLI } from './src/modules/cli.js';
import { startBotManager} from './src/telegram/telebot.js'

import cron from 'node-cron'
import { sendDailyDigest } from './src/digestSender.js'


async function start() {
    try {
        console.log('🚀 Початок ініціалізації');

        await authorizeTelegram();
        console.log('✅ Telegram авторизація успішна');

        // ВАЖЛИВО: Винесемо моніторинг в окремий процес або зробимо його неблокуючим
        setImmediate(async () => {
            try {
                await startMonitoring()
            } catch (monitorError) {
                console.error('Помилка в startMonitoring:', monitorError)
                await sendErrorEmail(monitorError)
            }
        })

        setTimeout(() => {
            console.log('💬 Запуск CLI');
            startCLI();
            console.log('🎉 Все системи активні');
            cron.schedule('0 5 * * *', async () => {
                console.log('📬 Час хуярити щоденний дайджест');
                await sendDailyDigest()
            });
        }, 100);

        // console.log('🎉 Все системи активні'); // Видаліть цей рядок
    } catch (err) {
        console.error('❌ Критична помилка:', err.message);
        await sendErrorEmail(err);
        process.exit(1);
    }
}

process.on('uncaughtException', async (err) => {
    console.error('🔥 Uncaught Exception:', err)
    await sendErrorEmail(err)
    process.exit(1)
})

process.on('unhandledRejection', async (reason, promise) => {
    console.error('🔥 Unhandled Rejection:', reason)
    await sendErrorEmail(reason)
    process.exit(1)
})
  /*
if (process.env.TELEGRAM_BOT_TOKEN) {
    startBotManager()
}

   */

start();