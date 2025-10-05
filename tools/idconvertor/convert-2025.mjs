/* Convert the annotation files 
to refer to the token in the TEI
by the new @n attribute 
instead of the @id attribute (old system).

For details, see:
https://github.com/kingsdigitallab/crossreads/issues/108

This script can also be used to
detect and report issues with the
reference from the annotations
to the signs in the TEI texts
in both the old and new system.
*/
import fs from 'fs';
import path from "path";
import { utils, FILE_PATHS, SETTINGS } from "../../app/utils.mjs";
import { xmlUtils } from "../../app/xml-utils.mjs";
import { crossreadsXML } from "../../app/crossreads-xml.mjs";
import { parseCommandLineArgs } from "../toolbox.mjs"

const TEI_FOLDER = '../ISicily/inscriptions/'
const UNSPECIFIED_CHARACTER = 'Unspecified character'

class ConvertTokensInAnnotations {

  constructor() {
    this.errors = {}
  }

  async run() {
    let args = parseCommandLineArgs()
    this.verbosity = args.verbosity
    this.action = args.action

    if (!['check', 'convert'].includes(this.action)) {
      this.showHelp(args)
      return
    }

    let total = 0
    let withN = 0

    let annotationsFilesPath = '../../annotations'
    for (let annotationsFilePath of fs.readdirSync(annotationsFilesPath).sort()) {
      annotationsFilePath = path.join(annotationsFilesPath, annotationsFilePath);
      if (annotationsFilePath.endsWith('.json') && !fs.lstatSync(annotationsFilePath).isDirectory()) {
        if (annotationsFilePath.includes('http')) continue;
        if (!annotationsFilePath.includes('0085-')) continue;

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

    let annotationsHaveChanged = false

    // console.log(xmlFilePath)

    let xmlString = fs.readFileSync(xmlFilePath, {encoding:'utf8', flag:'r'})
    let html = await crossreadsXML.getHtmlFromTei(xmlString)

    let annotations = utils.readJsonFile(annotationsFilePath)

    for (let anno of annotations) {
      let annotationFileName = path.basename(annotationsFilePath)
      let reference = `(${annotationFileName}:${anno.id} -> ${xmlFilePath})`

      for (let target of anno.target) {
        // "value": "//*[@xml:id='AJABK']"
        let value = target?.selector?.value ?? ''
        // 'AJABK'
        let oldId = value.replace(/^.*xml:id='([^']+)'.*$/, '$1')
        if (oldId === value) oldId = null
        // "value": "//*[@n='10']" => 10
        let newId = value.replace(/^.*@n='([^']+)'.*$/, '$1')
        if (newId === value) newId = null

        let start = parseInt(target?.selector?.refinedBy?.start ?? -1, 10)

        if (!oldId && !newId) {
          continue
        }
        if (start === -1) {
          console.log(`WARN: annotation points to a token id but not a sign index ${reference}`)
          continue
        }

        let characterInDescription = anno?.body[0]?.value?.character ?? UNSPECIFIED_CHARACTER
        let xpath = `//*[@data-tei-id='${oldId}']//*[@data-idx-w='${start}']`
        if (newId) {
          // xpath = `//*[@data-tei-n='${newId}']//*[@data-idx-n='${start}']`
          xpath = xmlUtils.convertXpathFromTEItoHTML(value, start)
        }
        let signSpans = await xmlUtils.xpath(html, xpath)
          
        if (signSpans.length === 1) {
          let signSpan = signSpans[0]
          let signInEdition = signSpan.textContent
          
          if (characterInDescription === UNSPECIFIED_CHARACTER || utils.areSignsEquivalent(characterInDescription, signInEdition)) {
            if (oldId) {
              // find the new token id and sign index
              // https://stackoverflow.com/a/3854389
              // let nearestNNodes = xmlUtils.xpath(signSpan, "ancestor::*[string(number(@data-tei-n)) != 'NaN']")
              let nearestNNodes = xmlUtils.xpath(signSpan, `ancestor::${SETTINGS.XPATH_TOKENS_IN_TEI.replace(/^\/\//, '')}[string(number(@data-tei-n)) != 'NaN']`)
              if (nearestNNodes.length > 0) {
                let nearestNNode = nearestNNodes[nearestNNodes.length-1]
                let nearestN = xmlUtils.getAttr(nearestNNode, 'data-tei-n')
                let nearestNTag = xmlUtils.getAttr(nearestNNode, 'data-tei')
                if (!SETTINGS.EXPECTED_TOKEN_TAGS.includes(nearestNTag)) {
                  console.log(`WARN: ancestor with @n has an unexpected tag: <${nearestNTag}> ${reference}`)
                }
                let signIdx = xmlUtils.getAttr(signSpan, 'data-idx-n')

                // update the annotation with the new id and idx
                //target.selector.value = `//*[name()!='lb'][@n='${nearestN}']`
                target.selector.value = `${SETTINGS.XPATH_TRANSCRIPTION_IN_TEI}${SETTINGS.XPATH_TOKENS_IN_TEI}[@n='${nearestN}']`
                target.selector.refinedBy.start = parseInt(signIdx, 10)

                annotationsHaveChanged = true

                newId = nearestN

                let status = start !== signIdx ? 'INFO' : 'WARN'
                console.log(`${status}: ${oldId}.${start} -> ${nearestN}.${signIdx} ${reference}`)
              } else {
                console.log(`WARN: Annotated sign has no ancestor with @n ${reference}`)
              }
            }
          } else {
            console.log(`WARN: Annotation character (${characterInDescription}) and linked TEI sign (${signInEdition}) don't match ${reference}`)
          }
        } else {
          console.log(`WARN: Sign not found in TEI ${reference}`)
        }

      }
    }

    if (annotationsHaveChanged && this.action === 'convert') {
      utils.writeJsonFile(annotationsFilePath, annotations)
    }

    return true
  }

  async isTEIConverted(xmlPath) {
    // returns true if the TEI file contains the @n attribute on other elements than lb
    let xml = await xmlUtils.fromString(xmlPath)
    //let nodesWithN = xmlUtils.xpath(xml, "//tei:div[@type='edition'][not(@subtype)]//*[name() != 'lb'][@n]")
    let xpath = `${SETTINGS.XPATH_TRANSCRIPTION_IN_TEI}${SETTINGS.XPATH_TOKENS_IN_TEI}[@n]`
    let nodesWithN = await xmlUtils.xpath(xml, xpath)

    if (!nodesWithN.length) {
      console.log(`WARN: no token with @n in the edition ${xmlPath}`)
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


  showHelp(args) {
    console.log(`Usage: ${args.scriptName} ACTION [ARG...] [-v]\n`)
    console.log(`Check or convert the references to TEI tokens and signs in the annotation files\n`)
    console.log(`See https://github.com/kingsdigitallab/crossreads/issues/108\n`)
    console.log(`ACTIONS:\n`)
    console.log(`  check:       check the validity of the old/new references\n`)
    console.log(`  convert:     convert annotations to new reference system\n`)
    console.log(`OPTIONS:\n`)
    console.log(`  -v:          more verbose output\n`)
  }

}

const converter = new ConvertTokensInAnnotations()
await converter.run()
