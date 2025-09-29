/* Convert the annotation files 
to refer to the token in the TEI
by the new @n attribute 
instead of the @id attribute.
https://github.com/kingsdigitallab/crossreads/issues/108
*/
import fs from 'fs';
import path from "path";
import { xmlUtils } from "../../app/xml-utils.mjs";
import { utils, FILE_PATHS } from "../../app/utils.mjs";

const TEI_FOLDER = '../ISicily/inscriptions/'

class ConvertTokensInAnnotations {

  constructor() {
    this.errors = {}
  }

  async run() {
    let total = 0
    let withN = 0

    let annotationsFilesPath = '../../annotations'
    for (let annotationsFilePath of fs.readdirSync(annotationsFilesPath).sort()) {
      annotationsFilePath = path.join(annotationsFilesPath, annotationsFilePath);
      if (annotationsFilePath.endsWith('.json') && !fs.lstatSync(annotationsFilePath).isDirectory()) {
        if (annotationsFilePath.includes('http')) continue;
        // if (!annotationsFilePath.includes('0092-')) continue;

        // console.log(annotationsFilePath)
        let res = await this.processAnnotationsFile(annotationsFilePath)
        if (res) withN++
        total++
        // break
      }
    }

    console.log(`${withN} TEI files have a tei:w[@n]; ${total} files in total.`)

  }

  async processAnnotationsFile(annotationsFilePath) {
    let isicId = utils.getDocIdFromString(annotationsFilePath, true)
    let xmlPath = `${TEI_FOLDER}${isicId}.xml`

    if (!await this.isTEIConverted(xmlPath)) return

    let idsToN = await this.getTokenMappingFromTEI(xmlPath)

    let annotations = utils.readJsonFile(annotationsFilePath)

    let seenTokenIds = {}
    for (let anno of annotations) {
      for (let target of anno.target) {
        let value = target?.selector?.value ?? ''
        let oldId = value.replace(/^.*'([^']+)'.*$/, '$1')
        if (oldId !== value) {
          if ((!idsToN[oldId] || !idsToN[oldId][0]) && !seenTokenIds[oldId]) {
            // console.log(`Token Id from annotation ${oldId} is not found in the inscription TEI (${idsToN[oldId][1]}).`)
            console.log(`WARNING: token Id from annotation ${oldId} is not found in the inscription TEI ${xmlPath}.`)
            seenTokenIds[oldId] = 1
          }
        }
      }
    }
  }

  async isTEIConverted(xmlPath) {
    // returns true if the TEI file contains the @n attribute on other elements than lb
    let xml = await xmlUtils.fromString(xmlPath)
    //let nodesWithN = xmlUtils.xpath(xml, "//tei:div[@type='edition'][not(@subtype)]//*[name() != 'lb'][@n]")
    let nodesWithN = await xmlUtils.xpath(xml, "//tei:div[@type='edition'][not(@subtype)]//*[name() != 'lb'][@n]")

    if (!nodesWithN.length) {
      console.log(`WARNING: no element with @n in the edition ${xmlPath}`)
    }

    return nodesWithN.length > 0
  }

  async getTokenMappingFromTEI(teiPath) {
    let ret = {}

    let xsltPath = '../templates/tei-id-n.xslt'
    // let xsltPath = '../../app/data/tei2html.xslt'
    
    console.log(teiPath)

    let teiContent = fs.readFileSync(teiPath, {encoding:'utf8', flag:'r'})

    ret = await xmlUtils.xslt(teiContent, xsltPath)
    ret = xmlUtils.toString(ret)

    // console.log(ret)

    ret = ret.replace(/<\/?mapping>/g, '')
    ret = ret.replace(/,\s+}/g, '}')
    ret = JSON.parse(ret)
    
    // console.log(JSON.stringify(ret, null, 2))

    return ret
  }

}

const converter = new ConvertTokensInAnnotations()
await converter.run()
