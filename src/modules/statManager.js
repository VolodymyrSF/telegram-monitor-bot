import { readConfig, writeConfig} from '../utils/storage.js'
import chalk from 'chalk'

async function getStats() {
    const config = await readConfig()

    if (!config.stats) {
        config.stats = { messages: 0, emails: 0, matches: 0 }
        await writeConfig(config)
    }

    const stats = config.stats || { messages: 0, emails: 0, matches: 0 }

    console.log(chalk.yellow.bold('\nСтатистика за сесію:'))
    console.log(chalk.green(`Оброблених повідомлень:`), stats.messages)
    console.log(chalk.blue(`Надісланих листів:`), stats.emails)
    console.log(chalk.red(`Спрацювань ключових слів:`), stats.matches)
    console.log('')
}

async function resetStats() {
    const config = await readConfig()
    config.stats = {
        messages: 0,
        emails: 0,
        matches: 0
    }
    await writeConfig(config)
}

export { getStats,resetStats }
