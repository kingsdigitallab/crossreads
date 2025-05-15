import { Liquid } from 'liquidjs'
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ISICILY_REPO_PATH_GITHUB = 'ISicily/ISicily'
const ISICILY_REPO_PATH_LOCAL = path.join(__dirname, ISICILY_REPO_PATH_GITHUB.split('/')[0])

export function renderTemplate(templateName, context) {
    const engine = new Liquid({
        root: './templates/'
    })
    return engine.renderFileSync(templateName, context)
}

export async function pullTEICorpus() {
    // This function does a git pull from within ISicily sub-folder
    // If the ISicily is empty or absent it clones it from ISICILY_REPO
    console.log(ISICILY_REPO_PATH_LOCAL)
    if (!fs.existsSync(ISICILY_REPO_PATH_LOCAL)) {
        console.log(`Cloning ${ISICILY_REPO_PATH_GITHUB} repository...`)
        await child_process.execSync(`git clone https://github.com/${ISICILY_REPO_PATH_GITHUB} ${ISICILY_REPO_PATH_LOCAL}`)
    } else {
        console.log('Pulling latest changes from the repository...')
        await child_process.execSync(`cd ${ISICILY_REPO_PATH_LOCAL} && git pull`)
    }
}

// export function isXMLWellFormed(xmlString) {
//     let ret = false

//     const parser = new DOMParser();
//     try {
//         const doc = parser.parseFromString(xmlString, 'application/xml');
//         if (doc.getElementsByTagName('parsererror').length === 0) {
//             ret = true
//             console.log('XML is well-formed.');
//         } else {
//             console.log('XML is not well-formed.');
//         }
//     } catch (e) {
//         console.log('XML is not well-formed.');
//     }

//     return ret
// }
