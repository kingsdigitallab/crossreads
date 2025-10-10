import * as path from 'path';
import * as fs from 'fs';
import { utils, FILE_PATHS, SETTINGS } from '../../app/utils.mjs';
import { fileURLToPath } from 'url';
import { parseCommandLineArgs } from '../toolbox.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ANNOTATIONS_PATH = path.join(__dirname, '../..', FILE_PATHS.ANNOTATIONS)


class ConvertImages {

    constructor() {
        this.convertedFiles = {}
    }

    convertAnnotationFiles(convertFromAndTo=[]) {
        let ret = {}

        this.convertedFiles = {}

        for (let filename of fs.readdirSync(ANNOTATIONS_PATH)) {
            if (!filename.includes('.json')) continue;

            let hasChanged = false

            let filePath = path.join(ANNOTATIONS_PATH, filename)

            let annotations = utils.readJsonFile(filePath)
            for (let annotation of annotations) {
                for (let target of annotation?.target ?? []) {
                    if (target?.selector?.type === 'FragmentSelector') {
                        if (convertFromAndTo?.length) {
                            if (target.source.startsWith(convertFromAndTo[0])) {
                                target.source = convertFromAndTo[1] + target.source.substring(convertFromAndTo[0].length)
                                hasChanged = 1
                            }
                        }
                        let pattern = target.source.replace(/isic\d+\b.*$/i, '')
                        if (pattern !== target.source) this.addPattern(ret, pattern, 'annotation files', filePath)
                    }
                }
            }

            if (hasChanged) {
                this.convertedFiles[filePath] = 1
                utils.writeJsonFile(filePath, annotations)
            }
        }

        return ret
    }

    addPattern(patterns, pattern, fileType, filePath) {
        if (!patterns[pattern])  {
            patterns[pattern] = {}
        }
        if (!patterns[pattern][fileType]) {
            patterns[pattern][fileType] = {}
        }
        patterns[pattern][fileType][filePath] = 1
    }

    checkIndexFile(patterns, index_key) {
        let filePath = utils.resolveFilePathFromFileKey(index_key)
        let index = utils.readJsonFile(index_key)
        let items = index?.data
        if (items) {
            // test if `items` is an object rather than an array
            if (!Array.isArray(items)) items = Object.values(items)
            for (let item of items) {
                if (item?.img) {
                    let pattern = item.img.replace(/isic\d+\b.*$/i, '')
                    if (pattern !== item.img) this.addPattern(patterns, pattern, `items in ${filePath}`, item.id)
                }
            }
        }

        return patterns
    }

    logResults(patterns) {
        for (let [pattern, fileTypes] of Object.entries(patterns)) {
            console.log(pattern)
            for (let fileType of Object.keys(fileTypes)) {
                let fileCount = Object.keys(fileTypes[fileType]).length
                console.log(`  occurs in ${fileCount} ${fileType}`)
            }
        }
        if (this.verbosity) {
            console.log(patterns)
        }

        let convertedFilesCount = Object.keys(this.convertedFiles).length
        if (convertedFilesCount) {
            console.log(`---------`)
            console.log(`CONVERTED ${convertedFilesCount} files.`)
            console.log(`⚠  REMINDER: to propagate changes, please`)
            console.log(`generate search index (/.github/workflows/static.yml)`)
            console.log(`and re-publish site (/.github/workflows/index.yml).`)
        }
    }

    run() {
        let showHelp = true
        let patterns = {}

        let args = parseCommandLineArgs()
        this.verbosity = args.verbosity

        if (args.action === 'check') {
            patterns = this.convertAnnotationFiles()
            showHelp = false
        }
        if (args.action === 'convert') {
            if (args.params.length === 2) {
                patterns = this.convertAnnotationFiles([args.params[0], args.params[1]])
                showHelp = false
            }
        }
        if (!showHelp) {
            this.checkIndexFile(patterns, 'INDEX')
            this.checkIndexFile(patterns, 'INDEX_THUMBS')
        }

        if (showHelp) {
            this.showHelp(args)
        }

        this.logResults(patterns)
    }

    showHelp(args) {
        console.log(`Usage: ${args.scriptName} ACTION [ARG...] [-v]\n`)
        console.log(`Check or replace references to IIIF server in the data files`)
        console.log(`like annotation files, search index and thumbs index.\n`)
        console.log(`ACTIONS:\n`)
        console.log(`  check:       show URL patterns found in data files\n`)
        console.log(`  convert A B: replaces image URL prefix A with B`)
        console.log(`               in annotation files\n`)
        console.log(`OPTIONS:\n`)
        console.log(`  -v:          more verbose output\n`)
    }

}

let converter = new ConvertImages()
converter.run()

// Example:
//  node convert-img-urls.mjs https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF= http://localhost:4000/images
