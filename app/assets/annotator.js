/* TODO: modularise the Vue app:
. Objects List
. Images List
. Image
. Description
. Text

- remove hard-coded values (e.g. paths)
*/

let IMG_PATH_IIIF_ROOT = 'http://localhost:49153/iiif/2/'
// if defined, the viewer will fetch full image files instead of IIIF tiles
let IMG_PATH_STATIC_ROOT = './data/images/'

const definitionsPath = 'app/data/pal/definitions-digipal.json'

// TODO: move this into Vue?
function loadOpenSeaDragon(vueApp) {
  var viewer = OpenSeadragon({
    id: "image-viewer",
    prefixUrl: './node_modules/openseadragon/build/openseadragon/images/',
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
    formatters: vueApp.annotoriousFormatter
  };
  var anno = OpenSeadragon.Annotorious(viewer, config);
  vueApp.anno = anno;
  window.anno = anno;
  vueApp.viewer = viewer;

  let eventNames = [
    'createSelection', 'createAnnotation', 'updateAnnotation',
    'selectAnnotation', 'cancelSelected', 'clickAnnotation',
    'deleteAnnotation', 'changeSelectionTarget',
    // 'mouseLeaveAnnotation', 'mouseLeaveAnnotation'
  ]
  for (let eventName of eventNames) {
    anno.on(eventName, vueApp[`on${eventName[0].toUpperCase()}${eventName.substring(1)}`]);
  }
  anno.on('open-failed', vueApp.onImageOpenFailed);
  // setAnnotations() is defered by Annotorious until tiles are loaded.
  // So we wait until it's ready to do things based on getAnnotations().
  viewer.addHandler('open', () => {
    // vueApp.updateSignHighlights()
    // vueApp.loadAnnotationsFromSession()
    vueApp.loadAnnotations()
  });

};

const { createApp } = Vue

createApp({
  data() {
    return {
      // TODO: not reactive
      apis: {
        // collections: 'https://isicily-dts.herokuapp.com/dts/api/collections/',
        collections: './data/2023-01/collection.json',
        definitions: './data/pal/definitions-digipal.json',
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
        allograph: 'a',
        components: [
          ['c1', { 'f1': false, 'f3': true }],
        ],
        // TODO: aspects
        // TODO: move this out of description, it should be an annotation target; not in ann body 
        textTarget: {
          // TODO: is there a std for this kind of ptr?
          textId: null,
          wordId: null,
          signId: null
        }
      },
      annotation: null,
      annotationsSha: null,
      cache: {
        isDescriptionLoading: false,
        allographLast: '123',
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
      },
      isUnsaved: false,
      messages: [
      ],
      queryString: '',
      octokit: null,
      user: null
    }
  },
  async mounted() {
    // TODO: chain load (from objects, to image, ...) 
    // instead of loading all here.in parallel
    this.setSelectionFromAddressBar()

    await this.initOctokit()

    loadOpenSeaDragon(this)
    this.loadObjects()
    this.loadDefinitions()
    // this.logOk('App loaded')
  },
  watch: {
    object(val, valOld) {
      if (valOld) {
        this.saveAnnotationsToGithub()
      }
      this.fetchObjectXML()
    },
    'selection.showSuppliedText'() {
      console.log('showSuppliedText')
      this.setAddressBarFromSelection()
    }
  },
  computed: {
    filteredObjects() {
      let ret = []
      for (let k of Object.keys(this.objects)) {
        let o = this.objects[k]
        let searcheable = `${o.description.toLowerCase()} ${o.title} ${o['@id']}`
        if (searcheable.includes(this.searchPhrase.toLowerCase())) {
          ret.push(o)
        }
      }
      return ret
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
    isAnnotationSelected() {
      return !!this.annotation
    },
    tabs: () => utils.tabs(),
    canSave() {
      // return !!this.selection.gtoken
      return this.getOctokit() !== null
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
    object() {
      return this.objects[this.selection.object] || null
    },
    image() {
      return this.images[this.selection.image] || null
    }
  },
  methods: {
    loadObjects() {
      // Load objects list (this.objects) from DTS collections API 
      fetch(this.apis.collections)
        .then(res => res.json())
        .then(res => {
          // console.log(res)
          this.objects = {}
          for (let m of res.member) {
            if (m) {
              this.objects[m['@id']] = {
                '@id': m['@id'],
                title: m.title,
                description: m.description,
                "dts:download": m['dts:download']
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
      let res = await utils.readGithubJsonFile(definitionsPath, this.getOctokit())
      if (res) {
        this.definitions = res.data
        this.updateDescriptionFromAllograph()
      } else {
        this.logError('Failed to load definitions from github.')
      }
      // fetch(this.apis.definitions)
      //   .then(res => res.json())
      //   .then(res => {
      //     this.definitions = res
      //     this.updateDescriptionFromAllograph()
      //   })
    },
    fetchObjectXML() {
      // fetch the TEI XML from DTS API for the selected object (this.object)
      if (this.object) {
        const uri = this.object["dts:download"]
        const self = this
        fetch(uri)
          .then(res => res.text())
          .then(res => new window.DOMParser().parseFromString(res, 'text/xml'))
          .then(xml => {
            // self.tei = res
            // Only to ease debugging
            // window.tei = res

            this.setImagesFromObjectXML(xml)
            this.setTextFromObjectXML(xml)
          })
      }
    },
    setImagesFromObjectXML(xml) {
      // get all the tei:graphic -> image locations
      this.images = {}
      let it = xml.evaluate('//tei:graphic', xml, this.getURIFromXMLPrefix, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null)
      while (true) {
        let node = it.iterateNext()
        if (!node) break
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
      this.onSelectImage(img)
    },
    setTextFromObjectXML(xml) {
      // xml (TEI) -> this.text (XHTML)
      fetch('./data/tei2html.xslt')
        .then(res => res.text())
        .then(res => new window.DOMParser().parseFromString(res, 'text/xml'))
        .then(res => {
          let processor = new XSLTProcessor()
          processor.importStylesheet(res)
          let doc = processor.transformToFragment(xml, document)
          // set index of each line, starying from 1
          let lineIdx = 0
          for (let lineNumber of doc.querySelectorAll('.line-number')) {
            lineIdx++;
            lineNumber.innerText = lineIdx
          }
          // set data-idx to each span.sign, relative to its parent span.word
          let signCount = 0
          for (let word of doc.querySelectorAll('.tei-w')) {
            let signIdx = 0
            for (let sign of word.querySelectorAll('.sign')) {
              sign.attributes.getNamedItem('data-idx').value = signIdx++
              signCount++;
            }
          }
          if (signCount < 1) {
            this.logWarning("Word ids not found in TEI.")
          }
          // to string
          this.text = new XMLSerializer().serializeToString(doc)
          // console.log(this.text)
          // attach events to each sign
          Vue.nextTick(() => {
            for (let sign of document.querySelectorAll('.sign')) {
              sign.addEventListener('click', (e) => this.onClickSign(sign));
              // sign.addEventListener('mouseenter', (e) => this.onMouseEnterSign(sign));
              // sign.addEventListener('mouseleave', (e) => this.onMouseLeaveSign(sign));
            }
            // console.log('setTextFromObjectXML:updateSignHighlights')
            this.updateSignHighlights()
          })
        })
    },
    onClickSign(sign) {
      // console.log('Click sign')
      let selectedAnnotation = this.anno.getSelected()
      let signAnnotation = this.getAnnotationFromSign(sign)
      let annotationSign = this.getSignFromAnnotation()
      if (sign == annotationSign) {
        // unbind sign from selected annotation
        this.description.textTarget = null
        this.updateSelectedAnnotationFromDescription()
      } else if (selectedAnnotation && !signAnnotation && !annotationSign) {
        // bind sign to selected annotation
        this.description.textTarget = this.getTextTargetFromSign(sign)
        this.updateSelectedAnnotationFromDescription()
        signAnnotation = selectedAnnotation
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
      let word = sign.closest('.tei-w')
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
      // console.log(`updateSignHighlights: ${this.anno.getAnnotations().length} annotations`)
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
        let description = JSON.parse(annotation.body[0].value)
        if (description?.textTarget?.signId) {
          let word = document.querySelector(`.tei-w[data-tei-id="${description?.textTarget?.wordId}"]`)
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
    onChangeAllograph() {
      this.updateDescriptionFromAllograph()
      this.updateSelectedAnnotationFromDescription()
    },
    onChangeComponentFeature() {
      this.updateSelectedAnnotationFromDescription()
    },
    updateSelectedAnnotationFromDescription() {
      let annotation = this.anno.getSelected()
      if (annotation) {
        annotation.body[0].value = JSON.stringify(this.description)
        this.anno.updateSelected(annotation)
        this.setUnsaved()
        // this.saveAnnotationsToSession()
      }
    },
    updateDescriptionFromAllograph() {
      let description = this.description
      if (1 || description.allograph != this.cache.allographLast) {
        this.description.components = []
        if (this.definitions.allographs[description.allograph]) {
          for (let componentKey of this.definitions.allographs[description.allograph].components) {
            let features = {}
            for (let featureKey of this.definitions.components[componentKey].features) {
              features[featureKey] = false
            }
            // console.log(features)
            this.description.components.push([componentKey, features])
          }
          this.cache.allographLast = description.allograph
        }
      }
    },
    // Events - Annotorious
    async onCreateSelection(selection) {
      // console.log('EVENT onCreateSelection')

      // selection.motivation = 'describing'
      selection.body = [{
        type: 'TextualBody',
        purpose: 'describing',
        format: 'application/json',
        value: JSON.stringify(this.description)
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
      console.log('EVENT onCreateAnnotation')
      // this.saveAnnotationsToSession()
      this.setUnsaved()
      this.anno.selectAnnotation(annotation)
    },
    onMouseEnterAnnotation(annotation, element) {
      // console.log('EVENT onMouseEnterAnnotation')
    },
    onMouseLeaveAnnotation(annotation, element) {
      // console.log('EVENT onMouseLeaveAnnotation')
      // console.log(annotation)
    },
    onChangeSelectionTarget(target) {
      // triggered each time a selected box changes
      // NOTE that the selected annotation's target is NOT changed yet
      // It will be updated ONLY when deselecting.
      // which can be done with saveSelected().
      // Which in trun calls onUpdateAnnotation().
      console.log('EVENT onChangeSelectionTarget')
      this.setUnsaved()
    },
    onUpdateAnnotation() {
      // triggered after deselecting moved annotation
      // Or annotation which target has been changed.
      // NOTE that onCancelSelected() will NOT be called
      console.log('EVENT onUpdateAnnotation')
      this.onCancelSelected()
      this.setUnsaved()
    },
    onCancelSelected(selection) {
      // triggered after deselecting without changing box
      // NOTE that onUpdateAnnotation() will NOT be called
      // at this point this.anno.getSelected() still returns an annotation!
      console.log('EVENT onCancelSelected')
      this.annotation = null
      delete this.description.textTarget
      this.updateSignHighlights()
      this.clearDescription()
    },
    selectAnnotation(annotation) {
      this.anno.selectAnnotation(annotation)
      this.onSelectAnnotation(annotation)
      return annotation
    },
    onSelectAnnotation(annotation) {
      console.log('EVENT onSelectAnnotation')
      if (annotation) {
        this.description = JSON.parse(annotation.body[0].value)
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
      this.updateDescriptionFromAllograph()
    },
    onDeleteAnnotation() {
      console.log('EVENT onDeleteAnnotation')
      this.setUnsaved()
    },
    onClickAnnotation() {
      console.log('EVENT onClickAnnotation')
      // this.saveAnnotationsToSession()
    },
    // Events - Selection
    onSelectObject(obj) {
      this.selection.object = obj['@id']
    },
    onSelectImage(img) {
      this.clearDescription()
      this.selection.image = img.uri
      if (img) {
        let options = {}
        if (typeof IMG_PATH_STATIC_ROOT !== 'undefined') {
          options = {
            type: 'image',
            // TODO: temporary static call so app works on github pages without IIIF server
            // http://openseadragon.github.io/examples/tilesource-image/
            url: `${IMG_PATH_STATIC_ROOT}${this.image.uri}`,
          }
        } else {
          options = {
            type: 'image',
            // TODO: doesn't use IIIF tiles!
            // http://openseadragon.github.io/examples/tilesource-iiif/
            // url: `${IMG_PATH_IIIF_ROOT}${this.image.uri}/full/full/0/default.jpg`,
          }
          options = [
            // 'https://libimages1.princeton.edu/loris/pudl0001%2F4609321%2Fs42%2F00000001.jp2/info.json'
            `${IMG_PATH_IIIF_ROOT}${this.image.uri}/info.json`
          ]
        }
        this.viewer.open(options)
      }
      this.setAddressBarFromSelection()
      // now done in the 'open' event to make sure viewer is ready 
      // and anno.getAnnotations() returns something
      // this.loadAnnotationsFromSession()
    },
    // Events - Other
    onImageOpenFailed() {
      // TODO
      console.log('OPEN FAILED')
    },
    // Persistence backend
    saveAnnotationsToSession() {
      if (this.image?.uri) {
        this.cache.store.imagesAnnotations[this.image.uri] = this.anno.getAnnotations()
        console.log(this.anno.getAnnotations()[0].target.selector.value)
        window.localStorage.setItem('imagesAnnotations', JSON.stringify(this.cache.store.imagesAnnotations))
        console.log('save annotations')
        // this.isUnsaved = true
      }
    },
    setUnsaved() {
      // tells the Annotator that not all changes on screen are saved yet on GH
      if (this.image?.uri) {
        this.isUnsaved = true
      }
    },
    onClickSave() {
      // save the image annotations to github
      // TODO: save sha?
      this.saveAnnotationsToGithub()
    },
    async saveAnnotationsToGithub() {
      if (this.isUnsaved) {
        console.log('SAVE to github')
        let sha = this.annotationsSha

        let selectedAnnotation = this.annotation
        // See issue GH-10:
        // Without this call, the changes to the selected box won't be saved.
        // This forces Annotorious to update the annotation target,
        // and trigger onUpdateAnnotation().
        // It also deslects the annotation.
        // But we re-select it after saving to GH.
        if (selectedAnnotation) {
          await this.anno.saveSelected()
        }

        let filePath = this.getAnnotationFilePath()
        let data = this.anno.getAnnotations()
        // sort the annotations by id so it is deterministic
        data.sort((a, b) => {
          return a.id === b.id ? 0 : (a.id > b.id ? 1 : -1);
        })
        this.annotationsSha = await utils.updateGithubJsonFile(filePath, data, this.getOctokit(), sha)

        // restore the selection
        if (selectedAnnotation) {
          this.anno.selectAnnotation(selectedAnnotation)
          this.onSelectAnnotation(selectedAnnotation)
        }

        this.isUnsaved = false
      }
    },
    async initOctokit() {
      this.octokit = null
      this.user = null

      if (this.selection.gtoken) {
        console.log("OCT get")
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
    loadAnnotations() {
      return this.loadAnnotationsFromGithub()
    },
    async loadAnnotationsFromGithub() {
      this.annotations = null
      // TODO: detect error (but 404 notan error!)
      let filePath = this.getAnnotationFilePath()
      if (filePath) {
        let res = await utils.readGithubJsonFile(filePath, this.getOctokit())
        // let res = await utils.readGithubJsonFile(filePath)
        if (res) {
          this.anno.setAnnotations(res.data)
          if (this.selection.annotationId) {
            this.annotation = this.anno.selectAnnotation(`#${this.selection.annotationId}`)
            this.onSelectAnnotation(this.annotation)
          }
          this.updateSignHighlights()
          this.annotationsSha = res.sha
        } else {
          this.anno.clearAnnotations()
          this.annotationsSha = null
        }
      }
      this.isUnsaved = false
    },
    loadAnnotationsFromSession2() {
      // TODO: restore this function, and use for offline editing
      let imagesAnnotations = window.localStorage.getItem('imagesAnnotations')
      if (imagesAnnotations) {
        this.cache.store.imagesAnnotations = JSON.parse(imagesAnnotations)
        let annotations = this.image?.uri ? this.cache.store.imagesAnnotations[this.image.uri] : null
        if (annotations) {
          // !!! this.anno.getAnnotations() just after this will return empty set.
          // Because Annotorious uses a _lazy function that defer if tiles are not yet loaded.
          // https://github.com/recogito/annotorious-openseadragon/blob/3321e003732da612097bb23e440717a2c510bd4d/src/OSDAnnotationLayer.js#L303
          this.anno.setAnnotations(annotations)
          // console.log('loadAnnotationsFromSession:updateSignHgighlights')
          // console.log(annotations.length)
          // console.log(this.anno.getAnnotations().length)
          this.updateSignHighlights()
        } else {
          this.anno.clearAnnotations()
        }
      }
      this.isUnsaved = false
    },
    getAnnotationFilePath() {
      let ret = null
      if (this.object && this.image) {
        ret = 'annotations/' + utils.slugify(`${this.object['@id']}/${this.image.uri}`) + '.json'
      }
      return ret
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
      // sets 'bound' class to annotation svg 
      // if bound to a sign in the text.
      let ret = ''
      if (this.getSignFromAnnotation(annotation)) {
        ret = 'bound'
      }
      // console.log(`formatter: "${ret}"`)
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
    setAddressBarFromSelection() {
      // ?object
      // let searchParams = new URLSearchParams(window.location.search)
      let searchParams = {
        obj: this.selection.object,
        img: this.selection.image,
        sup: this.selection.showSuppliedText ? 1 : 0,
        ann: (this.annotation?.id || '').replace(/^#/, '')
      };

      //
      let newRelativePathQuery = window.location.pathname
      let qsKeys = Object.keys(searchParams)
      let qs = ''
      if (qsKeys.length) {
        for (let k of qsKeys) {
          if (searchParams[k]) {
            if (qs) qs += '&';
            qs += `${k}=${searchParams[k]}`
          }
        }
        if (qs) {
          qs = `?${qs}`
          newRelativePathQuery += qs
        }
      }
      this.queryString = qs
      history.pushState(null, "", newRelativePathQuery);
    },
    async setSelectionFromAddressBar() {
      let searchParams = new URLSearchParams(window.location.search);

      this.selection.object = searchParams.get('obj') || ''
      this.selection.image = searchParams.get('img') || ''
      this.selection.showSuppliedText = searchParams.get('sup') === '1'
      this.selection.annotationId = searchParams.get('ann') || ''
    },
    getContentClasses(panel) {
      return `view-${panel.selections.view}`;
    },
  },
}).mount('#annotator');
