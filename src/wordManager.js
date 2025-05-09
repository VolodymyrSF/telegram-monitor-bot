import { readConfig, writeConfig } from './storage.js'

function addWord(word) {
    if (!word || typeof word !== 'string') throw new Error('Слово має бути текстом')
    const config = readConfig()

    if (config.keywords.includes(word.toLowerCase())) throw new Error('Слово вже є')

    config.keywords.push(word.toLowerCase())
    writeConfig(config)
    return word.toLowerCase()
}

function removeWord(word) {
    const config = readConfig()
    const index = config.keywords.indexOf(word.toLowerCase())

    if (index === -1) throw new Error('Слово не знайдено')

    const removed = config.keywords.splice(index, 1)
    writeConfig(config)
    return removed[0]
}

function listWords() {
    const config = readConfig()
    return config.keywords
}

export { addWord, removeWord, listWords }
