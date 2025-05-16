/*
See github issue #100
https://github.com/kingsdigitallab/crossreads/issues/100

This script finds annotation files which are no longer referred by the TEI collection.

Method:
* for each annotation file we look up the corresponding TEI file
* we read the //tei:graphic/@url from the TEI file
* if the annotation file doesn't end with that url, it should be removed

*/
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';
import { pullTEICorpus } from '../toolbox.mjs';
import { utils } from '../../app/utils.mjs';
import { xmlUtils } from '../../app/xml-utils.mjs';

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

    let ret = null

    let docId = utils.getDocIdFromString(annotationFilePath).replace('isic', 'ISic')
    if (docId) {
        ret = path.join('../ISicily/inscriptions', `${docId}.xml`)
    }

    return ret
}

async function readAnnotationFileNamesFromTEIFile(TEIFilePath) {
    let ret = []
    
    // read the TEI file
    // let TEIContent = fs.readFileSync(TEIFilePath, 'utf-8')
    
    // then use xpath to extract the url from all the following elements
    // <graphic n="screen" url="ISic030303_detail_tiled.tif" height="3680px" width="5520px">
    //// let urlElements = TEIContent.match(/<graphic[^>]*url="([^"]*)"/g)

    let xml = await xmlUtils.fromString(TEIFilePath)
    // console.log(TEIFilePath)
    // TODO: should change to screen AND always match logic in annotator.mjs
    let xpath  = '//tei:graphic[@n="print"][@url]'
    let graphics = xmlUtils.xpath(xml, xpath)
    if (graphics) {
        for (let graphic of graphics) {
            let url = graphic.getAttribute('url')
            let res = utils.slugify(`/${url}`) + '.json'
            ret.push(res)
        }
    }

    return ret
}

async function run() {
    await pullTEICorpus()

    for (let annotationFilePath of getAllAnnotationFilePaths()) {
        let TEIFilePath = getTEIFilePathFromAnnotationFilePath(annotationFilePath)
        if (TEIFilePath) {
            let annotationFileNames = await readAnnotationFileNamesFromTEIFile(TEIFilePath)
            let found = false
            for (let suffix of annotationFileNames) {
                if (annotationFilePath.endsWith(suffix)) {
                    found = true
                    break
                }
            }
            if (!found) {
                console.log(`Unused annotation file: ${annotationFilePath}`)
            }
        }
    }
}

await run()
