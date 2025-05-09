// index.js
import { config } from 'dotenv';
config(); // Викликаємо config() одразу на початку
import { sendErrorEmail } from './src/email.js'

import { authorizeTelegram, startMonitoring } from './src/telegram.js';
import { startCLI } from './src/cli.js';

async function start() {
    try {
        await authorizeTelegram();
        startMonitoring();
        console.log('Бот авторизувався, їбаш далі команди:');
        startCLI();
    } catch (err) {
        console.error('Блядь, не вдалося авторизуватись:', err.message);
        await sendErrorEmail(err);
        process.exit(1);
    }

}
process.on('uncaughtException', async (err) => {
    console.error('🔥 Uncaught Exception:', err)
    await sendErrorEmail(err)
    process.exit(1) // Або спробуй перезапустити, або виходь
})

process.on('unhandledRejection', async (reason, promise) => {
    console.error('🔥 Unhandled Rejection:', reason)
    await sendErrorEmail(reason)
    process.exit(1)
})

start();