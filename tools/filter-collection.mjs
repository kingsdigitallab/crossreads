/*
Fetch the full DTS collection metadata.
Read the shortlist of inscriptions IDs relevant for the annotator.
Writes the subset of the DTS collection metadata based on those IDs.
*/
import path from "node:path";
import { SETTINGS, utils } from "../app/utils.mjs";

let srcPath = process.argv.pop()
if (!srcPath.endsWith('.json')) {
    console.log('First argument should be the path of a json file with an array of object ids.')
    process.exit(1)
}

const SUB_COLLECTION_IDS_DISK_PATH = utils.resolveFilePathFromFileKey('INSCRIPTIONS_IDS')
const SUB_COLLECTION_DISK_PATH = path.join(path.dirname(srcPath), 'collection.json')

async function filter() {
    let ret = 0

    // 1. read the list of inscription ids
    let subCollectionIDs = utils.readJsonFile(SUB_COLLECTION_IDS_DISK_PATH)

    // 2. read the collection
    let fullCollection = await utils.fetchJsonFile(SETTINGS.DTS_COLLECTION)
    let filteredCollection = JSON.parse(JSON.stringify(fullCollection))
    
    // 3. filter the collection by the list of inscriptions
    filteredCollection.member = fullCollection.member.filter(m => subCollectionIDs.includes(m?.title))

    // 4. write the filtered collection
    utils.writeJsonFile(SUB_COLLECTION_DISK_PATH, filteredCollection, 'subcollection')

    // 5. report ids that were not found
    let missingids = []
    let allids = filteredCollection.member.map(m => m?.title)
    for (let iid of subCollectionIDs) {
        if (!allids.includes(iid)) {
            console.log(`WARNING: object id (${iid}) not found in the base collection.`)
            missingids.push(iid)
        }
    }
    
    console.log(`TASK    filter ${subCollectionIDs.length} inscriptions (${SUB_COLLECTION_IDS_DISK_PATH}) from ${fullCollection.member.length} (${SETTINGS.DTS_COLLECTION})`)
    console.log(`WRITTEN ${filteredCollection.member.length} inscriptions into ${SUB_COLLECTION_DISK_PATH}`)
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
