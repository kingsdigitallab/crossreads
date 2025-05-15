import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';
import { pullTEICorpus } from '../toolbox.mjs';
import { utils } from '../../app/utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ANNOTATIONS_PATH = path.join(__dirname, '../../annotations')

function getAllAnnotationFilePaths() {
    let ret = []

    for (let file of fs.readdirSync(ANNOTATIONS_PATH)) {
        if (!file.includes('.json')) continue;
        ret.push(path.join(ANNOTATIONS_PATH, file))
    }

    return ret
}

function getTEIFilePathFromAnnotationFilePath(annotationFilePath) {
    /*
    Example:
    annotationFilePath =
    '/prj/crossreads/annotations/http-sicily-classics-ox-ac-uk-inscription-isic030319-isic030319-jpg.json'
    returns
    'ISicily/inscriptions/ISic030319.xml'
    */

    return path.join('../ISicily/inscriptions', `${utils.getDocIdFromString(annotationFilePath).replace('isic', 'ISic')}.xml`)
}

function readAnnotationFileNamesFromTEIFile(TEIFilePath) {
    let ret = []
    
    // read the TEI file
    let TEIContent = fs.readFileSync(TEIFilePath, 'utf-8')
    
    // then use xpath to extract the url from all the following elements
    // <graphic n="screen" url="ISic030303_detail_tiled.tif" height="3680px" width="5520px">
    //// let urlElements = TEIContent.match(/<graphic[^>]*url="([^"]*)"/g)

    return ret
}

async function run() {
    // await pullTEICorpus()

    for (let annotationFilePath of getAllAnnotationFilePaths()) {
        let TEIFilePath = getTEIFilePathFromAnnotationFilePath(annotationFilePath)
        let annotationFileNames = readAnnotationFileNamesFromTEIFile(TEIFilePath)
        if (!annotationFileNames.includes(annotationFilePath)) {
            console.log(`Unused annotation file: ${annotationFilePath}`)
        }
    }
}

await run()
