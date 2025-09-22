// This module can be imported from the browser or nodejs
// https://stackoverflow.com/questions/950087/how-do-i-include-a-javascript-file-in-another-javascript-file

export const IS_BROWSER = (typeof window !== "undefined")
export const IS_BROWSER_LOCAL = IS_BROWSER && (window.location.hostname === 'localhost')
// export const DEBUG_DONT_SAVE = false;
// export const DEBUG_DONT_SAVE = true;
export const DEBUG_DONT_SAVE = IS_BROWSER_LOCAL;

export const FILE_PATHS = {
  DTS_COLLECTION: 'app/data/2023-08/collection.json',
  DEFINITIONS: 'app/data/pal/definitions-digipal.json',
  VARIANT_RULES: 'app/data/variant-rules.json',
  // CHANGE_QUEUE: 'annotations/change-queue.json',
  CHANGE_QUEUE: 'app/data/change-queue.json',
  // TODO: move them under data folder
  INDEX: 'app/index.json',
  ANNOTATIONS_ISSUES: 'app/data/annotations-issues.json',
  INDEX_COLLECTION: 'app/data/index-collection.json',
  STATS: 'app/stats.json',
  THUMBS: 'app/data/thumbs',
  THUMBS_ALL: 'app/data/thumbs/thumbs.json',
  ANNOTATIONS: 'annotations',
}

// TODO: move all hard-coded literals in the code base to this SETTINGS dictionary
export const SETTINGS = {
  // TODO: search this string & replace everywhere
  GITHUB_REPO_PATH: 'kingsdigitallab/crossreads',
  // if you change this you'll need to empty the content of the app/data/thumbs folder
  // then re-run tools/index.mjs to obtain the new sizes
  EXEMPLAR_THUMB_HEIGHT: 150,
  APPLICATION_TABS: [
    {title: 'Annotator', key: 'annotator'},
    {title: 'Definitions', key: 'definitions'},
    {title: 'Search', key: 'search'},
    {title: 'Lab', key: 'lab'},
    {title: 'Settings', key: 'settings'},
  ],
  BROWSER_STORAGE_INSCRIPTION_SETS: 'inscriptionSets',
  CORPUS_BUILDING_INSCRIPTION_URL: 'https://kingsdigitallab.github.io/corpus-building/inscription/{docId}',
  // Corresponds to {scheme}://{server}{/prefix} in IIIF Image API
  // IIIF_SERVER_BASE: 'https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=',
  IIIF_SERVER_BASE: 'http://localhost:4000/images',
  // todo: we shouldn't hard-code the _tiled.tif
  IIIF_SERVER_OBJ_ID: '/inscription_images/{DOCID}/{IMGID}_tiled.tif',
}
SETTINGS.GITHUB_REPO_URL = `https://github.com/${SETTINGS.GITHUB_REPO_PATH}`

// Absolute filesystem path to the code base root folder.
// null if called from browser.
export let ROOT_PATH = null

