import path from 'node:path';
import fs from 'node:fs';
import { utils, FILE_PATHS, SETTINGS } from '../app/utils.mjs';
// import { parseCommandLineArgs } from '../toolbox.mjs';


let mapping = []

let annotationsPath = utils.resolveFilePathFromFileKey('ANNOTATIONS')

for (let filename of fs.readdirSync(annotationsPath)) {
    if (!filename.includes('.json')) continue;

    let filePath = path.join(annotationsPath, filename)

    let annotations = utils.readJsonFile(filePath)
    for (let annotation of annotations) {
        mapping.push([annotation.id, filename])
    }

}

for (let row of mapping) {
    console.log(row.map(v => `"${v}"`).join(","))
}
