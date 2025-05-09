import readline from 'readline';
import { addChat, removeChat, listChats } from './chatManager.js';
import { addWord, removeWord, listWords } from './wordManager.js';
import { getStats } from './statManager.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function displayHelp() {
    console.log('\nДоступні команди:');
    console.log('/addchat <ID або @username або посилання> - Додати чат для моніторингу');
    console.log('/removechat <ID або @username або посилання> - Видалити чат з моніторингу');
    console.log('/listchats - Показати список чатів, що відстежуються');
    console.log('/addword <слово> - Додати ключове слово для відстеження');
    console.log('/removeword <слово> - Видалити ключове слово');
    console.log('/listwords - Показати список ключових слів');
    console.log('/stats - Показати статистику за сесію');
    console.log('/help - Показати цю довідку');
    console.log('');
}

function handleCommand(line) {
    const [cmd, ...args] = line.trim().split(' ');

    switch (cmd) {
        case '/addchat':
            addChat(args[0])
              .then(chat => console.log(`Додано чат: ${chat.title} [${chat.id}]`))
              .catch(err => console.error('Помилка:', err.message))
              .finally(() => rl.prompt());
            break;

        case '/removechat':
            try {
                const removed = removeChat(args[0]);
                console.log(`Видалено чат: ${removed.title} [${removed.id}]`);
            } catch (err) {
                console.error('Помилка:', err.message);
            }
            rl.prompt();
            break;

        case '/listchats':
            const chats = listChats();
            if (chats.length === 0) {
                console.log('Немає жодного чату. Додай хоч один, щоб не сидіти як дурень. 🤷');
            } else {
                chats.forEach(c => {
                    console.log(`[${c.id}] ${c.title} (${c.input})`);
                });
            }
            rl.prompt();
            break;

        case '/addword':
            try {
                const added = addWord(args.join(' '));
                console.log(`Додано слово: ${added}`);
            } catch (err) {
                console.error('Помилка:', err.message);
            }
            rl.prompt();
            break;

        case '/removeword':
            try {
                const removed = removeWord(args.join(' '));
                console.log(`Видалено слово: ${removed}`);
            } catch (err) {
                console.error('Помилка:', err.message);
            }
            rl.prompt();
            break;

        case '/listwords':
            const words = listWords();
            if (words.length === 0) {
                console.log('Немає жодного слова. Тиша як на цвинтарі.');
            } else {
                words.forEach(w => console.log(`- ${w}`));
            }
            rl.prompt();
            break;

        case '/stats':
            getStats();
            rl.prompt();
            break;

        case '/help':
            displayHelp();
            rl.prompt();
            break;

        default:
            console.log('Невідома команда. Введіть /help для списку команд.');
            rl.prompt();
    }
}

function startCLI() {
    console.log('Бот запущено. Введіть команду (або /help):');
    rl.setPrompt('> ');
    rl.prompt();
    rl.on('line', (line) => {
        handleCommand(line);
        rl.prompt();
    });
    rl.on('close', () => {
        console.log('\nCLI завершено.');
        process.exit(0);
    });
}

export { startCLI };