async function mod(exports) {

  let fs = null
  if (!IS_BROWSER) {
    fs = (await import('fs'))
    let url = (await import('url'))
    let path = (await import('path'))

    const __filename = url.fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    ROOT_PATH = path.resolve(__dirname, '..')
  }

  exports.slugify = (str) => str.replace(/\W+/g, '-').replace(/^-+/, '').replace(/-+$/, '').toLowerCase()

  exports.capitaliseWords = (str) => str.replace(/(\b\w)/g, m => m.toUpperCase())

  exports.getGitUrlTo = (file_key, isRaw=false) => {
    // Returns a URL on github to the key of a file from FILE_PATHS
    // e.g. 'CHANGE_QUEUE' => 
    // https://github.com/kingsdigitallab/crossreads/blob/main/annotations/change-queue.json
    let ret = ''
    if (isRaw) {
      // https://raw.githubusercontent.com/kingsdigitallab/crossreads/refs/heads/main/app/data/change-queue.json
      ret = `https://raw.githubusercontent.com/${SETTINGS.GITHUB_REPO_PATH}/refs/heads/main/${FILE_PATHS[file_key]}`
    } else {
      // https://github.com/kingsdigitallab/crossreads/blob/main/annotations/change-queue.json
      ret = `${SETTINGS.GITHUB_REPO_URL}/blob/main/${FILE_PATHS[file_key]}`
    }
    return ret
  }

  exports.getCssVar = (varName, defaultValue=null) => {
    let ret = window.getComputedStyle(document.documentElement).getPropertyValue(`--${varName}`) 
    if (ret === null) {
      ret = defaultValue
      console.log(`WARNING: getCssVar(${varName}), css variable is not defined`)
    }
    return ret
  }

  exports.clipDateRange = (range, clipUnit) => {
    // returns a new range that contains `range` and is clipped to the nearest multiple of `clipUnit`
    // E.g. clipDateRange([275, 375], 50) will return [250, 400]
    const start = Math.floor(range[0] / clipUnit) * clipUnit;
    const end = Math.ceil(range[1] / clipUnit) * clipUnit;
    return [start, end];
  }

  exports.getDisplayDateRange = (range) => {
    // [-100, 150] => 'between 100 BC and 150 AD'
    let correctedRange = range
    if (range[0] > range[1]) correctedRange = [range[1], range[0]]
    return 'between ' + correctedRange.map(d => d >= 0 ? `AD ${d}` : `${-d} BC`).join(' and ')
  }

  exports.getLabelFromDefinition = (itemKey, itemType, definitions) => {
      // TODO: cache the responses
    let ret = itemKey

    if (definitions) {
      if (itemType === 'fea') {
        ret = definitions.features[itemKey] ?? ret
      }
      if (itemType === 'com') {
        ret = definitions.components[itemKey]?.name ?? ret
      }
      if (itemType === 'scr') {
        ret = definitions.scripts[itemKey] ?? ret
      }
      if (itemType === 'cxf') {
        let parts = itemKey.split(' is ')
        if (parts.length === 2) {
          ret = exports.getLabelFromDefinition(parts[0], 'com', definitions) + ' is ' + exports.getLabelFromDefinition(parts[1], 'fea', definitions)
        }
      }
    }

    return ret
  }
  
  exports.setQueryString = (parameters, defaults={}) => {
    // TODO: try URLSearchParams.toString() instead.
    let newRelativePathQuery = window.location.pathname
    const qsKeys = Object.keys(parameters)
    let qs = ''
    if (qsKeys.length) {
      for (const k of qsKeys) {
        const defaultValue = defaults[k] ?? ''
        const valueStr = `${parameters[k]}`.trim()
        if (valueStr !== defaultValue) {
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

  exports.tabs = () => SETTINGS.APPLICATION_TABS

  exports.initFillHeightElements = () => {
    for (const element of document.querySelectorAll('.responsive-height')) {
      // dislay the element so getBoundingClientRect() returns something
      element.style.display = '';
      let elementY = element.getBoundingClientRect().top;
      let minHeight = 0;
      let marginBottom = 12;
      // let elementY = element.offsetTop;
      // let height = (window.innerHeight - elementY + window.scrollY - 15)
      let height = (window.innerHeight - elementY - marginBottom)
      if (height < minHeight) {
        height = minHeight
      }
      element.style.height = `${height}px`;

      // padding may be incompressible
      // which causes the element to be > minHeight
      element.style.display = (element.clientHeight > height) ? 'none' : '';
    }
  }

  exports.exec = async (command) => {
    // TODO: test
    // const {execSync} = require('child_process')
    const child_process = (await import('child_process'));
    return child_process.execSync(command)
  }

  // --------------------------------------------
  // FILE SYSTEM
  // --------------------------------------------

  exports.fetchJsonFile = async (path) => {
    let ret = null
    const res = await fetch(path);
    if (res && res.status === 200) {
      ret = await res.json();
    }
    return ret
  }

  exports.resolveFilePathFromFileKey = (fileKeyOrPath) => {
    // Looks up fileKeyOrPath in FILE_PATHS and returns the absolute path.
    // If looks up fails, returns fileKeyOrPath.
    let ret = fileKeyOrPath
    if (ROOT_PATH) {
      let path = FILE_PATHS[fileKeyOrPath]
      if (path) {
        // TODO: use path.join() instead
        ret = ROOT_PATH + '/' + path
      } else {
        if (fileKeyOrPath === fileKeyOrPath.toUpperCase()) {
          throw Error(`${fileKeyOrPath} is not a valid key in utils.FILE_PATHS`)
        }
      }
    }
    return ret
  }

  exports.readJsonFile = (path) => {
    let ret = null
    path = exports.resolveFilePathFromFileKey(path)
    if (fs.existsSync(path)) {
      const content = fs.readFileSync(path, {encoding:'utf8', flag:'r'})
      ret = JSON.parse(content)
    }
    return ret
  }

  exports.writeJsonFile = (path, content, description=null) => {
    path = exports.resolveFilePathFromFileKey(path)
    const contentJson = JSON.stringify(content, null, 2)
    fs.writeFileSync(path, contentJson)
    if (description !== null) {
      console.log(`WRITTEN ${path}, ${description}, ${(contentJson.length / 1024 / 1024).toFixed(2)} MB.`)
    }
  }

  exports.sortMulti = (arr, fields) => arr.sort((a, b) => {
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (a[field] < b[field]) return -1;
        if (a[field] > b[field]) return 1;
      }
      return 0; // equal
    })

  exports.getScriptFromCharacter = (character, definitions) => {
    let ret = null

    for (const [key, allo] of Object.entries(definitions.allographs)) {
      if (allo.character === character) {
        ret = allo.script
        break;
      }
    }

    if (!ret) {
      console.log(`WARNING: used unicode to find script from character (${character}). Not found in the definitions.`)
      ret = exports.getScriptFromUnicode(character) + '-1'
    }
    
    return ret
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

  exports.getGraphemeFromCharacter = (character) => {
    // e.g. Ω1+2 => Ω
    let ret = character

    ret = ret.replace(/^(\D+).*$/, '$1')

    return ret
  }

  exports.getDocIdFromString = (str, withCase=false) => {
    // Returns the first occurrence of 'isic123456' found in str.
    // '' if none found.
    // Examples:
    // 'http://sicily.classics.ox.ac.uk/inscription/ISic020317.xml' => 'ISic020317'
    // 'https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=/inscription_images/ISic020313/ISic020313_tiled.tif' => 'ISic020313'
    let ret = ''

    const matches = str.match(/\bisic\d{6,}\b/i);
    if (matches) {
      ret = matches[0].toLowerCase()
      if (withCase) {
        ret = ret.replace('isic', 'ISic')
      }
    }

    return ret
  }

  exports.getAlloTypesFromAnnotations = (annotations, variantRules) => {
    // Return the rules which match at least one of the annotations
    // Don't return rules without matches.
    // The output should be a list of rules.
    // Each rule should have a 'inscriptions' key, 
    // which value is a map between inscription code and the number of matches.
    const ret = []

    let found = {}

    for (const annotation of annotations) {
      const body = annotation?.body
      if (!body) continue;
      const value = body[0]?.value
      if (!value) continue;
      const components = value.components
      if (!components) continue;
      
      for (const atype of variantRules) {
        let match = false

        if (atype.allograph === value?.character && atype.script === value.script) {
          match = true
          for (const cf of atype['component-features']) {
            if (!components[cf.component]?.features?.includes(cf.feature)) {
              match = false;
              break;
            }
          }
        }
        if (match) {
          let tk = `${atype.script}-${atype.allograph}-${atype['variant-name']}`
          if (!found[tk]) {            
            ret.push(atype)
            // break
            found[tk] = 1
          }
        }
      }
    }

    ret.sort((a,b) => {
      // todo; natural sort as vairant-name can contain numbers 
      const k1 = `${a.allograph}-${a['variant-name']}`
      const k2 = `${b.allograph}-${b['variant-name']}`
      
      return k1.localeCompare(k2)
    })

    return ret
  }

  exports.getTEIfromAlloTypes = (types) => {
    let typesTEI = ''

    for (const atype of types) {
      typesTEI += `\n  <ref target="${exports.getURLFromAlloType(atype)}">${atype.allograph} ${atype['variant-name']}</ref>`
    }

    let ret = ''
    
    if (typesTEI) {
      ret = `<p>\n  Types list:${typesTEI}\n</p>`
    }

    return ret
  }

  exports.getURLFromAlloType = (atype, prefix=null) => {
    const baseUrl = prefix || 'https://kingsdigitallab.github.io/crossreads/'
    return `${baseUrl}data/allographs/types/${atype.script}-${atype.allograph}-${atype['variant-name']}.html`
  }

  exports.fetchFile = async (url, filePath) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    return filePath;
  }

  // --------------------------------------------

  if (IS_BROWSER) {
    window.addEventListener("resize", exports.initFillHeightElements);
    document.addEventListener("scroll", exports.initFillHeightElements);
    window.addEventListener("load", (event) => {
      exports.initFillHeightElements();
      setTimeout(() => {
        exports.initFillHeightElements();
      }, 1500)
    });
  }
}

export const utils = {}
await mod(utils)
