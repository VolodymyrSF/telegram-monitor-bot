import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const configPath = path.resolve(__dirname, '../config/config.json')
const backupPath = path.resolve(__dirname, '../config/config.bak.json')

async function initStorage() {
    try {
        await fs.access(configPath)
    } catch (_) {
        const empty = {
            groups: [],
            keywords: [],
            stats: { messages: 0, emails: 0, matches: 0 }
        }
        await fs.writeFile(configPath, JSON.stringify(empty, null, 2), 'utf8')
    }
}

async function readConfig() {
    await initStorage()
    try {
        const data = await fs.readFile(configPath, 'utf8')
        return JSON.parse(data)
    } catch (err) {
        console.error('Помилка при читанні config.json:', err.message)
        return { groups: [], keywords: [], stats: { messages: 0, emails: 0, matches: 0 } }
    }
}

async function writeConfig(config) {
    try {
        await fs.copyFile(configPath, backupPath)
    } catch (_) {
        console.warn('Не вдалося зробити бекап config.json')
    }
    try {
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8')
    } catch (err) {
        console.error('Помилка при записі в config.json:', err.message)
    }
}

export { readConfig, writeConfig }
