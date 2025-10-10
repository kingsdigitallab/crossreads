import { utils, IS_BROWSER } from './utils.mjs';
import { SaxonJS } from './saxon-js.mjs';

let fs = null
if (!IS_BROWSER) {
  fs = (await import('fs'));
}

async function mod(exports) {

  exports.removeNamespaces = (xmlString) => xmlString.replace(/\s*xmlns(:\w+)?="[^"]*"/g, "")

  // this is null in browser; but defined in nodje...
  exports.XError = SaxonJS?.XError

  exports.xslt = async (xml, xsltPath) => {
    let ret = null

    if (!xml) return ret;

    let transformJsonPath = await writeTransformJson(xsltPath)

    // https://www.saxonica.com/saxon-js/documentation2/index.html#!api/transform

    let options = {
      // sourceFileName: docPath,
      // destination: "serialized",
      destination: "document",
      outputProperties: {
        // method: isOuputHtml ? 'html' : 'xml',
        method: 'xml',
        indent: true,
      }
    }

    if (IS_BROWSER) {
      options.stylesheetLocation = transformJsonPath
    } else {
      options.stylesheetFileName = transformJsonPath
    }

    if (typeof xml === 'string' || xml instanceof String) {
      options.sourceText = xml
    }
    if (xml.nodeName) {
      options.sourceNode = xml
    }

    let output = SaxonJS.transform(options, "sync");

    ret = output.principalResult;

    return ret
  }

  async function writeTransformJson(xsltPath) {
    let ret = xsltPath.replace(/\.xslt?$/, '.sef.json')
    if (!IS_BROWSER) {
      if (!fs.existsSync(xsltPath)) {
        throw new Error(`Transform file not found: ${xsltPath}`)
      }
      if (getFileModifiedTime(ret) < getFileModifiedTime(xsltPath)) {
        await utils.exec(`npx xslt3 -xsl:${xsltPath} -export:${ret} -t -ns:##html5 -nogo`)
      }
    }
    return ret    
  }

  function getFileModifiedTime(path) {
    let ret = 0
    if (fs.existsSync(path)) {
      ret = fs.statSync(path).mtime.getTime()
    }
    return ret
  }

  /**
   * Returns an array of items matching the xpath.
   * 
   * @param {Object} xml XML document as a Saxon object
   * @param {String} xpath the xpath selector
   * @param {Object} namespaces dictionary mapping prefixes to namespace URIs
   * 
   * namespaces.default is the default namespace
   */
  exports.xpath = (xml, xpath, namespaces) => {
    // SaxonJS.getResource({
    //   // location: '../../src/test.xml',
    //   text: xmlString,
    //   type: "xml"
    // }).then(doc => {

    let options = {
      resultForm: 'array',
      namespaceContext: {
        tei: 'http://www.tei-c.org/ns/1.0',
        xhtml: 'http://www.w3.org/1999/xhtml'
      },
      xpathDefaultNamespace: 'http://www.w3.org/1999/xhtml'
    }

    if (namespaces) {
      options.namespaceContext = {...namespaces}
      if (namespaces.default) {
        options.xpathDefaultNamespace = namespaces.default
        delete options.namespaceContext.default
      }
    }

    const items = SaxonJS.XPath.evaluate(xpath, xml, options);

    return items
  }

  exports.toString = (xml, keepNamespaces=false) => {
    if (typeof xml === 'string' || xml instanceof String) {
      return xml
    }
    if (xml?.nodeType === 2) {
      // attribute
      return `@${xml.localName}="${xml.value}"`
    }
    
    let ret = SaxonJS.serialize(xml, {
      method: 'html',
      indent: true,
      "omit-xml-declaration": true
    })
    if (!keepNamespaces) {
      ret = ret.replace(/\s*xmlns(:\w+)?="[^"]*"/g, '')
    }
    return ret
  }

  exports.fromString = async (xmlString) => {
    // xmlString is either:
    // * a URL
    // * a relative path
    // * x string with XML content
    let options = {
      type: 'xml'
    }
    if (xmlString.includes('<')) {
      options.text = xmlString
    } else {
      if (IS_BROWSER) {
        options.location = xmlString
      } else {
        options.file = xmlString
      }
    }
    return await SaxonJS.getResource(options)
  }

  exports.getAttr = (node, attributeName, defaultValue) => {
    return node.attributes.getNamedItem(attributeName)?.value ?? defaultValue
  }

  exports.convertXpathFromTEItoHTML = (xpath, signIdx=null) => {
    // Convert the xpath from annotaion to TEI token 
    // into        xpath                to HTML token and sign
    //
    // //tei:body/tei:div[@type='edition'][not(@subtype) or @subtype='transcription']//*[name()!='l'][name()!='lg'][name()!='lb'][name()!='cb'][name()!='milestone'][not(@type='textpart')][@n='5']
    // becomes
    // //*[@data-tei!='l'][@data-tei!='lg'][@data-tei!='lb'][@data-tei!='cb'][@data-tei!='milestone'][not(@data-tei-type='textpart')][@data-tei-n='5']//*[@data-idx-w='0']
    xpath = xpath.replace(/^.*\/\/\*/, '//*')
    xpath = xpath.replace(/\bxml:/, '')
    xpath = xpath.replace(/@(\w+)/g, '@data-tei-$1')
    xpath = xpath.replaceAll('name()', '@data-tei')
    if (parseInt(signIdx, 10) > -1) {
      xpath += `//*[@data-idx-n='${signIdx}']`
    }
    return xpath
  }

  exports.getCSSSelectorFromXpath = (xpath) => {
    // Converts a html xpath to css selector
    // e.g. //*[@n='10'] => [n='10']
    // "//*[@data-tei!='l'][@data-tei!='lg'][@data-tei!='lb'][@data-tei!='cb'][@data-tei!='milestone'][not(@data-tei-type='textpart')][@data-tei-n='10']//*[@data-idx-n='null']"
    // =>
    // "*:not([data-tei='l']):not([data-tei='lg']):not([data-tei='lb']):not([data-tei='cb']):not([data-tei='milestone']):not([data-tei-type='textpart'])[data-tei-n='10'] *[data-idx-n='null']"
    let ret = xpath
    ret = ret.replace(/^\/\//, '').replaceAll('@', '').replace(/\[(.*?)!=(.*?)\]/g, ':not([$1=$2])').replace(/\[not\((.*?)\)\]/g, ':not([$1])').replaceAll('//', ' ')
    // throw Error('getCSSSelectorFromXpath not implemented')
    return ret
  }

};

export let xmlUtils = {}
await mod(xmlUtils)
