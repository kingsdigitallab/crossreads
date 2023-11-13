/*
TODO
1. data-idx can only increase by 1 or reset to 0
2. no space within a word
3. no letter outside a word
*/
const fs = require('fs');
const path = require("path");
const utils = require("../app/utils");
const xmlUtils = require("../app/xml-utils");
const HELP = 'Test that the encoding of the TEI corpus allows word and sign segmentation.'

const DOWNLOAD_CORPUS = 'git clone https://github.com/ISicily/ISicily'
const DTS_COLLECTION_JSON='../app/data/2023-08/inscriptions.json'

const TEI_FOLDER = './ISicily/inscriptions/'

const namespaces = {
  'tei': 'http://www.tei-c.org/ns/1.0',
  'xhtml': 'http://www.w3.org/1999/xhtml',
};

class TestWords {

  constructor() {
  }

  downloadCorpus() {
    if (!fs.existsSync(TEI_FOLDER)) {
      console.log(`Cloning corpus repository...`)
      utils.exec(DOWNLOAD_CORPUS)
    }
  }

  async test() {
    this.downloadCorpus()

    let shortList = utils.readJsonFile(DTS_COLLECTION_JSON)
    // shortList = null

    // scan the TEI files
    let total = 0
    let errors = 0
    let totalLength = 0
    for (let filename of fs.readdirSync(TEI_FOLDER).sort()) {
      if (shortList && !shortList.includes(filename.replace('.xml', ''))) continue;

      let filePath = path.join(TEI_FOLDER, filename);
      if (filePath.endsWith('.xml') && !fs.lstatSync(filePath).isDirectory()) {
        total += 1
        errors += this.testTEI(filePath) ? 0 : 1
        // let res = await this.getPlainText(filePath)
        // console.log(res, res.length)
        // totalLength += res.length
        if (errors > 0) break;
      }
    }

    // (${(totalLength/1024/1024).toFixed(3)} MB)
    console.log(`${errors} TEI files with errors (${total} parsed)`)
  }

  async getPlainText(filePath) {
    let xml = await xmlUtils.fromString(filePath)
    let ret = xmlUtils.xpath(xml, "//tei:text/tei:body/tei:div[@type='edition']//text()", namespaces)
    ret = xmlUtils.toString(ret)
    ret = ret.replace(/\s+/g, ' ')
    return ret
  }

  testTEI(filePath) {
    let ret = true
    console.log(filePath)

    let content = this.readFile(filePath)
    if (!content) return;

    let res = this.getHtmlFromTei(content)    

    if (res) {
      // 1. data-idx can only increase by 1 or reset to 0

      let message = ''

      message = '@data-idx should increase by 1'
      let nodes = xmlUtils.xpath(res, '//*[@data-idx]')
      let idxLast = 0
      for (let node of nodes) {
        let idx = parseInt(node.getAttribute('data-idx'))
        if (idx !== 0 && idx != idxLast + 1) {
          ret = this.fail(filePath, message, `${idxLast+1}`, `${idx}`, xmlUtils.toString(node))
        }
        idxLast = idx
      }

      message = 'space within a word'
      // nodes = xmlUtils.xpath(res, "//*[contains(@class, 'tei-w') and //text() = ' ']")
      nodes = xmlUtils.xpath(res, "//*[contains(@class, 'is-word')]//text()")
      for (let node of nodes) {
        // console.log(xmlUtils.toString(node)+']')
        if (xmlUtils.toString(node).match(/^.*\s.*$/)) {
          ret = this.fail(filePath, message, '', '', xmlUtils.toString(node))
        }
      }    

      message = 'word without id'
      nodes = xmlUtils.xpath(res, "//*[contains(@class, 'is-word') and not(@data-tei-id)]")
      for (let node of nodes) {
        ret = this.fail(filePath, message, '', '', xmlUtils.toString(node))
      }    

      message = 'nested word'
      nodes = xmlUtils.xpath(res, "//*[contains(@class, 'is-word')]//*[contains(@class, 'is-word')]")
      for (let node of nodes) {
        ret = this.fail(filePath, message, '', '', xmlUtils.toString(node))
      }

      message = 'characters without is-word ancestor'
      nodes = xmlUtils.xpath(res, "//text()")
      for (let node of nodes) {
        // console.log(xmlUtils.toString(node)+']')
        if (!xmlUtils.toString(node).match(/^.*\s.*$/) && !xmlUtils.xpath(node, "ancestor::*[contains(@class, 'is-word')]")) {
          ret = this.fail(filePath, message, '', '', xmlUtils.toString(node))
        }
      }    
    }

    if (!ret) {
      console.log(xmlUtils.toString(res))
      console.log('--------------------')
    }

    return ret
  }

