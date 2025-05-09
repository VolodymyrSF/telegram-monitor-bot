import { readConfig, writeConfig } from './storage.js';
import { client } from './telegram.js';
import { Api } from 'telegram';


async function resolveChat(input) {
    try {
        let result;
        if (/^-?\d+$/.test(input)) {
            result = await client.invoke(new Api.messages.GetDialogs({}));
            const chat = result.chats.find(c => c.id.toString() === input);
            if (!chat) throw new Error('Чат не знайдено');

            const id = chat.id.toString();
            return {
                id,
                title: chat.title || 'Невідомо',
                username: chat.username || ''
            };
        } else {
            try {
                const resolvedPeer = await client.invoke(
                  new Api.contacts.ResolveUsername({ username: input })
                );

                let chatId;
                let title = 'Невідомо';
                let username = '';

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
                    return { id: chatId, title: title, username: username };
                } else {
                    throw new Error('Чат або користувача не знайдено');
                }
            } catch (e) {
                console.error('Помилка в contacts.ResolveUsername:', e);
                try {
                    const entity = await client.getEntity(input);
                    const isChannelOrGroup = entity.className === 'Channel' || entity.className === 'Chat';
                    const id = isChannelOrGroup ? `-100${entity.id}` : entity.id.toString();

                    return {
                        id,
                        title: entity.title || entity.firstName || 'Невідомо',
                        username: entity.username || ''
                    };
                } catch (e2) {
                    console.error('Помилка при отриманні entity:', e2);
                    throw new Error('Не вдалося розпізнати чат.');
                }
            }
        }
    } catch (e) {
        throw new Error('Не вдалося розпізнати чат. ' + e.message);
    }
}

async function addChat(input) {
    const config = readConfig();
    const existing = config.chats.find(c => c.input === input || c.id.toString() === input);
    if (existing) throw new Error('Цей чат уже доданий');

    try {
        const chatInfo = await resolveChat(input);
        config.chats.push({ input, id: chatInfo.id, title: chatInfo.title, username: chatInfo.username });
        writeConfig(config);
        return chatInfo;
    } catch (error) {
        console.error(`Помилка при додаванні чату "${input}":`, error.message);
        throw error;
    }
}

function removeChat(input) {
    const config = readConfig();
    const normalizeId = (id) => id.replace('-100', '');
    const index = config.chats.findIndex(c =>
      c.input === input ||
      normalizeId(c.id.toString()) === normalizeId(input)
    );
    if (index === -1) throw new Error('Чат не знайдено');

    const removed = config.chats.splice(index, 1);
    writeConfig(config);
    return removed[0];
}

function listChats() {
    const config = readConfig();
    return config.chats;
}

export { addChat, removeChat, listChats };