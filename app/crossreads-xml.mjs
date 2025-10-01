import { ROOT_PATH, IS_BROWSER} from './utils.mjs'
import { xmlUtils } from './xml-utils.mjs'

async function mod(exports) {

  let TEI2HTML_XSLT = 'data/tei2html.xslt'
  let HTML2HTML_XSLT = 'data/html2html.xslt'
  if (!IS_BROWSER) {
    TEI2HTML_XSLT = `${ROOT_PATH}/app/${TEI2HTML_XSLT}`
    HTML2HTML_XSLT = `${ROOT_PATH}/app/${HTML2HTML_XSLT}`
  }

  exports.getHtmlFromTei = async function(xmlString) {
    // Remove diacritic, b/c 
    // a) XSLT template to markup each sign splits combined marks / modifier
    // b) partners requested they are hidden in annotator text viewer (because they are editorially supplied)
    // c) more complex to map to characters in the palaeographic definitions
    // Example, see 1408 and https://github.com/kingsdigitallab/crossreads/issues/37
    // https://raw.githubusercontent.com/ISicily/ISicily/master/inscriptions/ISic001408.xml
    // έο̄ς
    // 
    xmlString = xmlString.normalize("NFD")
    // But:
    // this removes non-combining marks as well, such as punctuation (ductus elevatus? middle dot) <g>
    // <g ref="#interpunct">·</g>
    // DONT USE THIS: it will remove non-diacritics, like &#183; (middle dot)
    // xmlString = xmlString.replace(/\p{Diacritic}/gu, "")
    xmlString = xmlString.replace(/[\u0300-\u036f]/gu, "")

    // Remove spaces around <lb break="no">
    // TODO: try to do it with XSLT? (too fiddly)
    xmlString = xmlString.replace(/\s*(<lb[^>]+break="no"[^>]*>)\s*/g, '$1')

    let ret = await xmlUtils.xslt(xmlString, TEI2HTML_XSLT)

    // assign the @data-idx sequentially relative to each .is-word
    ret = await xmlUtils.xslt(ret, HTML2HTML_XSLT)
    // console.log(xmlUtils.toString(ret))

    return ret
  }

}

export let crossreadsXML = {}
await mod(crossreadsXML)

