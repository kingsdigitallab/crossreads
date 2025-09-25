/* 
See https://github.com/kingsdigitallab/crossreads/issues/71
annotation filenmaes where build from the .jpg (print)
rather than the .tif (screen) image found in the TEI.

This script renames all the annotation files.
*/
import fs from 'fs';
import path from "path";
import { xmlUtils } from "../../app/xml-utils.mjs";
import { utils, FILE_PATHS } from "../../app/utils.mjs";

const TEI_FOLDER = '../ISicily/inscriptions/'

class RenameAnnotationFiles {

  constructor() {
    this.errors = {}
  }

  async run() {
    const rootFolderRelativePath = '../..'

    for (let teiPath of fs.readdirSync(TEI_FOLDER).sort()) {
      teiPath = path.join(TEI_FOLDER, teiPath);
      if (teiPath.endsWith('.xml') && !fs.lstatSync(teiPath).isDirectory()) {
        // if (!teiPath.includes('0085.xml')) continue;
        console.log(teiPath)
        let content = fs.readFileSync(teiPath, {encoding:'utf8', flag:'r'})
        // content = xmlUtils.removeNamespaces(content)
        const xml = await xmlUtils.fromString(content)
        const graphicNodes = xmlUtils.xpath(xml, '//tei:graphic[@url][@n="screen"]')
        for (let graphicNode of graphicNodes) {
          // e.g. ISic000001_tiled.tif
          let imageUrl = xmlUtils.getAttr(graphicNode, 'url')
          if (imageUrl) {
            let annotationFileName = utils.getAnnotationFilenameFromImageAndDoc(imageUrl)
            let annotationFileNameOld = utils.getAnnotationFilenameFromImageAndDoc(imageUrl.replace('_tiled.tif', '.jpg'), null, true)
            
            let annotationFilePathOld = path.join(rootFolderRelativePath, annotationFileNameOld)
            if (fs.existsSync(annotationFilePathOld)) {
              console.log(annotationFilePathOld)
              let annotationFilePath = path.join(rootFolderRelativePath, annotationFileName)
              console.log(annotationFilePath)
              utils.exec(`git mv ${annotationFilePathOld} ${annotationFilePath}`)
              // fs.renameSync(annotationFilePathOld, annotationFilePath)
            }
          }
        }
        // break
      }
    }  

  }

}

const renamer = new RenameAnnotationFiles()
await renamer.run()
