import * as path from 'path';
import * as fs from 'fs';
import { utils, FILE_PATHS, SETTINGS } from '../../app/utils.mjs';
import { parseCommandLineArgs } from '../toolbox.mjs';


export class ConvertURLs {

    constructor() {
        this.convertedFiles = {}
        this.patterns = {}
    }

    convertAnnotationFiles(convertFromAndTo=[]) {
        this.convertedFiles = {}

        let annotationsPath = utils.resolveFilePathFromFileKey('ANNOTATIONS')

        for (let filename of fs.readdirSync(annotationsPath)) {
            if (!filename.includes('.json')) continue;

            let changeCount = 0

            let filePath = path.join(annotationsPath, filename)

            let annotations = utils.readJsonFile(filePath)
            for (let annotation of annotations) {
                changeCount += this.convertAnnotation(filePath, annotation, convertFromAndTo)
            }

            if (changeCount) {
                this.convertedFiles[filePath] = 1
                utils.writeJsonFile(filePath, annotations)
            }
        }
    }

    convertAnnotation(filePath, annotation, convertFromAndTo=[]) {
        throw Error('this method is not implemented in subclass')
    }

    addPattern(pattern, fileType, filePath) {
        let patterns = this.patterns
        if (!patterns[pattern])  {
            patterns[pattern] = {}
        }
        if (!patterns[pattern][fileType]) {
            patterns[pattern][fileType] = {}
        }
        patterns[pattern][fileType][filePath] = 1
    }

    checkIndexFile(indexKey) {
        let index = utils.readJsonFile(indexKey)
        let items = index?.data
        if (items) {
            // test if `items` is an object rather than an array
            if (!Array.isArray(items)) items = Object.values(items)
            for (let indexItem of items) {
                this.checkIndexItem(indexKey, indexItem)
            }
        }
    }

    checkIndexItem(filePath, indexItem) {
        throw Error('this method is not implemented in subclass')
    }

    logResults() {
        for (let [pattern, fileTypes] of Object.entries(this.patterns)) {
            console.log(pattern)
            for (let fileType of Object.keys(fileTypes)) {
                let fileCount = Object.keys(fileTypes[fileType]).length
                console.log(`  occurs in ${fileCount} ${fileType}`)
            }
        }
        if (this.verbosity) {
            console.log(this.patterns)
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

        let args = parseCommandLineArgs()
        this.verbosity = args.verbosity

        if (args.action === 'check') {
            this.convertAnnotationFiles()
            showHelp = false
        }
        if (args.action === 'convert') {
            if (args.params.length === 2) {
                this.convertAnnotationFiles([args.params[0], args.params[1]])
                showHelp = false
            }
        }
        if (!showHelp) {
            this.checkIndexFile('INDEX')
            this.checkIndexFile('INDEX_THUMBS')
        }

        if (showHelp) {
            this.showHelp(args)
        }

        this.logResults()
    }

    showHelp(args) {
        console.log(`Usage: ${args.scriptName} ACTION [ARG...] [-v]\n`)
        this.showScriptDescription()
        console.log(`ACTIONS:\n`)
        console.log(`  check:       show URL patterns found in data files\n`)
        console.log(`  convert A B: replaces image URL prefix A with B`)
        console.log(`               in annotation files\n`)
        console.log(`OPTIONS:\n`)
        console.log(`  -v:          more verbose output\n`)
    }

    showScriptDescription() {
        throw Error('this method is not implemented in subclass')
    }

}