  fail(fileName, rule, expected, got, context) {
    let gotExpected = ''
    if (expected != got) {
      gotExpected = `expected ${expected}; got ${got};`
    }
    console.log(`FAIL: in ${fileName}; rule: "${rule}"; ${gotExpected}\n  context: ${context}`)
    return false
  }

  getHtmlFromTei(xmlString) {
    let crossreadsXML = require('../app/crossreads-xml')
    return crossreadsXML.getHtmlFromTei(xmlString)

    // // Remove diacritic, b/c 
    // // a) some erroneously come out as single text() character in the XSLT
    // // b) partners requested they are hidden in annotator text viewer
    // // c) more complex to map to characters in the palaeographic definitions
    // xmlString = xmlString.normalize("NFD").replace(/\p{Diacritic}/gu, "")

    // let ret = xmlUtils.xslt(xmlString, TEI2HTML_XSLT, true)

    // // assign the @data-idx sequentially relative to each .is-word
    // ret = xmlUtils.xslt(ret, HTML2HTML_XSLT, true)

    // return ret
  }

  readFile(path) {
    let ret = null
    if (fs.existsSync(path)) {
      ret = fs.readFileSync(path, {encoding:'utf8', flag:'r'})
    }
    return ret
  }

  hasIds(xmlString) {
    const res = xslt.xsltProcess(
      xmlParser.xmlParse(xmlString),
      this.xslt
    )

    // return xmlString.match(/<ab><\/ab>/g)
  }

  // getHTMLFromTEI(xmlString) {
  //   fetch(TEI_TO_HTML_XSLT_PATH)
  //   .then(res => res.text())
  //   .then(res => new window.DOMParser().parseFromString(res, 'text/xml'))
  //   .then(res => {
  //     let processor = new XSLTProcessor()
  //     processor.importStylesheet(res)
  //     let doc = processor.transformToFragment(xml, document)
  //     // set index of each line, starting from 1
  //     let lineIdx = 0
  //     for (let lineNumber of doc.querySelectorAll('.line-number')) {
  // }

  addAnnotationsFromFile(filePath) {
    // annotation = {
    //   'chr': 'A',
    //   'scr': 'latin',
    //   'tag': ['tag1', 'tag-2'],
    //   'img': "https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=/inscription_images/ISic001408/ISic001408_tiled.tif",
    //   'box': 'xywh=pixel:3433.048828125,1742.54443359375,256.946044921875,253.8504638671875',
    //   'doc': 'https://crossreads.web.ox.ac.uk/api/dts/documents?id=ISic001408',
    // }

    let content = utils.readJsonFile(filePath)
    if (!content) return;

    for (let annotation of content) {
      let bodyValue = annotation?.body[0]?.value

      if (bodyValue?.character) {
        let scriptName = this.definitions.scripts[bodyValue.script]
        this.annotations.push({
          'id': annotation.id,
          'chr': bodyValue.character,
          'scr': scriptName,
          'tag': bodyValue.tags,
          'doc': annotation.target[1]?.source,
          'img': annotation.target[0].source,
          'box': annotation.target[0].selector.value
        })
      }

      // collect all unique tags
      // if (bodyValue?.tags) {
      //   for (let tag of bodyValue?.tags) {
      //     this.tags.push(tag)
      //   }
      // }
    }
  }

  async loadDefinitions() {
    this.definitions = utils.readJsonFile(DEFINITIONS_PATH)    
  }

  build(annotations_path) {

    this.loadDefinitions()

    for (let filename of fs.readdirSync(annotations_path).sort()) {
      let filePath = path.join(annotations_path, filename);
      if (filePath.endsWith('.json') && !fs.lstatSync(filePath).isDirectory()) {
        this.addAnnotationsFromFile(filePath)
      }
    }

    this.write()
  }

  write() {
    fs.writeFileSync(this.path, JSON.stringify(this.annotations, null, COMPRESS_OUTPUT ? 0 : 2))
    console.log(`WRITTEN ${this.path}, ${this.annotations.length} annotation(s).`)
  }

}

const tester = new TestWords()
tester.test()
