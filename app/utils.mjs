// This module can be imported from the browser or nodejs
// https://stackoverflow.com/questions/950087/how-do-i-include-a-javascript-file-in-another-javascript-file

export const IS_BROWSER = (typeof window !== "undefined")
export const IS_BROWSER_LOCAL = IS_BROWSER && (window.location.hostname === 'localhost')
export const DEBUG_DONT_SAVE = false;
// export const DEBUG_DONT_SAVE = true;
// export const DEBUG_DONT_SAVE = IS_BROWSER;

async function mod(exports) {

  let fs = null
  if (!IS_BROWSER) {
    fs = (await import('fs'));
  }

  exports.slugify = (str) => str.replace(/\W+/g, '-').toLowerCase()

  exports.setQueryString = (parameters, defaults={}) => {
    // TODO: try URLSearchParams.toString() instead.
    let newRelativePathQuery = window.location.pathname
    let qsKeys = Object.keys(parameters)
    let qs = ''
    if (qsKeys.length) {
      for (let k of qsKeys) {
        let defaultValue = defaults[k] ?? ''
        let valueStr = `${parameters[k]}`.trim()
        if (valueStr != defaultValue) {
          if (qs) qs += '&';
          qs += `${k}=${encodeURIComponent(valueStr)}`
        }
      }
      if (qs) {
        qs = `?${qs}`
        newRelativePathQuery += qs
      }
    }
    history.pushState(null, "", newRelativePathQuery);
    return qs
  }

  exports.getQueryString = () => {
    // returns query string, starting with ?
    return window.location.search
  }

  exports.tabs = () => [
      {title: 'Annotator', key: 'annotator'},
      {title: 'Definitions', key: 'definitions'},
      {title: 'Search', key: 'search'},
      {title: 'Settings', key: 'settings'},
    ]

  function initFillHeightElements() {
    for (let element of document.querySelectorAll('.responsive-height')) {
      let height = (window.innerHeight - element.offsetTop + window.scrollY - 15)
      if (height < 10) {
        height = 10
      }
      element.style.height = `${height}px`;
      // console.log(element.style.height)
    }
  }

  exports.exec = async (command) => {
    // TODO: test
    // const {execSync} = require('child_process')
    let child_process = (await import('child_process'));
    return child_process.execSync(command)
  }

  // --------------------------------------------
  // FILE SYSTEM
  // --------------------------------------------

  exports.fetchJsonFile = async (path) => {
    let ret = null
    let res = await fetch(path);
    if (res && res.status === 200) {
      ret = await res.json();
    }
    return ret
  }

  exports.readJsonFile = (path) => {
    let ret = null
    if (fs.existsSync(path)) {
      let content = fs.readFileSync(path, {encoding:'utf8', flag:'r'})
      ret = JSON.parse(content)
    }
    return ret
  }

  exports.writeJsonFile = (path, content) => {
    content = JSON.stringify(content, null, 2)
    fs.writeFileSync(path, content)
  }

  exports.sortMulti = (arr, fields) => arr.sort((a, b) => {
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (a[field] < b[field]) return -1;
        if (a[field] > b[field]) return 1;
      }
      return 0; // equal
    })

  exports.getScriptFromAllograph = (allograph, definitions) => {
    // TODO
    let ret = null
    
    return ret ? ret.script : '?'
  }

  /**
   * Returns the script of a Unicode character.
   *
   * @param {string} char - The Unicode character to get the script for.
   * @returns {string} The script of the character, either "latin", "greek", or an empty string if the character is not in a known script.
   */
  exports.getScriptFromUnicode = (char) => {
    let ret = ''

    if (char.length !== 1) {
      return ret
    }

    const charCode = char.charCodeAt(0);

    // Latin script ranges
    if (
        (charCode >= 0x0041 && charCode <= 0x007A) || // Basic Latin
        (charCode >= 0x00C0 && charCode <= 0x02FF) || // Latin-1 Supplement, Latin Extended-A, etc.
        (charCode >= 0x1E00 && charCode <= 0x1FFF) || // Phonetic Extensions, Latin Extended-C, etc.
        (charCode >= 0x2C60 && charCode <= 0x2C7F) || // Latin Extended-D
        (charCode >= 0xA720 && charCode <= 0xA7FF) || // Supplemental Latin-1
        (charCode >= 0xFB00 && charCode <= 0xFB06)    // Alphabetic Presentation Forms
    ) {
        ret = "latin";
    }

    // Greek script ranges
    if (
        (charCode >= 0x0370 && charCode <= 0x03FF) || // Greek and Coptic
        (charCode >= 0x1F00 && charCode <= 0x1FFF)   // Greek Extended
    ) {
        ret = "greek";
    }

    return ret
  }

  exports.getDocIdFromString = (str) => {
    // Returns the first occurrence of 'isic123456' found in str.
    // '' if none found.
    // Examples:
    // 'http://sicily.classics.ox.ac.uk/inscription/ISic020317.xml' => 'ISic020317'
    // 'https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=/inscription_images/ISic020313/ISic020313_tiled.tif' => 'ISic020313'
    let ret = ''

    let matches = str.match(/\bisic\d{6,}\b/i);
    if (matches) {
      ret = matches[0].toLowerCase()
    }

    return ret
  }

  exports.getAlloTypesFromAnnotations = (annotations, variantRules) => {
    // Return the number of annotations matching each rule.
    // Don't return rules without matches.
    // The output should be a list of rules.
    // Each rule should have a 'inscriptions' key, 
    // which value is a map between inscription code and the number of matches.
    let ret = []

    for (let atype of variantRules) {
      for (let annotation of annotations) {
        let body = annotation?.body
        if (!body) continue;
        let value = body[0]?.value
        if (!value) continue;
        let components = value.components
        if (!components) continue;
      
        // TODO: check script once it has been added to variant-rules
        if (atype.allograph === value?.character) {
          let match = true
          for (let cf of atype['component-features']) {
            if (!components[cf.component]?.features?.includes(cf.feature)) {
              match = false;
              break;
            }
          }
          if (match) {
            ret.push(atype)
            break
          }
        }
      }
    }

    ret.sort((a,b) => {
      // todo; natural sort as vairant-name can contain numbers 
      let k1 = `${a.allograph}-${a['variant-name']}`
      let k2 = `${a.allograph}-${a['variant-name']}`
      
      return k1.localeCompare(k2)
    })

    return ret
  }

  exports.getTEIfromAlloTypes = (types) => {
    let typesTEI = ''

    for (let atype of types) {
      typesTEI += `\n  <ref target="${exports.getURLFromAlloType(atype)}">${atype.allograph} ${atype['variant-name']}</ref>`
    }

    let ret = ''
    
    if (typesTEI) {
      ret = `<p>\n  Types list:${typesTEI}\n</p>`
    }

    return ret
  }

  exports.getURLFromAlloType = (atype, prefix=null) => {
    prefix = prefix || 'https://kingsdigitallab.github.io/crossreads/'
    let script = exports.getScriptFromUnicode(atype.allograph) + '-1'
    return `${prefix}data/allographs/types/${script}-${atype.allograph}-${atype['variant-name']}.html`
  }

  // --------------------------------------------

  if (IS_BROWSER) {
    window.addEventListener("resize", initFillHeightElements);
    document.addEventListener("scroll", initFillHeightElements);
    window.addEventListener("load", (event) => {
      initFillHeightElements();
    });
  }
}

export let utils = {}
await mod(utils)
