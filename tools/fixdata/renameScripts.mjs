import {utils, FILE_PATHS} from '../../app/utils.mjs';
import { dirname } from 'node:path';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const PARENT_PATH = dirname(__filename);

const SCRIPT_REPLACE = {
    'latin-1': {
        key: 'latin', 
        name: 'Latin'
    },
    'greek-1': {
        key: 'greek', 
        name: 'Greek'
    },
}


// change the key and the name of the scripts in the definitions file
const filePath = `${PARENT_PATH}/../../${FILE_PATHS.DEFINITIONS}`
const definitions = utils.readJsonFile(filePath)
for (const [key, value] of Object.entries(definitions.scripts)) {
    if (SCRIPT_REPLACE[key]) {
        definitions.scripts[SCRIPT_REPLACE[key].key] = SCRIPT_REPLACE[key].name
        delete definitions.scripts[key]
    }
}
for (const [key, allo] of Object.entries(definitions.allographs)) {
    const newScript = SCRIPT_REPLACE[allo.script]
    if (newScript) {
        allo.script = newScript.key
    }
}
utils.writeJsonFile(`${filePath}`, definitions)

// change the script keys in all the .json files under /annotations/, except change-queue.json

function getAnnotationFiles() {
    const annotationsDir = path.join(PARENT_PATH, '..', '..', 'annotations');
  
    try {
      // Read all files in the /annotations directory
      const files = fs.readdirSync(annotationsDir);
  
      // Filter out .json files and exclude change-queue.json
      const jsonFiles = files.filter(file => 
        path.extname(file).toLowerCase() === '.json' && file !== 'change-queue.json'
      );
  
      // Convert filenames to full paths
      const filePaths = jsonFiles.map(file => path.join(annotationsDir, file));
  
      return filePaths;
    } catch (err) {
      console.error('Error reading directory:', err);
      throw err;
    }
}

const filePaths = getAnnotationFiles()
for (const filePath of filePaths) {
    const annotations = utils.readJsonFile(filePath)
    for (const annotation of annotations) {
        for (const body of annotation.body) {
            const script = body?.value?.script
            if (script && SCRIPT_REPLACE[script]) {
                body.value.script = SCRIPT_REPLACE[script].key
            }
        }
    }
    utils.writeJsonFile(filePath, annotations)
}

