/* 
An annotation is stored in various places:

1. github (in W3C standard format)
2. Annotorious (in Annotorious and Annotator friendly format)
  2.a annotorious working area (e.g. DOM & selection/shapes)
  2.b annotorious annotations set (e.g. getAnnotations)
  (Note that a shape is promoted to an annotation)
3. Annotator (reactive Vue data)
  3.a .annotation: READ-ONLY pointer to annotorious selected annotation, used as bool (this is mainly used to test if there's a selection)
  3.b .description: the script, allograph, component-feature and the textTarget (pointer to the sign in the TEI) of an annotation
    That description is reactive and linked to the UI.
    It is copied back into annotorious annotation model by action-related events.
    (script + allograph + CF) -> body of the annotation
    (textTarget) -> body of the annotation (and then target when converted into W3C format)

It's advised to familiarise yourself with Annotorious events.

https://annotorious.github.io/api-docs/osd-plugin/

Unfortunately the code is more complicated than needed 
and contains some tricks to work around 
the way Annotorious manages the cascade of annotation editing events.

TODO:
* Create an Annotation class and move the data manipulation methods there

*/

let IMG_PATH_STATIC_ROOT = './data/images/'

// if IMG_PATH_IIIF_ROOT defined, the viewer will fetch full image files instead of IIIF tiles
// Local IIIF server
// let IMG_PATH_IIIF_ROOT = 'http://localhost:49153/iiif/2/'
// Crossreads live IIIF server
// https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=/inscription_images/ISic000001/ISic000001_tiled.tif/info.json
let IMG_PATH_IIIF_ROOT = 'https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=/inscription_images/{DOCID}/{IMGID}_tiled.tif/info.json'
// IIIF server via local proxy to avoid CORS blockage
// let IMG_PATH_IIIF_ROOT = 'http://localhost:8088/https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=/inscription_images/{DOCID}/{IMGID}_tiled.tif/info.json'

const ANNOTATION_FORMAT_VERSION = '2023-09-01-00'
const ANNOTATION_URI_PREFIX = 'https://crossreads.web.ox.ac.uk/annotations/'
const ANNOTATION_GENERATOR_URI = `https://github.com/kingsdigitallab/crossreads#${ANNOTATION_FORMAT_VERSION}`
const DEFINITIONS_PATH = 'app/data/pal/definitions-digipal.json'
// const DTS_COLLECTION_PATH = './data/2023-01/collection.json'
const DTS_COLLECTION_PATH = './data/2023-08/collection.json'
const OPENSEADRAGON_IMAGE_URL_PREFIX = './node_modules/openseadragon/build/openseadragon/images/'
const TEI_TO_HTML_XSLT_PATH = './data/tei2html.xslt'
const HTML_TO_HTML_XSLT_PATH = './data/html2html.xslt'
const DTS_ROOT = 'https://crossreads.web.ox.ac.uk'
// -1: never; 10000: check every 10 secs
const AUTO_SAVE_EVERY_MILLISEC = 10000
const LOG_EVENTS = false;

// const collectionPath = './data/dts/api/collections.json'
// const DEBUG_DONT_SAVE = true;
const DEBUG_DONT_SAVE = false;

let isButtonPressed = false
function logButtons(e) {
  isButtonPressed = e.buttons == 1
}
document.addEventListener('mouseup', logButtons);
document.addEventListener('mousedown', logButtons);

function deepCopy(v) {
  return JSON.parse(JSON.stringify(v))
  // => Uncaught DOMException: Proxy object could not be cloned.
  // return structuredClone(v)
}

class AvailableTags {

  constructor() {
    this.tags = []
  }

  addTag(tag) {
    if (this.tags.includes(tag)) return;
    this.tags.push(tag)
    this.saveToSession()
  }

  load() {
    // TODO: load from github
    // if copy in session is more recent, use that instead
  }

  loadFromSession() {
    this.tags = JSON.parse(window.localStorage.getItem('AvailableTags.tags') || '[]')
  }

  saveToSession() {
    window.localStorage.setItem('AvailableTags.tags', JSON.stringify(this.tags))
  }

}

// TODO: move this into Vue?
function loadOpenSeaDragon(vueApp) {
  var viewer = OpenSeadragon({
    id: "image-viewer",
    prefixUrl: OPENSEADRAGON_IMAGE_URL_PREFIX,
    tileSources: {
      type: "image",
      url: `${IMG_PATH_STATIC_ROOT}blank.jpg`
    },
    zoomPerClick: 1.0, // disable the zoom on click
  });

  // Initialize the Annotorious plugin
  const config = {
    disableEditor: true,
    allowEmpty: true,
    // disableSelect: true,
    // TODO: js error after select + click outside rect
    // fragmentUnit: 'percent', 
    formatters: vueApp.annotoriousFormatter,
    readOnly: !vueApp.canSave
  };
  var anno = OpenSeadragon.Annotorious(viewer, config);
  vueApp.anno = anno;
  window.anno = anno;
  vueApp.viewer = viewer;
  window.osd = viewer;

  let eventNames = [
    'createSelection', 'createAnnotation', 'updateAnnotation',
    'selectAnnotation', 'cancelSelected', 'clickAnnotation',
    'deleteAnnotation', 'changeSelectionTarget',
    // 'mouseLeaveAnnotation', 'mouseLeaveAnnotation'
  ]
  for (let eventName of eventNames) {
    anno.on(eventName, vueApp[`on${eventName[0].toUpperCase()}${eventName.substring(1)}`]);
  }
  viewer.addHandler('open-failed', vueApp.onImageOpenFailed);
  // setAnnotations() is defered by Annotorious until tiles are loaded.
  // So we wait until it's ready to do things based on getAnnotations().
  viewer.addHandler('open', () => {
    vueApp.onImageLoaded()
  });

};

