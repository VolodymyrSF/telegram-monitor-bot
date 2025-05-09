import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const configPath = path.resolve(__dirname, '../config/config.json')
const backupPath = path.resolve(__dirname, '../config/config.bak.json')

// створення пустого config якщо нема
function initStorage() {
    if (!fs.existsSync(configPath)) {
        const empty = { chats: [], keywords: [], stats: { messages: 0, emails: 0, matches: 0 } }
        fs.writeFileSync(configPath, JSON.stringify(empty, null, 2))
    }
}

function readConfig() {
    initStorage()
    const data = fs.readFileSync(configPath)
    return JSON.parse(data)
}

function writeConfig(config) {
    try {
        fs.copyFileSync(configPath, backupPath)
    } catch (_) {
        console.warn('Не вдалося зробити бекап config.json')
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

export { readConfig, writeConfig }
