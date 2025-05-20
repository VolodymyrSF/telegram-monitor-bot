import { Telegraf, Markup, session } from 'telegraf'
import dotenv from 'dotenv'
dotenv.config()

import {
  addChatToGroup, removeChatFromGroup, listChatsInGroup,
  createGroup, deleteGroup, listGroups, setGroupEmail,
  clearGroupEmail, listAll
} from '../modules/chatManager.js'

import {
  addWordToGroup, removeWordFromGroup, listWordsInGroup
} from '../modules/wordManager.js'

import { getStats, resetStats } from '../modules/statManager.js'
import { readQueue, clearQueue } from '../queue/queue.js'
import nodemailer from 'nodemailer'
import { setEnvVariable } from '../utils/envManager.js'
import { readConfig, writeConfig } from '../utils/storage.js'

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)
const ADMIN_ID = parseInt(process.env.TELEGRAM_ADMIN_ID)

bot.use(session())

function auth(ctx, next) {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply('⛔ Ти не адмін. Відвали.')
  }
  return next()
}

bot.start(auth, (ctx) => {
  ctx.reply('Привіт Адмін! Ось головне меню:')
  return ctx.reply('Головне меню:', Markup.inlineKeyboard([
    [Markup.button.callback('📦 Групи', 'groups')],
    [Markup.button.callback('💬 Чати', 'chats')],
    [Markup.button.callback('📝 Ключові слова', 'keywords')],
    [Markup.button.callback('📧 Email', 'email')],
    [Markup.button.callback('📨 Черга', 'queue')],
    [Markup.button.callback('📊 Статистика', 'stats')],
    [Markup.button.callback('📚 Всі групи', 'list_all')]
  ]))
})

// ========== Секції меню ==========

bot.action('groups', auth, (ctx) => {
  ctx.reply('Операції з групами:')
  return ctx.editMessageText('Операції з групами:', Markup.inlineKeyboard([
    [Markup.button.callback('➕ Створити', 'group_create')],
    [Markup.button.callback('🗑️ Видалити', 'group_delete')],
    [Markup.button.callback('📋 Перелік', 'group_list')],
    [Markup.button.callback('⬅️ Назад', 'start')]
  ]))
})

bot.action('chats', auth, (ctx) => {
  ctx.reply('Операції з чатами:')
  return ctx.editMessageText('Операції з чатами:', Markup.inlineKeyboard([
    [Markup.button.callback('➕ Додати чат', 'add_chat')],
    [Markup.button.callback('🗑️ Видалити чат', 'remove_chat')],
    [Markup.button.callback('📋 Список чатів', 'list_chats')],
    [Markup.button.callback('⬅️ Назад', 'start')]
  ]))
})

bot.action('keywords', auth, (ctx) => {
  ctx.reply('Операції з ключовими словами:')
  return ctx.editMessageText('Ключові слова:', Markup.inlineKeyboard([
    [Markup.button.callback('➕ Додати слово', 'add_word')],
    [Markup.button.callback('🗑️ Видалити слово', 'remove_word')],
    [Markup.button.callback('📋 Список слів', 'list_words')],
    [Markup.button.callback('⬅️ Назад', 'start')]
  ]))
})

bot.action('email', auth, (ctx) => {
  ctx.reply('Операції з email:')
  return ctx.editMessageText('Email:', Markup.inlineKeyboard([
    [Markup.button.callback('📧 Встановити', 'set_email')],
    [Markup.button.callback('🗑️ Очистити', 'clear_email')],
    [Markup.button.callback('⬅️ Назад', 'start')]
  ]))
})

bot.action('queue', auth, (ctx) => {
  ctx.reply('Операції з чергою:')
  return ctx.editMessageText('Черга:', Markup.inlineKeyboard([
    [Markup.button.callback('📋 Показати', 'queue_show')],
    [Markup.button.callback('🔁 Повторити', 'queue_retry')],
    [Markup.button.callback('⬅️ Назад', 'start')]
  ]))
})

bot.action('stats', auth, async (ctx) => {
  const stats = getStats();
  let message = '📊 Статистика:\n';
  for (const key in stats) {
    message += `${key}: ${stats[key]}\n`;
  }
  ctx.reply(message); // Відправляємо статистику в чат
  return ctx.editMessageText(message);
});

