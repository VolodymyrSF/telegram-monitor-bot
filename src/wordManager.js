import { readConfig, writeConfig } from './storage.js'

async function addWordToGroup(groupName, word) {
    if (!word || typeof word !== 'string') {
        throw new Error('Слово має бути текстом')
    }

    const config = await readConfig()
    const group = config.groups.find(g => g.name === groupName)
    if (!group) throw new Error(`Група "${groupName}" не знайдена`)

    if (!group.keywords) group.keywords = []

    if (group.keywords.includes(word.toLowerCase())) {
        throw new Error(`Слово "${word}" вже є у групі "${groupName}"`)
    }

    group.keywords.push(word.toLowerCase())
    await writeConfig(config)
    return word.toLowerCase()
}

async function removeWordFromGroup(groupName, word) {
    const config = await readConfig()
    const group = config.groups.find(g => g.name === groupName)
    if (!group) throw new Error(`Група "${groupName}" не знайдена`)

    const index = group.keywords.indexOf(word.toLowerCase())
    if (index === -1) {
        throw new Error(`Слово "${word}" не знайдено у групі "${groupName}"`)
    }

    group.keywords.splice(index, 1)
    await writeConfig(config)
    return word.toLowerCase()
}

async function listWordsInGroup(groupName) {
    const config = await readConfig()
    const group = config.groups.find(g => g.name === groupName)
    if (!group) throw new Error(`Група "${groupName}" не знайдена`)

    return group.keywords || []
}



export { addWordToGroup, removeWordFromGroup, listWordsInGroup}
