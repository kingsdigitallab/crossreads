const fs = require('fs');
const path = require('path');

console.log('TEST')

let srcPath = '../app/data/2023-08/inscriptions.json'
const fullCollectionPath = '../app/data/dts/api/collections.json'
let dstPath = path.dirname(srcPath) + '/' + 'collection.json'

async function readJsonFile(path) {
    let content = fs.readFileSync(path);
    return JSON.parse(content)
}
async function writeJsonFile(path, content) {
    fs.writeFileSync(path, JSON.stringify(content, null, 2));
}


async function filter() {
    // 1. read the list of inscription ids
    let inscriptions = await readJsonFile('../app/data/2023-08/inscriptions.json')
    // 2. read the collection
    let collection = await readJsonFile(fullCollectionPath)

    // 3. filter the collection by the list of inscriptions
    collection.member = collection.member.filter(m => inscriptions.includes(m?.title))

    // 4. write the filtered collection
    await writeJsonFile(dstPath, collection)
}

filter()