bot.action('list_all', auth, async (ctx) => {
  try {
    const allData = await listAll(); // Отримуємо дані про всі групи та чати
    ctx.reply(allData); // Відправляємо дані в чат
  } catch (error) {
    console.error("Помилка при отриманні списку всіх груп:", error);
    ctx.reply('⚠️ Помилка при отриманні списку груп.');
  }
});

// ========== Кнопкові дії ==========

const actions = {
  group_create: async (val, ctx) => {
    if (!val) return ctx.reply('❗ Введіть назву групи.');
    await createGroup(val);
    ctx.reply(`✅ Групу "${val}" створено`);
  },
  group_delete: async (val, ctx) => {
    if (!val) return ctx.reply('❗ Введіть назву групи для видалення.');
    await deleteGroup(val);
    ctx.reply(`🗑️ Групу "${val}" видалено`);
  },
  add_chat: async (val, ctx) => {
    const [group, chat] = val.split(' ');
    if (!group || !chat) return ctx.reply('❗ Введіть назву групи та ID/посилання на чат.');
    try {
      const added = await addChatToGroup(group, chat);
      ctx.reply(`✅ Додано чат "${added.title}" до групи "${group}"`);
    } catch (e) {
      ctx.reply(`⚠️ Помилка: ${e.message}`);
    }
  },
  remove_chat: async (val, ctx) => {
    const [group, chat] = val.split(' ');
    if (!group || !chat) return ctx.reply('❗ Введіть назву групи та ID/посилання на чат для видалення.');
    try {
      const removed = await removeChatFromGroup(group, chat);
      ctx.reply(`🗑️ Видалено чат "${removed.title}" з групи "${group}"`);
    } catch (e) {
      ctx.reply(`⚠️ Помилка: ${e.message}`);
    }
  },
  list_chats: async (val, ctx) => {
    if (!val) return ctx.reply('❗ Введіть назву групи.');
    try{
      const chats = await listChatsInGroup(val);
      if (!chats || !chats.length) return ctx.reply(`ℹ️ У групі "${val}" немає чатів.`);
      const message = `💬 Чати в групі "${val}":\n${chats.map(c => `- ${c.title} (${c.id})`).join('\n')}`;
      ctx.reply(message);
    } catch(e){
      ctx.reply(`⚠️ Помилка: ${e.message}`);
    }

  },
  add_word: async (val, ctx) => {
    const [group, word] = val.split(' ');
    if (!group || !word) return ctx.reply('❗ Введіть назву групи та слово.');
    try {
      const addedWord = await addWordToGroup(group, word);
      ctx.reply(`✅ Додано слово "${addedWord}" до групи "${group}"`);
    } catch (e) {
      ctx.reply(`⚠️ Помилка: ${e.message}`);
    }
  },
  remove_word: async (val, ctx) => {
    const [group, word] = val.split(' ');
    if (!group || !word) return ctx.reply('❗ Введіть назву групи та слово для видалення.');
    try {
      const removedWord = await removeWordFromGroup(group, word);
      ctx.reply(`🗑️ Видалено слово "${removedWord}" з групи "${group}"`);
    } catch (e) {
      ctx.reply(`⚠️ Помилка: ${e.message}`);
    }
  },
  list_words: async (val, ctx) => {
    if (!val) return ctx.reply('❗ Введіть назву групи.');
    try{
      const words = await listWordsInGroup(val);
      if (!words || !words.length) return ctx.reply(`ℹ️ У групі "${val}" немає ключових слів.`);
      const message = `🔑 Ключові слова в групі "${val}":\n${words.map(w => `- ${w}`).join('\n')}`;
      ctx.reply(message);
    } catch(e){
      ctx.reply(`⚠️ Помилка: ${e.message}`);
    }
  },
  set_email: async (val, ctx) => {
    const [group, email] = val.split(' ');
    if (!group || !email) return ctx.reply('❗ Введіть назву групи та email.');
    try {
      await setEnvVariable(`GROUP_EMAIL_${group.toUpperCase()}`, email);
      const config = await readConfig();
      const g = config.groups.find(g => g.name === group);
      if (g) {
        g.email = email;
        await writeConfig(config);
      }
      ctx.reply(`📧 Email для "${group}" встановлено на "${email}"`);
    } catch (e) {
      ctx.reply(`⚠️ Помилка: ${e.message}`);
    }
  },
  clear_email: async (val, ctx) => {
    const [group, email] = val.split(' ');
    if (!group || !email) return ctx.reply('❗ Введіть назву групи та email для видалення.');
    try {
      await clearGroupEmail(group, email);
      await setEnvVariable(`GROUP_EMAIL_${group.toUpperCase()}`, '');
      ctx.reply(`📧 Email "${email}" видалено з групи "${group}"`);
    } catch (e) {
      ctx.reply(`⚠️ Помилка: ${e.message}`);
    }
  },
}

