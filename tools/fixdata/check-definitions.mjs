/*
This script detects and report issues in the current definition file.

TODO: fixing issues which we are 100% sure are safe.
*/
import { utils } from "../app/utils.mjs";
const EXPECTED_DEFINITION_VERSIONS = ['0.1']

const definitions = utils.readJsonFile('DEFINITIONS')

const ENTITIES = ['features', 'components', 'allographs']

const message_level_counts = {
    'FATAL': 0,
    'ERROR': 0,
    'WARNING': 0,
    'INFO': 0,
}
function log(message, level='WARNING') {
    message_level_counts[level] += 1
    console.log(`${level}: ${message}`)
    if (level === 'FATAL') {
        process.exit(1)
    }
}

// 0. check version of definition file

if (!EXPECTED_DEFINITION_VERSIONS.includes(definitions.version)) {
    log(`version of definition file (${definitions.version}) is not supported by this script (${EXPECTED_DEFINITION_VERSIONS})`, 'FATAL')
}

// 1. check that an item's key correspond to its name

for (let entity of ENTITIES) {
    for (let [key, value] of Object.entries(definitions[entity])) {
        let name = value
        if (entity === 'components') {
            name = value.name
        }
        let expectedKey = null
        if (entity === 'allographs') {
            name = `${value.character} (${value.script})`
            expectedKey = `${value.character}-${value.script}`
        } else {
            expectedKey = utils.slugify(name)
        }
        if (key !== expectedKey)  {
            log(`${entity} key "${key}" doesn't correspond to its name "${name}" (key should be "${expectedKey}")`, 'WARNING')
        }
    }
}

// 2. check that all allographs use a valid script
for (let [allographKey, allograph] of Object.entries(definitions.allographs)) {
    if (!definitions.scripts[allograph.script]) {
        log(`allograph "${allographKey}" references an undefined script "${allograph.script}"`, 'ERROR')
    }
}

// 3. check that all defined components or features are used;
// and that all used are defined.
let childEntity = ''
for (let parentEntity of ENTITIES) {
    if (parentEntity !== 'features') {
        let definedChildren = Object.keys(definitions[childEntity])
        let usedChildren = []
        for (let [parentKey, parent] of Object.entries(definitions[parentEntity])) {
            let childrenUsedByParent = parent[childEntity]
            usedChildren = [...usedChildren, ...childrenUsedByParent]
            let undefinedEntities = childrenUsedByParent.filter(k => !definedChildren.includes(k))
            if (undefinedEntities.length) {
                log(`${parentEntity} "${parentKey}" uses "${undefinedEntities}", but they are not defined`, 'ERROR')
            }
            if (childrenUsedByParent.length < 1) {
                log(`${parentEntity} "${parentKey}" does not use any ${childEntity}`, 'WARNING')
            }
        }

        let unusedChildren = definedChildren.filter(child => !usedChildren.includes(child))
        if (unusedChildren.length) {
            log(`${childEntity} "${unusedChildren}" are unused`, 'WARNING')
        }
    }
    childEntity = parentEntity
}

console.log(message_level_counts)

if (message_level_counts['ERROR']) {
    process.exit(2)
}
