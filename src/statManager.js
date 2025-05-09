import { readConfig } from './storage.js'
import chalk from 'chalk'

function getStats() {
    const { stats } = readConfig()

    console.log(chalk.yellow.bold('\nСтатистика за сесію:'))
    console.log(chalk.green(`Оброблених повідомлень:`), stats.messages)
    console.log(chalk.blue(`Надісланих листів:`), stats.emails)
    console.log(chalk.red(`Спрацювань ключових слів:`), stats.matches)
    console.log('')
}

export { getStats }