const { createApp } = Vue

createApp({
  data() {
    return {
      // TODO: not reactive
      apis: {
        // collections: 'https://isicily-dts.herokuapp.com/dts/api/collections/',
        collections: DTS_COLLECTION_PATH,
        definitions: DEFINITIONS_PATH,
      },
      objects: {
        obj1: { 'description': 'Object 1', '@id': 'obj1', 'title': 't1' },
        obj2: { 'description': 'Object 2', '@id': 'obj2', 'title': 't2' },
        obj3: { 'description': 'Object 3', '@id': 'obj3', 'title': 't3' },
      },
      // object: null,
      searchPhrase: '',
      images: {},
      // image: null,
      text: 'test',
      // annotatedText: {
      //   textId: '',
      //   wordId: '',
      //   signId: '',
      // },
      definitions: {
        scripts: {
          'latin': 'Latin',
        },
        features: {
          'f1': 'F 1',
          'f2': 'F 2',
        },
        components: {
          'c1': {
            name: 'C 1',
            features: [
              'f1', 'f2'
            ]
          },
        },
        allographs: {
          'latin.G': {
            script: 'latin',
            character: 'G',
            components: ['c1'],
          },
        }
      },
      description: {
        // TODO: redundant with allograph.
        // We should have either (allograph) or (script, character).
        // (script, character) is probably more resilient and explicit.
        // Also easier for indexing.
        script: 's',
        // this refers to the allograph key; NOT the character key
        allograph: 'a',
        components: {
          'c1': { features: ['f1', 'f3'] },
        },
        // We keep the textTarget inside the description.
        // because Annotorious doesn't support multiple targets.
        textTarget: {
          // TODO: is there a std for this kind of ptr?
          textId: null,
          wordId: null,
          signId: null
        },
        // tags assigned to the selected graph
        tags: ['tag-1', 'tag-2']
      },
      // tag the user is typing
      tag: '',
      // all available tags (for auto-complete)
      tags: ['tag-1', 'tag-2', 'type-1', 'type-3'],
      annotation: null,
      annotationsSha: null,
      cache: {
        isDescriptionLoading: false,
        // allographLast: '123',
        // TODO: not reactive?
        store: {
          imagesAnnotations: {
            'objectkey.imagekey': {
              // annotations for that object-image
            }
          }
        }
      },
      selection: {
        tab: 'annotator',
        showSuppliedText: false,
        gtoken: window.localStorage.getItem('gtoken') || '',
        // TODO: remove partial duplication with /annotation
        annotationId: '',
        object: null,
        image: null,
      },
      isUnsaved: 0,
      // null: no asked; -1: error; 0: loading; 1: loaded
      isImageLoaded: null,
      messages: [
      ],
      queryString: '',
      octokit: null,
      user: null
    }
  },
  async mounted() {
    this.availableTags = new AvailableTags()
    this.availableTags.loadFromSession()
    this.tags = this.availableTags.tags


    // TODO: chain load (from objects, to image, ...) 
    // instead of loading all here.in parallel
    this.setSelectionFromAddressBar()

    await this.initOctokit()

    loadOpenSeaDragon(this)
    this.loadObjects()
    this.loadDefinitions()
    // this.logOk('App loaded')

    if (AUTO_SAVE_EVERY_MILLISEC > 0) {
      setInterval(() => {
        // we don't want to save while the user is changing a box.
        // Because save unselect & reselect the box.
        // This would disrupt the user's operation
        if (!isButtonPressed) {
          this.saveAnnotationsToGithub()
        }
      }, AUTO_SAVE_EVERY_MILLISEC)
    }

    // save annotations before moving to other tab
    for (let tab of document.querySelectorAll('.tabs li a')) {

      tab.addEventListener('click', async (event) => {
        let href = tab.href
        event.preventDefault();
        await this.saveAnnotationsToGithub()
        window.location = href
      })
    }
  },
  watch: {
    async object(val, valOld) {
      if (valOld == val) return;
      if (valOld) {
        await this.saveAnnotationsToGithub()
      }
      this.fetchObjectXML()
      this.searchPhrase = val.title
    },
    async searchPhrase(val, valOld) {
      if (valOld == val) return;

      for (let obj of Object.values(this.objects)) {
        if (obj.title == val) {
          this.object = obj
        }
      }
    },
    'selection.showSuppliedText'() {
      this.setAddressBarFromSelection()
    },
  },
  computed: {
    filteredObjects() {
      return this.objects
    },
    filteredObjectTitles() {
      return Object.values(this.filteredObjects).map(obj => obj.title)
    },
    filteredImages() {
      let ret = []
      for (let k of Object.keys(this.images)) {
        let o = this.images[k]
        if (o.type == 'print') {
          ret.push(o)
        }
      }
      return ret
      // return this.images.filter(i => i.type == 'print')
    },
    filteredScripts() {
      let ret = {}
      let scriptKeys = Object.keys(this.definitions.scripts)
      scriptKeys = scriptKeys.sort((a, b) => {
        a = this.definitions.scripts[a]
        b = this.definitions.scripts[b]
        return a === b ? 0 : (a > b ? 1 : -1);
      })
      for (let scriptKey of scriptKeys) {
        if (scriptKey != 'base') {
          ret[scriptKey] = this.definitions.scripts[scriptKey]
        }
      }
      return ret
    },
    filteredAllographs() {
      let ret = {}
      let script = this.description.script

      // 1. sort the allograph by (chararcter, script)
      // where script = 1 if base, 0 otherwise
      // So A0 comes before A1 (base)
      let allographKeys = Object.keys(this.definitions.allographs)
      let get_sort_key_from_allograph_key = (akey) => {
        let allograph = this.definitions.allographs[akey]
        return (allograph.character) + (allograph.script == 'base' ? '1' : '0')
      };
      allographKeys.sort((a, b) => {
        a = get_sort_key_from_allograph_key(a)
        b = get_sort_key_from_allograph_key(b)
        return (a === b ? 0 : (a > b ? 1 : -1));
      })

      let last_character = null
      if (script && script != 'base' && this.definitions.scripts[script]) {
        for (let allographKey of allographKeys) {
          let allograph = this.definitions.allographs[allographKey]
          // don't add the base allograph if that charcter has already been added for specific script
          if (allograph.script === 'base' || allograph.script === script) {
            if (allograph.character !== last_character) {
              ret[allographKey] = allograph
              last_character = allograph.character
            }
          }
        }
      }
      return ret
    },
    selectedAllographDefinition() {
      // returns the definition of the Allograph currently selected in the UI
      return this.definitions.allographs[this.description.allograph]
    },
    filteredComponents() {
      // Returns a dictionary with all possible components & features 
      // for the selected Allograph.
      // returns {C1: [F1, F2], C2: [F3, F4, F5]}
      // They are extracted from the definitions.
      // And also contain ghost Components.
      let ret = {}
      let selectedAllographDefinition = this.selectedAllographDefinition
      if (selectedAllographDefinition) {
        for (let componentKey of selectedAllographDefinition.components) {
          ret[componentKey] = this.definitions.components[componentKey]
        }
      }
      // add ghost components
      // A component with features selected for this annotation/graph
      // but that component is not defined for that allograph.
      // Possible cause: change the allograph or removed a component from its definition.
      for (let componentKey of Object.keys(this.description?.components || {})) {
        if (!selectedAllographDefinition || !selectedAllographDefinition.components.includes(componentKey)) {
          ret[componentKey] = deepCopy(this.description.components[componentKey])
          ret[componentKey].isUndefined = true
        }
      }

      return ret
    },
    isAnnotationSelected() {
      return !!this.annotation
    },
    tabs: () => utils.tabs(),
    canSave() {
      // return !!this.selection.gtoken
      return (this.isImageLoaded == 1) && this.isLoggedIn
    },
    isLoggedIn() {
      return (this.getOctokit() !== null)
    },
    lastMessage() {
      let ret = {
        content: '',
        level: 'info',
        created: new Date()
      }
      if (this.messages.length) {
        ret = this.messages[this.messages.length - 1]
      }
      return ret
    },
    object: {
      get() {
        return this.objects[this.selection.object] || null
      },
      async set(newValue) {
        this.clearMessages()
        await this.saveAnnotationsToGithub()
        this.selection.object = newValue ? newValue['@id'] : null
      }
    },
    objectDtsPassage() {
      return this.object['dts:passage'] || null
    },
    objectDtsURL() {
      return this.object["dts:download"] || null
    },
    image: {
      get() {
        return this.images[this.selection.image] || null
      }, 
      async set(newValue) {
        await this.saveAnnotationsToGithub()
        this.clearDescription()
  
        this.setImageLoadedStatus(0)
        this.selection.image = newValue.uri
        if (newValue) {
          let options = {}
          let imageUrl = this.getImageUrl()
          if (typeof IMG_PATH_IIIF_ROOT !== 'undefined') {
            options = [imageUrl]
          } else {
            options = {
              type: 'image',
              // TODO: temporary static call so app works on github pages without IIIF server
              // http://openseadragon.github.io/examples/tilesource-image/
              url: imageUrl,
            }
          }
          this.viewer.open(options)
        }
        this.setAddressBarFromSelection()
        // now done in the 'open' event to make sure viewer is ready 
        // and anno.getAnnotations() returns something
        // this.loadAnnotationsFromSession()    
      }
    },
    imageLoadingMessage() {
      return (this.isImageLoaded == 1) ? '' : (this.isImageLoaded == -1) ? 'ERROR: could not load the image': 'loading'
    },
    userId() {
      return this?.user?.url || ''
    },
    tagFormatError() {
      let ret = ''
      let tag = (this?.tag || '').trim()
      if (tag) {
        if (!tag.match(/^[a-z0-9.-]+$/)) {
          ret = 'Please only use digits, lowercase alphabet, - and .'
        } else {
          if (!tag.match(/[a-z0-9]$/)) {
            ret = 'Please end with a digit or letter.'
          }
          if (!ret && !tag.match(/^[a-z0-9]/)) {
            ret = 'Please start with a digit or letter.'
          }
          if (!ret && tag.match(/[^a-z0-9]{2}/)) {
            ret = 'Please surround each . or - with letters or digits.'
          }
          if (!ret && (this?.description?.tags || []).includes(tag)) {
            ret = 'This tag is already applied.'
          }
        }
      }
      return ret
    }
  },
  methods: {
    loadObjects() {
      // Load objects list (this.objects) from DTS collections API 
      fetch(this.apis.collections)
        .then(res => res.json())
        .then(res => {
          this.objects = {}
          for (let m of res.member) {
            if (m) {
              this.objects[m['@id']] = {
                '@id': m['@id'],
                title: m.title,
                description: m.description,
                "dts:download": m['dts:download'],
                "dts:passage": m['dts:passage']
              }
            }
          }
          if (Object.keys(this.objects).length) {
            if (!this.objects[this.selection.object]) {
              this.selection.object = this.objects[Object.keys(this.objects)[0]]
            }
          } else {
            this.selection.object = null
          }
        })
    },
    async loadDefinitions() {
      let res = await utils.readGithubJsonFile(DEFINITIONS_PATH, this.getOctokit())
      if (res) {
        this.definitions = res.data
        this.updateDescriptionFromAllograph()
      } else {
        this.logError('Failed to load definitions from github.')
      }
    },
    fetchObjectXML() {
      // fetch the TEI XML from DTS API for the selected object (this.object)
      if (this.object) {
        const uri = this.objectDtsURL
        fetch(uri)
          .then(res => res.text())
          // .then(res => this.getDOMFromTEIString(res))
          .then(async (xmlString) => {
            await this.setImagesFromXMLString(xmlString)
            this.setTextFromXMLString(xmlString)
          })
      }
    },
    getDOMFromTEIString(str) {
      str = str.normalize("NFD").replace(/\p{Diacritic}/gu, "")
      return new window.DOMParser().parseFromString(str, 'text/xml')
    },
    async setImagesFromXMLString(xmlString) {
      // get all the tei:graphic -> image locations
      this.images = {}
      // let it = xml.evaluate('//tei:graphic', xml, this.getURIFromXMLPrefix, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null)
      let xmlObject = await xmlUtils.fromString(xmlString)
      for (let node of xmlUtils.xpath(xmlObject, '//tei:graphic')) {
        // let node = it.iterateNext()
        // if (!node) break
        // TODO: less assumption about encoding, make it more robust 
        let uri = node.attributes['url'].value
        this.images[uri] = {
          description: node.children[0].textContent,
          uri: uri,
          type: node.attributes['n'].value, // screen|print
          surface: node.parentElement.attributes.type.value // front
        }
      }
      let filteredImages = this.filteredImages
      let img = this.image
      if (!img) {
        img = filteredImages ? filteredImages[0] : null
      }
      // this.onSelectImage(img)
      this.image = img
    },
    setTextFromXMLString(xmlString) {
      let res = crossreadsXML.getHtmlFromTei(xmlString)
      this.text = xmlUtils.toString(res)
      console.log(this.text)
      // attach events to each sign
      Vue.nextTick(() => {
        for (let sign of document.querySelectorAll('.sign')) {
          sign.addEventListener('click', (e) => this.onClickSign(sign));
          // sign.addEventListener('mouseenter', (e) => this.onMouseEnterSign(sign));
          // sign.addEventListener('mouseleave', (e) => this.onMouseLeaveSign(sign));
        }
        this.updateSignHighlights()
      })
    },
    setTextFromObjectXML2(xml) {
      // xml (TEI) -> this.text (XHTML)      
      fetch(TEI_TO_HTML_XSLT_PATH)
        .then(res => res.text())
        .then(res => new window.DOMParser().parseFromString(res, 'text/xml'))
        .then(res => {
          let processor = new XSLTProcessor()
          processor.importStylesheet(res)
          let doc = processor.transformToFragment(xml, document)
          // set index of each line, starting from 1
          let lineIdx = 0
          for (let lineNumber of doc.querySelectorAll('.line-number')) {
            lineIdx++;
            lineNumber.innerText = lineIdx
          }
          // set data-idx to each span.sign, relative to its parent span.word
          let signCount = 0
          for (let word of doc.querySelectorAll('span[data-tei-id]')) {
            let signIdx = 0
            for (let sign of word.querySelectorAll('.sign')) {
              sign.attributes.getNamedItem('data-idx').value = signIdx++
              signCount++;
            }
          }
          if (signCount < 1) {
            this.logWarning(`Word ids not found in TEI file ${this.objectDtsURL}.`)
          }
          // to string
          this.text = new XMLSerializer().serializeToString(doc)
          console.log(this.text)
          // attach events to each sign
          Vue.nextTick(() => {
            for (let sign of document.querySelectorAll('.sign')) {
              sign.addEventListener('click', (e) => this.onClickSign(sign));
              // sign.addEventListener('mouseenter', (e) => this.onMouseEnterSign(sign));
              // sign.addEventListener('mouseleave', (e) => this.onMouseLeaveSign(sign));
            }
            this.updateSignHighlights()
          })
        })
    },
    onClickSign(sign) {
      this.logEvent('onClickSign')

      let selectedAnnotation = this.anno.getSelected()
      let signAnnotation = this.getAnnotationFromSign(sign)
      let annotationSign = this.getSignFromAnnotation()
      if (this.canSave) {
        if (sign == annotationSign) {
          // unbind sign from selected annotation
          this.description.textTarget = null
          this.updateSelectedAnnotationFromDescription()
        } else if (selectedAnnotation && !signAnnotation && !annotationSign) {
          // bind sign to selected annotation
          this.description.textTarget = this.getTextTargetFromSign(sign)

          // update the description.allograph if none selected
          if (!this.description.allograph) {
            let allos = [sign.innerText]
            if (allos[0] == allos[0].toUpperCase()) {
              allos.push(allos[0].toLowerCase())
            } else {
              allos.push(allos[0].toUpperCase())
            }
            allosLoop:
            for (let allo of allos) {
              for (let k of Object.keys(this.definitions.allographs)) {
                let allograph = this.definitions.allographs[k] 
                if (allograph.script == this.description.script) {
                  if (allograph.character == allo) {
                    this.description.allograph = k
                    break allosLoop
                  }
                }
              }
            }
          }
          signAnnotation = selectedAnnotation
          this.updateSelectedAnnotationFromDescription()
        }
      }
      this.selectAnnotation(signAnnotation)
    },
    getAnnotationFromSign(sign) {
      let ret = null
      for (let annotation of this.anno.getAnnotations()) {
        let asign = this.getSignFromAnnotation(annotation)
        if (sign == asign) {
          ret = annotation
          break
        }
      }

      return ret
    },
    getTextTargetFromSign(sign) {
      // let word = sign.closest('.tei-w')
      let word = sign.closest('[data-tei-id]')
      return {
        textId: null,
        wordId: word.attributes.getNamedItem('data-tei-id').value,
        signId: sign.attributes.getNamedItem('data-idx').value
      }
    },
    updateSignHighlights() {
      // TODO: optimise... calling this each time something change is ineffective
      for (let sign of document.querySelectorAll('.sign.selected')) {
        sign.classList.remove('selected')
      }
      for (let sign of document.querySelectorAll('.sign.bound')) {
        sign.classList.remove('bound')
      }
      for (let annotation of this.anno.getAnnotations()) {
        let sign = this.getSignFromAnnotation(annotation)
        if (sign) {
          sign.classList.add('bound')
          if (this?.annotation?.id == annotation.id) {
            sign.classList.add('selected')
          }
        }
      }
      this.setAddressBarFromSelection()
    },
    getSignFromAnnotation(annotation = null) {
      let ret = null
      annotation = annotation || this.annotation
      if (annotation?.body?.length) {
        // let description = JSON.parse(annotation.body[0].value)
        let description = annotation.body[0].value
        if (description?.textTarget?.signId) {
          let word = document.querySelector(`[data-tei-id="${description?.textTarget?.wordId}"]`)
          if (word) {
            ret = word.querySelector(`span[data-idx="${description?.textTarget?.signId}"]`)
          }
        }
      }
      return ret
    },
    onMouseEnterSign(sign) {
      // console.log('Mousenter sign')
    },
    onMouseLeaveSign(sign) {
      // console.log('Mouseleave sign')
    },
    onChangeScript() {
      this.setAddressBarFromSelection()
      this.updateSelectedAnnotationFromDescription()
    },
    onChangeAllograph() {
      this.updateDescriptionFromAllograph()
      this.updateSelectedAnnotationFromDescription()
    },
    isComponentFeatureSelected(componentKey, featureKey) {
      let features = (this.description?.components || {})[componentKey]?.features || []
      return features.includes(featureKey)
    },
    onChangeComponentFeature(componentKey, featureKey) {
      let components = this.description?.components
      if (!components) {
        components = {}
        this.description.components = components
      }
      let component = components[componentKey]

      if (this.isComponentFeatureSelected(componentKey, featureKey)) {
        // remove the feature from component
        component.features = component.features.filter(f => f != featureKey)
        if (!component.features.length) {
          // remove component without any selected feature
          delete components[componentKey]
        }
      } else {
        // add component if not present
        if (!component) {
          component = {features: []}
          components[componentKey] = component
        }
        // add feature to component
        component.features.push(featureKey)
      }

      this.updateSelectedAnnotationFromDescription()
    },
    updateSelectedAnnotationFromDescription() {
      // Vue description of the graph -> Annotorious annotation object.
      // Should be called anytime the Vue description is modified.
      let annotation = this.anno.getSelected()
      if (annotation) {
        // annotation.body[0].value = JSON.stringify(this.description)
        annotation.body[0].value = deepCopy(this.description)
        this.anno.updateSelected(annotation)
        this.setUnsaved()
      }
    },
    updateDescriptionFromAllograph() {
    },
    // updateDescriptionFromAllographOld() {
    //   // when user change the allograph 
    //   // => update the list of available C-F in Vue description
    //   let description = this.description
    //   if (1 || description.allograph != this.cache.allographLast) {
    //     this.description.components = []
    //     if (this.definitions.allographs[description.allograph]) {
    //       for (let componentKey of this.definitions.allographs[description.allograph].components) {
    //         let features = {}
    //         for (let featureKey of this.definitions.components[componentKey]?.features || []) {
    //           features[featureKey] = false
    //         }
    //         this.description.components.push([componentKey, features])
    //       }
    //       this.cache.allographLast = description.allograph
    //     }
    //   }
    // },
    // Events - Annotorious
    async onCreateSelection(selection) {
      // Called before onCreateAnnotation
      this.logEvent('onCreateSelection')

      // selection.motivation = 'describing'
      selection.body = [{
        type: 'TextualBody',
        purpose: 'describing',
        format: 'application/json',
        value: deepCopy(this.description)
      }];

      // use this instead of updateSelected & saveSelected()
      // because
      // 1) getAnnotations() wouldn't have teh new body yet
      // 2) user can't draw another box, they have to deselect first
      // This will update the selection, 
      // then save it as an annotation (i.e. type=annotation)
      // then trigger createAnnotation event
      await this.anno.updateSelected(selection, true);
    },
    onCreateAnnotation(annotation, overrideId) {
      // Called after onCreateSelection
      this.logEvent('onCreateAnnotation')

      // this.saveAnnotationsToSession()
      this.setUnsaved(true)

      annotation.generator = ANNOTATION_GENERATOR_URI
      annotation.creator = this.userId
      annotation.created = new Date().toISOString()

      this.selectAnnotation(annotation)
    },
    onMouseEnterAnnotation(annotation, element) {
      // console.log('EVENT onMouseEnterAnnotation')
    },
    onMouseLeaveAnnotation(annotation, element) {
      // console.log('EVENT onMouseLeaveAnnotation')
    },
    onChangeSelectionTarget(target) {
      // triggered each time a selected box changes
      // NOTE that the selected annotation's target is NOT changed yet
      // It will be updated ONLY when deselecting.
      // which can be done with saveSelected().
      // Which in turn calls onUpdateAnnotation().
      this.logEvent('onChangeSelectionTarget')
      
      this.isUnsaved = 2
      this.setUnsaved(true)
    },
    onUpdateAnnotation() {
      // triggered after deselecting moved annotation
      // Or annotation which target has been changed.
      // NOTE that onCancelSelected() will NOT be called
      this.logEvent('onUpdateAnnotation')

      this.setUnsaved()
      this.onCancelSelected()
    },
    onCancelSelected(selection) {
      // triggered after deselecting without changing box
      // NOTE that onUpdateAnnotation() will NOT be called
      // at this point this.anno.getSelected() still returns an annotation!
      this.logEvent('onCancelSelected')

      this.annotation = null
      delete this.description.textTarget
      this.updateSignHighlights()
      this.clearDescription()
    },
    selectAnnotation(annotation) {
      if (annotation) {
        annotation = this.anno.selectAnnotation(annotation)
      }
      if (annotation) {
        // why in a timeout? 
        // Because annotorious selectAnnotation dedupe shapes that way.
        // So we are sure things are all consistent by coming after.
        setTimeout(() => {
          this.onSelectAnnotation(annotation)  
        }, 2)
      }
      return annotation
    },
    onSelectAnnotation(annotation) {
      this.logEvent('onSelectAnnotation')

      if (annotation) {
        this.description = deepCopy(annotation.body[0].value)        

        // this.description = JSON.parse(annotation.body[0].value)
        // set the script from the allograph if absent
        if (this.description.allograph && !this.description.script) {
          let allograph = this.definitions.allographs[this.description.allograph]
          if (allograph && allograph.script != 'base') {
            this.description.script = allograph.script
          }
        }
        // This call sometimes returns undefined after a selectAnnotation(annotation)!
        // this.annotation = this.anno.getSelected()
        this.annotation = annotation
      } else {
        this.onCancelSelected()
      }
      this.updateSignHighlights()
    },
    clearDescription() {
      // console.log('Untick features')
      this.description.allograph = null
      this.description.components = null
      this.description.textTarget = null
      this.description.tags = null
      this.tag = ''
      this.updateDescriptionFromAllograph()
    },
    onDeleteAnnotation() {
      this.logEvent('onDeleteAnnotation')

      this.setUnsaved()
      this.onCancelSelected()
    },
    onClickAnnotation() {
      this.logEvent('onClickAnnotation')

      // this.saveAnnotationsToSession()
    },
    // Events - Selection
    // async onSelectObject(obj) {
    //   this.clearMessages()
    //   await this.saveAnnotationsToGithub()
    //   this.selection.object = obj['@id']
    // },
    getImageUrl() {
      let ret = `${IMG_PATH_STATIC_ROOT}${this.image.uri}`
      if (typeof IMG_PATH_IIIF_ROOT !== 'undefined') {
        let imgid = this.image.uri.replace(/\.[^.]+$/, '');
        ret = IMG_PATH_IIIF_ROOT
          .replace('{DOCID}', this.object['title'])
          .replace('{IMGID}', imgid);
      }
      return ret
    },
    // Events - Other
    onImageOpenFailed() {
      // TODO
      this.setImageLoadedStatus(-1)
      console.log('OPEN FAILED')
    },
    // Persistence backend
    setUnsaved(dontUpdateModified=false) {
      // tells the Annotator that not all changes on screen are saved yet on GH
      if (this.image?.uri) {
        if (this.isUnsaved == 0) {
          this.isUnsaved = 1
        } 
        if (!dontUpdateModified) {
          let annotation = this.anno.getSelected()
          if (annotation) {
            annotation.modifiedBy = this.userId
            annotation.modified = new Date().toISOString()
          }
        }
      }
    },
    async onClickSave() {
      // save the image annotations to github
      await this.saveAnnotationsToGithub()
    },
    async saveAnnotationsToGithub() {
      if (this.isUnsaved) {
        if (!this.canSave)  {
          console.log('Can\'t save in read only mode.')
          return
        }
        console.log('SAVE to github')

        let sha = this.annotationsSha

        let selectedAnnotation = this.annotation
        // See issue GH-10:
        // Without this call, the changes to the selected box won't be saved.
        // This forces Annotorious to update the annotation target,
        // and trigger onUpdateAnnotation().
        // It also deselects the annotation.
        // But we re-select it after saving to GH.
        if (selectedAnnotation && this.isUnsaved > 1) {
          await this.anno.saveSelected()
        }

        let filePath = this.getAnnotationFilePath()
        let annotations = deepCopy(this.anno.getAnnotations())
        annotations = this.convertAnnotationsToW3C(annotations)
        // sort the annotations by id so it is deterministic
        annotations.sort((a, b) => {
          return a.id === b.id ? 0 : (a.id > b.id ? 1 : -1);
        })
        if (DEBUG_DONT_SAVE) {
          console.log('debugDontSave=True => skip saving.')
        } else {
          this.annotationsSha = await utils.updateGithubJsonFile(filePath, annotations, this.getOctokit(), sha)
        }

        // restore the selection
        if (selectedAnnotation && this.isUnsaved > 1) {
          this.selectAnnotation(selectedAnnotation)
        }

        this.isUnsaved = 0
      }
    },
    async initOctokit() {
      this.octokit = null
      this.user = null

      if (this.selection.gtoken) {
        this.octokit = new window.Octokit({
          auth: this.selection.gtoken
        })

        if (this.octokit) {
          let res = null
          res = await this.octokit.rest.users.getAuthenticated()
            .catch(
              err => {
                res = null
                this.octokit = null
                if (err.message.includes('Bad credentials')) {
                  this.logError('Bad github token. Is your tocken expired?')
                } else {
                  this.logError('Github authentication: Unknown error.')
                }
              }
            );
          if (res) {
            this.user = res.data
          }
        }
      }

      return this.octokit
    },
    getOctokit() {
      // TODO: create wrapper class around Octokit
      // TODO: cache this
      return this.octokit
    },
    setImageLoadedStatus(isLoaded) {
      this.isImageLoaded = isLoaded
      this.anno.readOnly = !this.canSave
    },
    onImageLoaded() {
      // called by OSD on successful image loading
      this.setImageLoadedStatus(1)
      this.loadAnnotations()
    },
    loadAnnotations() {
      return this.loadAnnotationsFromGithub()
    },
    async loadAnnotationsFromGithub() {
      // this.annotations = null
      // TODO: detect error (but 404 not an error!)
      let filePath = this.getAnnotationFilePath()
      if (filePath) {
        let res = await utils.readGithubJsonFile(filePath, this.getOctokit())
        if (res) {
          let annotations = this.upgradeAnnotations(res.data)
          annotations = this.dedupeAnnotations(annotations)
          annotations = this.convertAnnotationsToAnnotorious(annotations)
          this.anno.setAnnotations(annotations)
          if (this.selection.annotationId) {
            this.selectAnnotation(`${this.selection.annotationId}`)
          } else {
            this.updateSignHighlights()
          }
          this.annotationsSha = res.sha
        } else {
          this.anno.clearAnnotations()
          this.annotationsSha = null
        }
      }
      this.isUnsaved = 0
    },
    getAnnotationFormatVersion(annotation) {
      // returns the annotation format version as a date. e.g. 2023-07-28-00
      // See ANNOTATION_FORMAT_VERSION
      return (annotation?.generator || '').replace(/^[^#]+#/, '')
    },
    upgradeAnnotations(annotations) {
      ret = annotations

      for (let annotation of ret) {
        let description = annotation?.body[0]?.value
        // July 2023 - convert the description body/value from json string to json
        if (typeof description === 'string') {
          annotation.body[0].value = JSON.parse(description)
        }

        let version = this.getAnnotationFormatVersion(annotation)
        if (version < '2023-08-04-00') {
          // more compact, self-descriptive and resilient format for the C-Fs
          /*
          "components": [
            [
              "main-stroke",
              {
                "bilinear": false,
                "concave-up": true,
                [...]
          
          =>

          "components": {
            "main-stroke": {
              features: ["concave-up"]
            }
          }
          */
          let components = annotation?.body[0]?.value?.components
          if (components) {
            let newComponents = {}
            for (let component of annotation?.body[0]?.value?.components) {
              let features = []
              for (let featureKey of Object.keys(component[1])) {
                if (component[1][featureKey]) features.push(featureKey)
              }
              if (features.length) {
                newComponents[component[0]] = {'features': features}
              }
            }
            annotation.body[0].value.components = newComponents
          }          
        }

        // bump the version
        annotation.generator = ANNOTATION_GENERATOR_URI
      }
      return ret
    },
    correctAnnotationId(annotation) {
      // "id": "#ea90b5df-1cc8-4f23-b043-dcd609be5bd1",
      // =>
      // "id": "http://example.com/annotations/ea90b5df-1cc8-4f23-b043-dcd609be5bd1",
      if (annotation.id.startsWith('#')) {
        annotation.id = ANNOTATION_URI_PREFIX + annotation.id.substring(1)
      }
    },
    convertAnnotationsToW3C(annotations) {
      // annotorious doesn't support the full W3C standard
      /*
        Annotorious:

        "body": [
          {
            "type": "TextualBody",
            "purpose": "describing",
            "format": "application/json",
            "value": {
              "allograph": "S-SCRIPT",
              "components": [],
              "textTarget": {
                "textId": null,
                "wordId": "ISic000001-20",
                "signId": "2"
              },
              "script": "SCRIPT"
            }
          }
        ],
        "target": {
          <IMAGE TARGET>
        }

        W3C: 
        https://www.w3.org/TR/annotation-model/#serialization-of-the-model

        "body": [
          {
            "type": "TextualBody",
            "purpose": "describing",
            "format": "application/json",
            "value": {
              "character": "S",
              "components": [],
              "script": "SCRIPT"
            }
          }
        ],
        "target": [
          { <IMAGE TARGET> },
          {
            "source": "<DTS URL>",
            "selector": {
              "type": "XPathSelector",
              "value": "//*[@xml:id='ISic000001-10']",
              "refinedBy": {
                "type": "TextPositionSelector",
                "start": 1,
                "end": 2
              }
            }
          },
        ]

      */
      let ret = annotations
      for (let annotation of ret) {
        // 1. only one target allowed => move textual target from body/textTarget to target
        if (!(annotation.target instanceof Array)) {
          annotation.target = [annotation.target]
        }

        let description = annotation?.body[0]?.value
        let textTarget = description?.textTarget

        if (textTarget) {
          delete description.textTarget
          // let textId = textTarget.textId || this.objectId
          let startIndex = parseInt(textTarget.signId)
          let target = {
            "source": `${DTS_ROOT}${this.objectDtsPassage}`,
            "selector": {
              "type": "XPathSelector",
              "value": `//*[@xml:id='${textTarget.wordId}']`,
              "refinedBy": {
                "type": "TextPositionSelector",
                "start": startIndex,
                "end": startIndex + 1
              }
            }
          }

          annotation.target.push(target)          
        }

        // July 2023 - convert annotorious id to valid uri
        this.correctAnnotationId(annotation)

        // 2023-09-01
        // Stored annotation uses Character instead of Allograph
        // Annotation in app memory still uses Allograph
        // See issue gh-34
        let allographKey = annotation?.body[0]?.value?.allograph
        if (allographKey) {
          let allograph = this.definitions.allographs[allographKey]
          if (allograph) {
            annotation.body[0].value.character = allograph.character
            delete annotation.body[0].value.allograph
          }
        }

      }
      return ret
    },
    dedupeAnnotations(annotations) {
      let ids = {}
      return annotations.filter(an => {
        let ret = !ids[an.id]
        ids[an.id] = 1
        if (!ret) console.log(`WARNING: removed duplicate annotation ${an.id}`)
        return ret
      })
    },
    convertAnnotationsToAnnotorious(annotations) {
      // annotorious doesn't support the full W3C standard
      let ret = annotations

      for (let annotation of ret) {
        if (annotation.target instanceof Array && annotation.target.length > 0) {
          // 1. only one target allowed => temporarily shove the textual target into the body/textTarget
          let targets = annotation.target
          annotation.target = targets[0]

          if (targets.length > 1) {
            let textTarget = targets[1]

            annotation.body[0].value.textTarget = {
              textId: textTarget.source,
              wordId: textTarget.selector.value.replace(/^.*id='([^']+).*$/, '$1'),
              signId: `${textTarget.selector.refinedBy.start}`
            }
          }
        }

        // 2023-09-01
        // Stored annotation uses Character instead of Allograph
        // Annotation in app memory still uses Allograph
        // See issue gh-34
        if (annotation?.body[0]?.value?.character) {
          for (let k of Object.keys(this.definitions.allographs)) {
            let allograph = this.definitions.allographs[k]
            if (allograph.script == annotation?.body[0]?.value?.script 
                && allograph.character == annotation?.body[0]?.value?.character) {
              annotation.body[0].value.allograph = k
              delete annotation.body[0].value.character
            }
          }
        }

      }
      
      return ret
    },
    getAnnotationFilePath() {
      let ret = null
      if (this.object && this.image) {
        ret = 'annotations/' + utils.slugify(`${this.object['@id']}/${this.image.uri}`) + '.json'
      }
      return ret
    },
    getAnnotationsAbsolutePath() {
      return `https://raw.githubusercontent.com/kingsdigitallab/crossreads/main/${this.getAnnotationFilePath()}`;
    },
    // Low-level Utilities
    getURIFromXMLPrefix(prefix) {
      const ns = {
        'tei': 'http://www.tei-c.org/ns/1.0',
        'xhtml': 'http://www.w3.org/1999/xhtml',
      };
      return ns[prefix] || null;
    },
    annotoriousFormatter(annotation) {
      // Called by Annotorious each time it needs to render an annotation
      // sets 'bound' class to annotation svg 
      // if bound to a sign in the text.
      let ret = ''
      if (this.getSignFromAnnotation(annotation)) {
        ret = 'bound'
      }
      return ret
    },
    isTokenMissing() {
      return !this.selection.gtoken
    },
    getAgoFormat(adate) {
      let timeStamp = adate.getTime()
      var now = new Date(),
        secondsPast = (now.getTime() - timeStamp) / 1000;
      if (secondsPast < 60) {
        return parseInt(secondsPast) + 's';
      }
      if (secondsPast < 3600) {
        return parseInt(secondsPast / 60) + 'm';
      }
      if (secondsPast <= 86400) {
        return parseInt(secondsPast / 3600) + 'h';
      }
      if (secondsPast > 86400) {
        day = timeStamp.getDate();
        month = timeStamp.toDateString().match(/ [a-zA-Z]*/)[0].replace(" ", "");
        year = timeStamp.getFullYear() == now.getFullYear() ? "" : " " + timeStamp.getFullYear();
        return day + " " + month + year;
      }
    },
    logEvent(eventName) {
      if (LOG_EVENTS) console.log(`EVENT ${eventName}`)
    },
    dlg(annotations=null) {
      let ids = {}
      if (!annotations) {
        annotations = this.anno.getAnnotations()
      }
      for (let annotation of annotations) {
        if (ids[annotation.id]) {
          console.log('duplicate ' + annotation.id)
        }
        ids[annotation.id] = 1
      }
    },
    logMessage(content, level = 'info') {
      // level: info|primary|success|warning|danger
      this.messages.push({
        content: content,
        level: level,
        created: new Date()
      })
    },
    logWarning(content) {
      this.logMessage(content, 'warning')
    },
    logError(content) {
      this.logMessage(content, 'danger')
    },
    logOk(content) {
      this.logMessage(content, 'success')
    },
    clearMessages() {
      this.messages = []
    },
    setAddressBarFromSelection() {
      // ?object
      // let searchParams = new URLSearchParams(window.location.search)
      let searchParams = {
        obj: this.selection.object,
        img: this.selection.image,
        sup: this.selection.showSuppliedText ? 1 : 0,
        ann: (this.annotation?.id || '').replace(/^#/, ''),
        scr: this.description.script
      };

      utils.setQueryString(searchParams)
    },
    async setSelectionFromAddressBar() {
      let searchParams = new URLSearchParams(window.location.search);

      this.selection.object = searchParams.get('obj') || ''
      this.selection.image = searchParams.get('img') || ''
      this.selection.showSuppliedText = searchParams.get('sup') === '1'
      this.selection.annotationId = searchParams.get('ann') || ''
      this.description.script = searchParams.get('scr') || ''
    },
    getContentClasses(panel) {
      return `view-${panel.selections.view}`;
    },
    onAddTag() {
      if (this.tagFormatError) return;

      let tag = this.tag

      tag = tag.trim()

      if(!tag) return;

      if (!this.description.tags) {
        this.description.tags = []
      }

      if (this.description.tags.includes(tag)) return;

      this.description.tags.push(tag)
      this.availableTags.addTag(tag)
      this.updateSelectedAnnotationFromDescription()
      this.tag = ''
    },
    onDeleteTag(tag) {
      if (!this.description.tags) return;
      this.description.tags = this.description.tags.filter(t => t != tag)
      this.updateSelectedAnnotationFromDescription()
    },
    onBlurObjectSearch() {
      this.resetSearchPhrase()
    },
    onEscapeObjectSearch() {
      if (this.searchPhrase == '') {
        this.resetSearchPhrase()
      } else {
        this.searchPhrase = ''
      }
    },
    resetSearchPhrase() {
      this.searchPhrase = this?.object?.title || ''
    }
  },
}).use(vuetify).mount('#annotator');
