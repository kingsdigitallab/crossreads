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
    // a) some erroneously come out as single text() character in the XSLT
    // b) partners requested they are hidden in annotator text viewer
    // c) more complex to map to characters in the palaeographic definitions
    xmlString = xmlString.normalize("NFD").replace(/\p{Diacritic}/gu, "")

    let ret = xmlUtils.xslt(xmlString, TEI2HTML_XSLT, true)

    // assign the @data-idx sequentially relative to each .is-word
    ret = xmlUtils.xslt(ret, HTML2HTML_XSLT, true)

    return ret
  }

})(typeof exports === "undefined" ? (this["crossreadsXML"] = {}) : exports);
