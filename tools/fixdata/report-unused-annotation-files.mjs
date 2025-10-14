/*
See github issue #100
https://github.com/kingsdigitallab/crossreads/issues/100

This script finds annotation files which are no longer referred by the TEI collection.

Method:
* for each annotation file we look up the corresponding TEI file
* we read the //tei:graphic/@url from the TEI file
* if the annotation file doesn't end with that url, it should be removed

*/
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pullTEICorpus } from '../toolbox.mjs';
import { utils, SETTINGS } from '../../app/utils.mjs';
import { xmlUtils } from '../../app/xml-utils.mjs';

function getAllAnnotationFilePaths() {
    let ret = []

    let annotations_path = utils.resolveFilePathFromFileKey('ANNOTATIONS')

    for (let file of fs.readdirSync(annotations_path)) {
        if (!file.includes('.json')) continue;
        ret.push(path.join(annotations_path, file))
    }

    return ret
}

function getTEIFilePathFromAnnotationFilePath(teiFolderPath, annotationFilePath) {
    /*
    Example:
    annotationFilePath =
    '/prj/crossreads/annotations/http-sicily-classics-ox-ac-uk-inscription-isic030319-isic030319-jpg.json'
    returns
    'ISicily/inscriptions/ISic030319.xml'
    */

    let ret = null

    let docId = utils.getDocIdFromString(annotationFilePath, true)
    if (docId) {
        ret = path.join(teiFolderPath, `${docId}.xml`)
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
    let xpath  = '//tei:graphic[@n="screen"]/@url'
    let graphicUrlAttrs = xmlUtils.xpath(xml, xpath)
    let docId = utils.getDocIdFromString(TEIFilePath)
    for (let graphicUrlAttr of graphicUrlAttrs) {
        let res = utils.getAnnotationPathFromImageAndDoc(
            graphicUrlAttr.value,
            `${SETTINGS.DTS_DOC_BASE}${docId}`
        )
        ret.push(res)
    }

    return ret
}

async function run() {
    let teiFolderPath = await pullTEICorpus()

    for (let annotationFilePath of getAllAnnotationFilePaths()) {
        let TEIFilePath = getTEIFilePathFromAnnotationFilePath(teiFolderPath, annotationFilePath)
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
        } else {
            console.log(`Can't find TEI file from annotation file: ${annotationFilePath}`)
        }
    }
}

await run()
