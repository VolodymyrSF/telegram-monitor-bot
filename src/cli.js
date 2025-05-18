import readline from 'readline'
import {
    addChatToGroup,
    removeChatFromGroup,
    listChatsInGroup,
    createGroup,
    deleteGroup,
    listGroups,
    setGroupEmail,
    clearGroupEmail,
    listAll
} from './chatManager.js'
import {
    addWordToGroup,
    removeWordFromGroup,
    listWordsInGroup
} from './wordManager.js'
import { getStats,resetStats } from './statManager.js'
import { setEnvVariable } from './envManager.js'
import { readConfig, writeConfig } from './storage.js'

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
});

function displayHelp() {
    console.log('\nДоступні команди:');
    console.log('/creategroup <назва> - Створити групу для чатів');
    console.log('/deletegroup <назва> - Видалити групу');
    console.log('/listgroups - Показати список груп');
    console.log('/addchat <група> <ID або @username або посилання> - Додати чат до групи');
    console.log('/removechat <група> <ID або @username або посилання> - Видалити чат з групи');
    console.log('/listchats <група> - Показати список чатів у групі');
    console.log('/addword <група> <слово> - Додати ключове слово до групи');
    console.log('/removeword <група> <слово> - Видалити ключове слово з групи');
    console.log('/listwords <група> - Показати список ключових слів у групі');
    console.log('/setgroupemail <група> <email> - Встановити email для групи');
    console.log('/removegroupemail <група> <email> - Видалити email для групи');
    console.log('/listAll - Показати всі групи з чатами');
    console.log('/stats - Показати статистику за сесію');
    console.log('/help - Показати цю довідку');
    console.log('');
}

async function handleCommand(line) {
    const match = line.trim().match(/(?:[^\s"]+|"[^"]*")+/g);
    if (!match) return;
    const [cmd, ...args] = match.map(arg => arg.replace(/^"(.+(?="$))"$/, '$1'));
    try {
        switch (cmd) {
            case '/creategroup':
                if (!args[0]) return console.log('Потрібно вказати назву групи.')
                await createGroup(args[0])
                console.log(`Групу "${args[0]}" створено`)
                break

            case '/deletegroup':
                if (!args[0]) return console.log('Потрібно вказати назву групи для видалення.')
                await deleteGroup(args[0])
                console.log(`Групу "${args[0]}" видалено`)
                break

            case '/listgroups': {
                const groups = await listGroups()
                if (groups.length === 0) {
                    console.log('Немає жодної групи.')
                } else {
                    groups.forEach(g => console.log(`- ${g.name} (Чатів: ${g.chats.length})`))
                }
                break
            }

            case '/addchat':
                if (args.length < 2) return console.log('Потрібно вказати назву групи та чат.')
                const added = await addChatToGroup(args[0], args[1])
                console.log(`Додано чат ${added.title} до групи ${args[0]}`)
                break

            case '/removechat':
                if (args.length < 2) return console.log('Потрібно вказати назву групи та чат.')
                const removed = await removeChatFromGroup(args[0], args[1])
                console.log(`Видалено чат ${removed.title} з групи ${args[0]}`)
                break

            case '/listchats': {
                if (!args[0]) return console.log('Потрібно вказати назву групи.')
                const chats = await listChatsInGroup(args[0])
                if (chats.length === 0) {
                    console.log(`У групі ${args[0]} немає чатів.`)
                } else {
                    chats.forEach(c => console.log(`- ${c.title} (${c.id})`))
                }
                break
            }

            case '/addword':
                if (args.length < 2) return console.log('Потрібно вказати групу та слово.')
                const word = await addWordToGroup(args[0], args[1])
                console.log(`Додано слово "${word}" до групи ${args[0]}`)
                break

            case '/removeword':
                if (args.length < 2) return console.log('Потрібно вказати групу та слово для видалення.')
                const removedWord = await removeWordFromGroup(args[0], args[1])
                console.log(`Видалено слово "${removedWord}" з групи ${args[0]}`)
                break

            case '/listwords': {
                if (!args[0]) return console.log('Потрібно вказати групу.')
                const words = await listWordsInGroup(args[0])
                if (words.length === 0) {
                    console.log(`У групі ${args[0]} немає ключових слів.`)
                } else {
                    words.forEach(w => console.log(`- ${w}`))
                }
                break
            }

            case '/setgroupemail': {
                if (args.length < 2) return console.log('Потрібно вказати групу та email.')
                const [groupName, email] = args
                await setEnvVariable(`GROUP_EMAIL_${groupName.toUpperCase()}`, email)
                console.log(`Email для групи "${groupName}" встановлено на "${email}"`)

                const config = await readConfig()
                const group = config.groups.find(g => g.name === groupName)
                if (group) {
                    group.email = email
                    await writeConfig(config)
                } else {
                    console.warn(`Група "${groupName}" не знайдена.`)
                }
                break
            }

            case '/removegroupemail': {
                if (args.length < 2) return console.log('Потрібно вказати групу та email для видалення.')
                const [groupName, email] = args

                try {
                    await clearGroupEmail(groupName, email)
                    await setEnvVariable(`GROUP_EMAIL_${groupName.toUpperCase()}`, '') // чистимо .env
                    console.log(`Email "${email}" для групи "${groupName}" успішно видалено.`)
                } catch (err) {
                    console.log('Помилка:', err.message)
                }

                break
            }

            case '/listAll':{
                await listAll();
              break;
            }


            case '/stats': {
                const stats = getStats()
                break
            }

            case '/help':
                displayHelp();
                rl.prompt();
                break;


            default:
                console.log('Невідома команда. Введіть /help для списку команд.');
                rl.prompt();
        }
        } catch (err) {
            console.log('Помилка:', err.message)
        } finally {
            rl.prompt()
        }
    }
await resetStats()

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
    rl.prompt();
}

export { startCLI };