// ========== Підписки на дії ==========

Object.keys(actions).forEach(action => {
  bot.action(action, auth, (ctx) => {
    ctx.reply(`Введіть параметри для дії "${action}" (наприклад, назва групи)`);
    ctx.session.action = action;
  })
})

bot.action('queue_show', auth, async (ctx) => {
  try{
    const q = await readQueue();
    if (!q.length) return ctx.reply('📭 Черга порожня.');
    let message = '📬 Черга повідомлень:\n';
    q.forEach((item, i) => {
      message += `#${i + 1} - Тема: ${item.subject}\n`;
    })
    ctx.reply(message);
    return ctx.editMessageText(message);
  } catch(e){
    ctx.reply(`⚠️ Помилка: ${e.message}`);
  }
})

bot.action('queue_retry', auth, async (ctx) => {
  try{
    const items = await readQueue();
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
      }
    });

    let sentCount = 0;
    for (const item of items) {
      try {
        await transporter.sendMail(item);
        console.log(`✅ Повторно відправлено: ${item.subject}`);
        sentCount++;
      } catch (e) {
        console.log(`❌ Не вдалося відправити повторно: ${item.subject}`, e.message);
      }
    }

    await clearQueue();
    const resultMessage = `🔄 Спроба повторного надсилання завершена. Успішно відправлено ${sentCount} з ${items.length} повідомлень.`;
    ctx.reply(resultMessage);
    return ctx.editMessageText(resultMessage);
  }catch(e){
    ctx.reply(`⚠️ Помилка: ${e.message}`);
  }
})

bot.action('group_list', auth, async (ctx) => {
  try {
    const groups = await listGroups();
    if (!groups || !groups.length) {
      return ctx.reply('ℹ️ Жодної групи не знайдено.');
    }
    const message = await listGroups();
    ctx.reply(message);
    return ctx.editMessageText(message);
  } catch (error) {
    console.error("Помилка при отриманні списку груп:", error);
    ctx.reply('⚠️ Помилка при отриманні списку груп.');
  }
})

// ========== Обробка введеного тексту ==========

