const fs = require('fs');
const path = require('path');

let srcPath = process.argv.pop()
if (!srcPath.endsWith('.json')) {
    console.log('First argument should be the path of a json file with an array of object ids.')
    process.exit(1)
}

const shortListPath = '../app/data/2023-08/inscriptions.json'
// const fullCollectionLocation = '../app/data/dts/api/collections.json'
const fullCollectionLocation = 'https://raw.githubusercontent.com/ISicily/ISicily/master/dts/collection.json'
// const fullCollectionLocation = 'http://sicily.classics.ox.ac.uk/collections.json'

let filteredCollectionPath = path.dirname(srcPath) + '/' + 'collection.json'

async function readJsonFile(path) {
    let content = fs.readFileSync(path);
    return JSON.parse(content)
}

async function writeJsonFile(path, content) {
    fs.writeFileSync(path, JSON.stringify(content, null, 2));
}

async function readCollectionJson() {
    let res = await fetch(fullCollectionLocation)
    return await res.text()
}

async function filter() {
    let ret = 0

    // 1. read the list of inscription ids
    let shortList = await readJsonFile(shortListPath)
    // 2. read the collection
    let fullCollectionJson = await readCollectionJson()
    let fullCollection = JSON.parse(fullCollectionJson)
    let filteredCollection = JSON.parse(fullCollectionJson)
    
    // 3. filter the collection by the list of inscriptions
    filteredCollection.member = fullCollection.member.filter(m => shortList.includes(m?.title))

    // 4. write the filtered collection
    await writeJsonFile(filteredCollectionPath, filteredCollection)

    // 5. report ids that were not found
    let missingids = []
    let allids = filteredCollection.member.map(m => m?.title)
    for (iid of shortList) {
        if (!allids.includes(iid)) {
            console.log(`WARNING: object id (${iid}) not found in the base collection.`)
            missingids.push(iid)
        }
    }
    
    console.log(`TASK    filter ${shortList.length} inscriptions (${shortListPath}) from ${fullCollection.member.length} (${fullCollectionLocation})`)
    console.log(`WRITTEN ${filteredCollection.member.length} inscriptions into ${filteredCollectionPath}`)
    if (missingids.length) {
        ret = 1
        console.log(`WARNING: ${missingids} were not found in the full collection file.`)
    }

    ret = 0
    return ret
}

async function start() {
    process.exitCode = await filter()
}

start()
