import { Liquid } from 'liquidjs'
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ISICILY_REPO_PATH_GITHUB = 'ISicily/ISicily'
const ISICILY_INSCRIPTION_PATH = 'inscriptions'
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

    return path.join(ISICILY_REPO_PATH_LOCAL, ISICILY_INSCRIPTION_PATH)
}

/**
 * parse the command line arguments and return
 * a dictionary with its various components.
 * 
 * e.g. node myscript.mjs check dir1 -v --exclude file1
 * 
 * returns
 * 
 * {
 *      scriptName: 'myscript.mjs',
 *      action: 'check',
 *      params: ['dir1'],
 *      options: {
 *          '-v': [],
 *          '--exclude': [file1]
 *      },
 *      verbosity: 1
 * }
 */
export function parseCommandLineArgs() {
    let ret = {
        scriptName: path.basename(process.argv[1]),
        action: '',
        params: [],
        options: {},
        verbosity: 0,
    }

    let args = process.argv.slice(2)
    let lastOption = null
    while (args.length) {
        let arg = args.shift()
        if (arg.startsWith('-')) {
            lastOption = arg
            ret.options[arg] = []
            if (arg === '-v') {
                ret.verbosity = 1
            }
        } else {
            if (lastOption) {
                ret.options[lastOption].push(arg)
            } else {
                if (!ret.action) {
                    ret.action = arg    
                } else {
                    ret.params.push(arg)
                }
            }
        }
    }

    return ret
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
