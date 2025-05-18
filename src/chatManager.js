import { readConfig, writeConfig } from './storage.js'
import { client } from './telegram.js'
import { Api } from 'telegram'
import { logError, logInfo, logWarn } from './logger.js'



const resolvedCache = new Map();

async function retry(fn, attempts = 3, delay = 2000) {
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (e) {
            console.log(`❗ Retry #${i + 1} після фейлу:`, e.message);
            if (i === attempts - 1) throw e;
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

async function resolveChat(inputRaw) {
    try {
        const input = inputRaw
          .trim()
          .replace(/^https?:\/\/t\.me\//i, '')
          .replace(/^@/, '')
          .toLowerCase();

        if (resolvedCache.has(input)) {
            return resolvedCache.get(input);
        }

        if (/^-?\d+$/.test(input)) {
            const result = await retry(() =>
              client.invoke(new Api.messages.GetDialogs({}))
            );
            const chat = result.chats.find(c => c.id.toString() === input);
            if (!chat) throw new Error('Чат не знайдено');

            const info = {
                id: chat.id.toString(),
                title: chat.title || 'Невідомо',
                username: chat.username || ''
            };
            resolvedCache.set(input, info);
            return info;
        }

        try {
            const resolvedPeer = await retry(() =>
              client.invoke(new Api.contacts.ResolveUsername({ username: input }))
            );

            let chatId, title = 'Невідомо', username = '';

            if (resolvedPeer?.users?.length > 0) {
                const user = resolvedPeer.users[0];
                chatId = user.id.toString();
                title = `${user.firstName} ${user.lastName || ''}`;
                username = user.username || '';
            } else if (resolvedPeer?.chats?.length > 0) {
                const chat = resolvedPeer.chats[0];
                chatId = `-100${chat.id.toString()}`;
                title = chat.title || 'Невідомо';
                username = chat.username || '';
            }

            if (chatId) {
                const info = { id: chatId, title, username };
                resolvedCache.set(input, info);
                return info;
            } else {
                throw new Error('Чат або користувача не знайдено');
            }
        } catch (e) {
            logWarn('❗ Не вдалося через ResolveUsername. Пробуємо getEntity:', e.message);
            try {
                const entity = await retry(() => client.getEntity(input));
                const isChannelOrGroup = entity.className === 'Channel' || entity.className === 'Chat';
                const id = isChannelOrGroup ? `-100${entity.id}` : entity.id.toString();

                const info = {
                    id,
                    title: entity.title || entity.firstName || 'Невідомо',
                    username: entity.username || ''
                };
                resolvedCache.set(input, info);
                return info;
            } catch (e2) {
                if (e2.message?.includes('FLOOD_WAIT')) {
                    logError('🐌 FLOOD_WAIT – чекай блядь');
                } else if (e2.message?.includes('TIMEOUT')) {
                    logError('⏱️ TIMEOUT – Telegram не відповідає');
                } else {
                    logError('💥 Помилка getEntity:', e2.message);
                }
                throw new Error('Не вдалося розпізнати чат. ' + e2.message);
            }
        }
    } catch (e) {
        throw new Error('❌ Помилка resolveChat: ' + e.message);
    }
}


async function addChatToGroup(groupName, input) {
    const config = await readConfig()
    const group = config.groups.find(g => g.name === groupName)
    if (!group) throw new Error(`Група "${groupName}" не знайдена`)

    const existingChat = group.chats.find(c => c.input === input || c.id.toString() === input)
    if (existingChat) {
        throw new Error(`Чат "${input}" вже доданий до групи "${groupName}"`)
    }

    const chatInfo = await resolveChat(input)
    group.chats.push({
        input,
        id: chatInfo.id,
        title: chatInfo.title,
        username: chatInfo.username
    })
    await writeConfig(config)
    return chatInfo
}

async function removeChatFromGroup(groupName, input) {
    const config = await readConfig()
    const group = config.groups.find(g => g.name === groupName)
    if (!group) throw new Error(`Група "${groupName}" не знайдена`)

    const normalizeId = (id) => id.replace('-100', '')
    const index = group.chats.findIndex(c =>
      c.input === input ||
      normalizeId(c.id.toString()) === normalizeId(input)
    )

    if (index === -1) {
        throw new Error(`Чат "${input}" не знайдений у групі "${groupName}"`)
    }

    const removed = group.chats.splice(index, 1)
    await writeConfig(config)
    return removed[0]
}

async function listChatsInGroup(groupName) {
    const config = await readConfig();

    if (!config.groups || config.groups.length === 0) {
        console.log("ℹ️ Жодних груп не знайдено.");
        return;
    }

    let hasChats = false;

    for (const group of config.groups) {
        const groupName = group.name || "(без назви)";
        const chats = Array.isArray(group.chats) ? group.chats : [];

        if (chats.length === 0) continue;

        hasChats = true;
        console.log(`📦 Група: ${groupName}`);
        for (const chat of chats) {
            const title = chat.title || chat.username || chat.input || chat.id || "(невідомий чат)";
            console.log(`   💬 ${title}`);
        }

        console.log("—".repeat(40));
    }

    if (!hasChats) {
        console.log("ℹ️ Чати не знайдено у жодній групі.");
    }
}

async function createGroup(groupName) {
    const config = await readConfig()
    const existingGroup = config.groups.find(g => g.name === groupName)
    if (existingGroup) throw new Error(`Група з назвою "${groupName}" вже існує`)

    config.groups.push({ name: groupName, chats: [], email: null })
    await writeConfig(config)
}

async function deleteGroup(groupName) {
    const config = await readConfig()
    const index = config.groups.findIndex(g => g.name === groupName)
    if (index === -1) throw new Error(`Група з назвою "${groupName}" не знайдена`)

    config.groups.splice(index, 1)
    await writeConfig(config)
}

async function listGroups() {
    const config = await readConfig();

    if (!config.groups || config.groups.length === 0) {
        console.log("ℹ️ Жодної групи не знайдено.");
        return;
    }

    for (const group of config.groups) {
        console.log(`📦 Група: ${group.name}`);

        // === Чати
        if (Array.isArray(group.chats) && group.chats.length > 0) {
            console.log("   📢 Канали:");
            for (const chat of group.chats) {
                console.log(`     📢 ${chat.title || chat.username || chat.id}`);
            }
        } else {
            console.log("   📢 Канали: —");
        }

        // === Email'и
        const emails = group.email
          ? group.email.split(",").map(e => e.trim()).filter(Boolean)
          : [];
        if (emails.length > 0) {
            console.log(`   📧 Email'и: ${emails.join(", ")}`);
        } else {
            console.log("   📧 Email'и: —");
        }

        // === Ключові слова
        const keywords = Array.isArray(group.keywords) ? group.keywords : [];
        if (keywords.length > 0) {
            console.log(`   📝 Ключові слова: ${keywords.join(", ")}`);
        } else {
            console.log("   📝 Ключові слова: —");
        }

        console.log("—".repeat(40));
    }
}

async function setGroupEmail(groupName, email) {
    const config = await readConfig()
    const group = config.groups.find(g => g.name === groupName)
    if (!group) throw new Error(`Група "${groupName}" не знайдена`)

    group.email = email
    await writeConfig(config)
    return email
}

async function clearGroupEmail(groupName, emailToRemove) {
    const config = await readConfig()
    const group = config.groups.find(g => g.name === groupName)
    if (!group) throw new Error(`Група "${groupName}" не знайдена`)

    if (!group.email) {
        throw new Error(`У групі "${groupName}" немає жодного email`);
    }

    // Розбиваємо рядок у масив, обрізаємо пробіли
    const emails = group.email.split(',').map(e => e.trim());

    // Перевіряємо, чи є email для видалення
    if (!emails.includes(emailToRemove)) {
        throw new Error(`Email "${emailToRemove}" не знайдено в групі "${groupName}".`);
    }

    // Видаляємо email
    const filteredEmails = emails.filter(e => e !== emailToRemove);

    // Якщо після видалення немає email, ставимо null
    group.email = filteredEmails.length > 0 ? filteredEmails.join(',') : null;
    await writeConfig(config)
    return true
}
async function listAll() {
    const config = await readConfig();

    let output = "";

    // === GROUPS ===
    if (Array.isArray(config.groups) && config.groups.length > 0) {
        for (const group of config.groups) {
            output += `📦 *Група:* ${group.name || "(без назви)"}\n`;

            // Chats
            const chats = Array.isArray(group.chats) ? group.chats : [];
            if (chats.length > 0) {
                output += `   📢 *Канали:*\n`;
                for (const chat of chats) {
                    const title = chat.title || chat.username || chat.input || chat.id || "(невідомий чат)";
                    output += `     └ ${title}\n`;
                }
            } else {
                output += `   📢 *Канали:* жодного\n`;
            }

            // Emails
            const emails = group.email
              ? group.email.split(",").map(e => e.trim()).filter(Boolean)
              : [];
            if (emails.length > 0) {
                output += `   📧 *Email'и:* ${emails.join(", ")}\n`;
            } else {
                output += `   📧 *Email'и:* не вказані\n`;
            }

            // Keywords
            const keywords = Array.isArray(group.keywords) ? group.keywords : [];
            if (keywords.length > 0) {
                output += `   📝 *Ключові слова:* ${keywords.join(", ")}\n`;
            } else {
                output += `   📝 *Ключові слова:* не вказані\n`;
            }

            output += "———————————————————————————————\n";
        }
    } else {
        output += "ℹ️ Жодної групи не знайдено.\n";
    }

    // === CHATS ===
    output += `\n🔸 *Чати та їх групи:*\n`;
    let foundChat = false;

    if (Array.isArray(config.groups)) {
        for (const group of config.groups) {
            const groupName = group.name || "(без назви)";
            const chats = Array.isArray(group.chats) ? group.chats : [];

            for (const chat of chats) {
                const title = chat.title || chat.username || chat.input || chat.id || "(невідомий чат)";
                output += `   💬 ${title} → *${groupName}*\n`;
                foundChat = true;
            }
        }
    }

    if (!foundChat) {
        output += `   Жодного чату не знайдено.\n`;
    }


    console.log(output);
}



export {
    addChatToGroup,
    removeChatFromGroup,
    listChatsInGroup,
    createGroup,
    deleteGroup,
    listGroups,
    setGroupEmail,
    clearGroupEmail,
    listAll
}
