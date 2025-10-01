/* Convert the annotation files 
to refer to the token in the TEI
by the new @n attribute 
instead of the @id attribute.
https://github.com/kingsdigitallab/crossreads/issues/108
*/
import fs from 'fs';
import path from "path";
import { utils, FILE_PATHS } from "../../app/utils.mjs";
import { xmlUtils } from "../../app/xml-utils.mjs";
import { crossreadsXML } from "../../app/crossreads-xml.mjs";

const TEI_FOLDER = '../ISicily/inscriptions/'
const UNSPECIFIED_CHARACTER = 'Unspecified character'

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
    let xmlFilePath = `${TEI_FOLDER}${isicId}.xml`

    if (!await this.isTEIConverted(xmlFilePath)) return

    console.log(xmlFilePath)

    let xmlString = fs.readFileSync(xmlFilePath, {encoding:'utf8', flag:'r'})
    let html = await crossreadsXML.getHtmlFromTei(xmlString)
    // let text = xmlUtils.toString(res)

    let annotations = utils.readJsonFile(annotationsFilePath)

    if (1) {
      // let idsToN = await this.getTokenMappingFromTEI(xmlPath)

      let seenTokenIds = {}
      // let xml = await xmlUtils.fromString(xmlString)
      for (let anno of annotations) {
        let annotationFileName = path.basename(annotationsFilePath)
        let reference = `(${annotationFileName}:${anno.id} -> ${xmlFilePath})`

        for (let target of anno.target) {
          // "value": "//*[@xml:id='AJABK']",
          let value = target?.selector?.value ?? ''
          // 'AJABK'
          let oldId = value.replace(/^.*xml:id='([^']+)'.*$/, '$1')

          if (oldId !== value) {
            let start = parseInt(target?.selector?.refinedBy?.start ?? -1, 10)
            if (start > -1) {
              let xpath = `//*[@data-tei-id='${oldId}']//*[@data-idx-w='${start}']`
              // str1.localeCompare(str2, 'en-US', { sensitivity: 'base' })
              let characterInDescription = anno?.body[0]?.value?.character ?? UNSPECIFIED_CHARACTER
              // str1.localeCompare(str2, 'en-US', { sensitivity: 'base' })
              let signSpans = await xmlUtils.xpath(html, xpath)
              if (signSpans.length === 1) {
                let signSpan = signSpans[0]
                let signInEdition = signSpan.textContent
                // console.log(xpath, characterInDescription, signInEdition)
                // console.log(xmlUtils.toString(signSpan))
                if (characterInDescription === UNSPECIFIED_CHARACTER || utils.areSignsEquivalent(characterInDescription, signInEdition)) {
                  // update the reference to the sign in the annotation
                  // https://stackoverflow.com/a/3854389
                  let nearestNNodes = xmlUtils.xpath(signSpan, "ancestor::*[string(number(@data-tei-n)) != 'NaN']")
                  if (nearestNNodes.length > 0) {
                    let nearestN = xmlUtils.getAttr(nearestNNodes[nearestNNodes.length-1], 'data-tei-n')
                    let signIdx = xmlUtils.getAttr(signSpan, 'data-idx-n')
                    target.value = `//*[@n='${nearestN}']`
                    target.selector.refinedBy.start = signIdx
                    let status = start !== signIdx ? 'INFO' : 'WARN'
                    console.log(`${status}: ${oldId}.${start} -> ${nearestN}.${signIdx} ${reference}`)
                  } else {
                    console.log(`WARN: no element with @n above the annotated sign ${reference}`)
                  }
                } else {
                  console.log(`WARN: Annotation character (${characterInDescription}) and linked TEI sign (${signInEdition}) don't match ${reference}`)
                }
              } else {
                console.log(`WARN: Sign not found in TEI ${reference}`)
              }
            }
            // if ((!idsToN[oldId] || !idsToN[oldId][0]) && !seenTokenIds[oldId]) {
            //   // console.log(`Token Id from annotation ${oldId} is not found in the inscription TEI (${idsToN[oldId][1]}).`)
            //   console.log(`WARNING: token Id from annotation ${oldId} is not found in the inscription TEI ${xmlPath}.`)
            //   seenTokenIds[oldId] = 1
            // }
          }
        }
      }
    }

    return true
  }

  async isTEIConverted(xmlPath) {
    // returns true if the TEI file contains the @n attribute on other elements than lb
    let xml = await xmlUtils.fromString(xmlPath)
    //let nodesWithN = xmlUtils.xpath(xml, "//tei:div[@type='edition'][not(@subtype)]//*[name() != 'lb'][@n]")
    let nodesWithN = await xmlUtils.xpath(xml, "//tei:div[@type='edition'][not(@subtype)]//*[name() != 'lb'][name() != 'cb'][not(@type='textpart')][@n]")

    if (!nodesWithN.length) {
      console.log(`WARN: no element with @n in the edition ${xmlPath}`)
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
