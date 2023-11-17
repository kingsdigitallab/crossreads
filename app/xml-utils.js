(function (exports) {

  // true if this code is running in the browser
  const isBrowser = (typeof window !== "undefined");
  const SaxonJS = isBrowser ? window.SaxonJS : require('saxon-js');
  const fs = isBrowser ? null : require('fs');
  const utils = isBrowser ? window.utils : require("./utils");

  exports.removeNamespaces = function(xmlString) {
    return xmlString.replace(/\s*xmlns(:\w+)?="[^"]*"/g, "")
  }

  exports.xslt = function(xml, xsltPath, isOuputHtml=false) {
    let ret = null

    if (!xml) return ret;

    let transformJsonPath = writeTransformJson(xsltPath, isOuputHtml)

    // https://www.saxonica.com/saxon-js/documentation2/index.html#!api/transform

    let options = {
      // sourceFileName: docPath,
      // destination: "serialized",
      destination: "document",
      outputProperties: {
        method: isOuputHtml ? 'html' : 'xml',
        indent: true,
      }
    }

    if (isBrowser) {
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

    // if (isOuputHtml) {
    //   // remove all namespaces
    //   ret = ret.replace(/\s*xmlns(:\w+)?="[^"]*"/g, "");
    // }

    return ret
  }

  function writeTransformJson(xsltPath, isOuputHtml=false) {
    let ret = xsltPath.replace(/\.xslt?$/, '.sef.json')
    if (!isBrowser) {
      if (!fs.existsSync(xsltPath)) {
        throw new Error(`Transform file not found: ${xsltPath}`)
      }
      if (getFileModifiedTime(ret) < getFileModifiedTime(xsltPath)) {
        utils.exec(`npx xslt3 -xsl:${xsltPath} -export:${ret} -t -ns:##html5 -nogo`)
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
  exports.xpath = function(xml, xpath, namespaces) {
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

  exports.toString = function(xml, keepNamespaces=false) {
    let ret = SaxonJS.serialize(xml, {
      method: 'xml',
      indent: true,
      "omit-xml-declaration": true
    })
    if (!keepNamespaces) {
      ret = ret.replace(/\s*xmlns(:\w+)?="[^"]*"/g, '')
    }
    return ret
  }

  exports.fromString = async function(xmlString) {
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
      if (isBrowser) {
        options.location = xmlString
      } else {
        options.file = xmlString
      }
    }
    return await SaxonJS.getResource(options)
  }

})(typeof exports === "undefined" ? (this["xmlUtils"] = {}) : exports);
