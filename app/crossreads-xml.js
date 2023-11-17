(function (exports) {

  // true if this code is running in the browser
  const isBrowser = (typeof window !== "undefined");
  // const SaxonJS = isBrowser ? window.SaxonJS : require('saxon-js');
  // const fs = isBrowser ? null : require('fs');
  const xmlUtils = isBrowser ? window.xmlUtils : require("./xml-utils");

  let TEI2HTML_XSLT = 'data/tei2html.xslt'
  let HTML2HTML_XSLT = 'data/html2html.xslt'
  if (!isBrowser) {
    TEI2HTML_XSLT = `../app/${TEI2HTML_XSLT}`
    HTML2HTML_XSLT = `../app/${HTML2HTML_XSLT}`
  }

  exports.getHtmlFromTei = function(xmlString) {
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

    let ret = xmlUtils.xslt(xmlString, TEI2HTML_XSLT, true)

    // assign the @data-idx sequentially relative to each .is-word
    ret = xmlUtils.xslt(ret, HTML2HTML_XSLT, true)

    return ret
  }

})(typeof exports === "undefined" ? (this["crossreadsXML"] = {}) : exports);