bot.on('text', auth, async (ctx) => {
  const step = ctx.session.action;
  const val = ctx.message.text.trim();
  if (actions[step]) {
    try {
      await actions[step](val, ctx);
    } catch (e) {
      ctx.reply(`⚠️ Помилка: ${e.message}`);
    } finally {
      ctx.session.action = null;
    }
  } else {
    const input = ctx.message.text.trim();
    const args = input.split(/\s+/)
    const cmd = args[0]

    switch (cmd) {
      case '/creategroup':
        if (!args[1]) return ctx.reply('❗ Введіть назву групи.');
        try {
          const msg = await createGroup(args[1]);
          return ctx.reply(msg);
        } catch (e) {
          return ctx.reply(`⚠️ Помилка: ${e.message}`);
        }

      case '/deletegroup':
        if (!args[1]) return ctx.reply('❗ Введіть назву групи для видалення.');
        try {
          const msg = await deleteGroup(args[1]);
          return ctx.reply(msg);
        } catch (e) {
          return ctx.reply(`⚠️ Помилка: ${e.message}`);
        }

      case '/addchat':
        if (args.length < 3) return ctx.reply('❗ Введіть назву групи та ID/посилання на чат.');
        try {
          const msg = await addChatToGroup(args[1], args[2]);
          return ctx.reply(msg);
        } catch (e) {
          return ctx.reply(`⚠️ Помилка: ${e.message}`);
        }

      case '/removechat':
        if (args.length < 3) return ctx.reply('❗ Введіть назву групи та ID/посилання на чат для видалення.');
        try {
          const msg = await removeChatFromGroup(args[1], args[2]);
          return ctx.reply(msg);
        } catch (e) {
          return ctx.reply(`⚠️ Помилка: ${e.message}`);
        }

      case '/listchats':
        if (!args[1]) return ctx.reply('❗ Введіть назву групи.');
        try {
          const msg = await listChatsInGroup(args[1]);
          return ctx.reply(msg);
        } catch (e) {
          return ctx.reply(`⚠️ Помилка: ${e.message}`);
        }

      case '/addword':
        if (args.length < 3) return ctx.reply('❗ Введіть назву групи та слово.');
        try {
          const msg = await addWordToGroup(args[1], args[2]);
          return ctx.reply(msg);
        } catch (e) {
          return ctx.reply(`⚠️ Помилка: ${e.message}`);
        }

      case '/removeword':
        if (args.length < 3) return ctx.reply('❗ Введіть назву групи та слово для видалення.');
        try {
          const msg = await removeWordFromGroup(args[1], args[2]);
          return ctx.reply(msg);
        } catch (e) {
          return ctx.reply(`⚠️ Помилка: ${e.message}`);
        }

      case '/listwords':
        if (!args[1]) return ctx.reply('❗ Введіть назву групи.');
        try {
          const msg = await listWordsInGroup(args[1]);
          return ctx.reply(msg);
        } catch (e) {
          return ctx.reply(`⚠️ Помилка: ${e.message}`);
        }

      case '/setgroupemail':
        if (args.length < 3) return ctx.reply('❗ Введіть назву групи та email.');
        try {
          await setEnvVariable(`GROUP_EMAIL_${args[1].toUpperCase()}`, args[2]);
          const msg = await setGroupEmail(args[1], args[2]);
          return ctx.reply(msg);
        } catch (e) {
          return ctx.reply(`⚠️ Помилка: ${e.message}`);
        }

      case '/removegroupemail':
        if (args.length < 3) return ctx.reply('❗ Введіть назву групи та email для видалення.');
        try {
          const msg = await clearGroupEmail(args[1], args[2]);
          await setEnvVariable(`GROUP_EMAIL_${args[1].toUpperCase()}`, '');
          return ctx.reply(msg);
        } catch (e) {
          return ctx.reply(`⚠️ Помилка: ${e.message}`);
        }

      case '/listgroups':
        try {
          const msg = await listGroups();
          return ctx.reply(msg);
        } catch (e) {
          return ctx.reply(`⚠️ Помилка: ${e.message}`);
        }

      case '/listall':
        try {
          const msg = await listAll();
          return ctx.reply(msg);
        } catch (e) {
          return ctx.reply(`⚠️ Помилка: ${e.message}`);
        }

      case '/stats':
        try {
          const stats = getStats();
          const msg = '📊 Статистика:\n' + Object.entries(stats).map(([k, v]) => `${k}: ${v}`).join('\n');
          return ctx.reply(msg);
        } catch (e) {
          return ctx.reply(`⚠️ Помилка: ${e.message}`);
        }
      case '/help':
        const helpMessage = `
Доступні команди:
/creategroup <назва> - Створити групу для чатів
/deletegroup <назва> - Видалити групу
/listgroups - Показати список груп
/addchat <група> <ID або @username або посилання> - Додати чат до групи
/removechat <група> <ID або @username або посилання> - Видалити чат з групи
/listchats <група> - Показати список чатів у групі
/addword <група> <слово> - Додати ключове слово до групи
/removeword <група> <слово> - Видалити ключове слово з групи
/listwords <група> - Показати список ключових слів у групі
/setgroupemail <група> <email> - Встановити email для групи
/removegroupemail <група> <email> - Видалити email для групи
/showqueue - показати чергу ненадісланих повідомлень
/retryfailed - перезапуск надсилання повідомлень (враховуючи чергу ненадісланих)
/listall - Показати всі групи з чатами
/stats - Показати статистику за сесію
/help - Показати цю довідку
        `
        ctx.reply(helpMessage);
        break;
      default:
        ctx.reply('Невідома команда. Введіть /help для списку команд.');
    }
  }
})

function startBotManager() {
  bot.launch()
  console.log('🚀 FSM Telegram Bot запущено')
}

export { startBotManager }
