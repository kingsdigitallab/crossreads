/*
TODO
S error management
S add metadata to index
S index of tags
S all annotations should have a DTS target even if not letter bound
C remove decimals from region
C shorter id?
C include the letter and word in the dts selector?
*/
import * as fs from 'fs';
import * as path from 'path';
import { SETTINGS, utils } from "../app/utils.mjs";

// Set to true to minify the index.json output.
// false to make it more readable for debugging purpose.
const COMPRESS_OUTPUT = false

class AnnotationIndex {
  annotations = []
  tags = {}

  constructor(path=null) {
    this.path = path ?? 'INDEX'
    this.messages = []
    this.varsBoxItems = {}
  }

  log(message, level='WARNING', annotionsFile=null, annotationId=null) {
    this.messages.push({
      message: message,
      level: level,
      file: annotionsFile,
      id: annotationId
    })
    console.log(`${level}: ${message} (File: ${annotionsFile}. Annotation: ${annotationId})`)
  }

  testAnnotationsFile(filePath) {
    let content = utils.readJsonFile(filePath)
    let isFixed = false

    for (let ann of content) {
      for (let target of ann.target) {
        if (target?.source.includes('null')) {
          let level = 'WARNING'
          if (ann.target[0]) {
            let inscriptionId = this.getInscriptionIdFromAnnotation(ann)
            isFixed = true
            target.source = `${SETTINGS.DTS_DOC_BASE}${inscriptionId}.xml`
            level = 'FIX'
          }
          this.log("target[i].source contained 'null'", level, filePath, ann.id)
        }
      }
    }

    if (isFixed) {
      content = JSON.stringify(content, null, 2)
      fs.writeFileSync(filePath, content)
    }
  }

  getInscriptionIdFromAnnotation(annotation) {
    let ret = null;
    let source = annotation.target
    if (annotation.target && annotation.target.length > 0) {
      // https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=/inscription_images/ISic000107/ISic000107_tiled.tif
      let source = annotation.target[0]?.source || '';
      // => ISic000107
      let match = source.match(/\/inscription_images\/(ISic[^/]+)\//)
      if (match) {
        ret = match[1]
      }
    }

    return ret
  }

  addAnnotationsFromFile(filePath) {
    // annotation = {
    //   'chr': ['A'],
    //   'scr': 'latin',
    //   'tag': ['tag1', 'tag-2'],
    //   'img': "https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=/inscription_images/ISic001408/ISic001408_tiled.tif",
    //   'box': 'xywh=pixel:3433.048828125,1742.54443359375,256.946044921875,253.8504638671875',
    //   'doc': 'https://crossreads.web.ox.ac.uk/api/dts/documents?id=ISic001408',
    //   'com': ['', '']
    // }

    let content = utils.readJsonFile(filePath)
    if (!content) return;

    for (let annotation of content) {
      let isValid = this.isAnnotationValid(annotation, filePath)

      let bodyValue = annotation?.body[0]?.value

      let character = bodyValue?.character || 'UNDEFINED'

      // let scriptName = this.definitions.scripts[bodyValue.script]
      let description = {'com': [], 'fea': [], 'cxf': []}
      for (let componentKey of Object.keys(bodyValue?.components || {})) {
        description['com'].push(componentKey)
        description['fea'] = [...description['fea'], ...bodyValue?.components[componentKey]?.features]
        description['cxf'] = [
          ...description['cxf'], 
          ...bodyValue?.components[componentKey]?.features.map(f => `${componentKey} is ${f}`)
        ]
      }

      // e.g. extarct ISic000085 from image
      // let img = annotation.target[0].source
      // let inscriptionNumber = img.replace(/^.*\/(ISic\d+)\/.*$/g, '$1')
      // TODO: use utils.getDocIDFromString() & test if it works on this format
      let inscriptionNumber = filePath.replace(/^.*-(isic\d+)-.*$/gi, '$1').toLowerCase()

      this.updateStatsWithAnnotation(description, character, bodyValue.script, bodyValue.tags, bodyValue?.components, inscriptionNumber)

      let inscriptionMeta = this.inscriptionsMeta[inscriptionNumber]
      if (inscriptionMeta) {
        description['pla'] = inscriptionMeta.origin_place
        description['mat'] = inscriptionMeta.support_material
        description['wme'] = inscriptionMeta.writting_method
        description['daf'] = inscriptionMeta.origin_date_from
        description['dat'] = inscriptionMeta.origin_date_to
      }

      // the coordinates of the bounding box in IIIF format
      // "xywh=pixel:1328.8419189453125,2340.632080078125,83.12060546875,335.348388671875"
      // [1328,2340,83,335]
      let box = annotation.target[0].selector.value
      box = box.substring(11).split(',').map(v => parseInt(v))

      // variants features
      let variantInfo = {}
      if (1) {
        let rules = utils.getAlloTypesFromAnnotations([annotation], this.variantRules)
        if (rules.length) {
          variantInfo['var'] = rules.map(r => r['variant-name'])          
        }
      }

      let characters = [character]
      let grapheme = utils.getGraphemeFromCharacter(characters[0])
      if (grapheme !== characters[0]) {
        characters.push(grapheme)
      }

      // core featrures
      // only keep distinct features
      description['fea'] = [...new Set(description['fea'])]
      let item = {
        'id': annotation.id,
        'chr': characters,
        'val': isValid,
        'scr': bodyValue.script,
        'tag': bodyValue.tags,
        'doc': annotation.target[1]?.source,
        'fil': path.basename(filePath),
        'img': annotation.target[0].source,
        'box': box.join(','),
        ...description,
        ...variantInfo,
      }
      this.annotations.push(item)

      // TODO: do that in a funtion
      for (let avar of item?.var ?? []) {
        let varKey = `${item.scr}-${item.chr[0]}-${avar}`
        if (!this.varsBoxItems[varKey]) {
          this.varsBoxItems[varKey] = []
        }
        let boxSortKey = (item.tag && item.tag.includes('m.exemplar')) ? '1' : '0'
        boxSortKey += '-' + String(box[2] * box[3]).padStart(7, '0')
        this.varsBoxItems[varKey].push([boxSortKey, item])
      }

    }
  }

  isAnnotationValid(annotation, annotionsFile) {
    // gh-52
    // not valid if document referenced for image doesn't match the doc id from the annotation file
    let message = ''

    let docIdFromFile = utils.getDocIdFromString(annotionsFile)

    for (let target of annotation.target) {
      let targetDocId = utils.getDocIdFromString(target.source)
      if (targetDocId !== docIdFromFile) {
        message = `Target references different document (${targetDocId}) than annotation file (${docIdFromFile})`
      }
    }

    if (message) {
      this.log(message, 'WARNING', annotionsFile, annotation.id)
    }

    return !message
  }

  loadDefinitions() {
    this.definitions = utils.readJsonFile('DEFINITIONS')    
  }

  loadVariantRules() {
    this.variantRules = utils.readJsonFile('VARIANT_RULES')
  }

  initStats() {
    this.stats = {
      'SC': {}, // script - character. DONE
      'Sc': {}, // script - component. DONE
      'SCc': {},// script - character - component. TODO
      'cf': {}, // component - features. DONE
      'c': {},  // character. DONE
      'f': {},  // features. DONE
      't': {},  // tags. DONE
      'api': {}, // annotations per inscription
    }
  }

  updateStatsWithAnnotation(description, character, script, tags, components, inscriptionNumber) {
    this.updateStatsWithFacetOption('SC', `${script}|${character}`)

    for (let k of description['com'] || []) {
      this.updateStatsWithFacetOption('c', k)
      this.updateStatsWithFacetOption('Sc', `${script}|${k}`)
      this.updateStatsWithFacetOption('SCc', `${script}|${character}|${k}`)
    }
    for (let k of description['fea'] || []) {
      this.updateStatsWithFacetOption('f', k)
    }
    for (let k of tags || []) {
      this.updateStatsWithFacetOption('t', k)
    }

    // combinations
    for (let k of Object.keys(components || {})) {
      for (let f of components[k].features) {
        this.updateStatsWithFacetOption('cf', `${k}|${f}`)
      }
    }

    // gh-99
    let apiKey = inscriptionNumber.toLowerCase()
    this.stats.api[apiKey] = (this.stats.api[apiKey] ?? 0) + 1
  }

  updateStatsWithFacetOption(facet, option) {
    this.stats[facet][option] = (this.stats[facet][option] || 0) + 1
  }

  async build(annotations_path=null) {
    annotations_path = annotations_path ?? utils.resolveFilePathFromFileKey('ANNOTATIONS')

    this.loadDefinitions()
    this.loadVariantRules()

    this.indexCollection = utils.readJsonFile('INDEX_COLLECTION')
    this.inscriptionsMeta = this.indexCollection.data

    this.initStats()

    for (let filename of fs.readdirSync(annotations_path).sort()) {
      if (filename === 'change-queue.json') continue;
      let filePath = path.join(annotations_path, filename);
      if (filePath.endsWith('.json') && !fs.lstatSync(filePath).isDirectory()) {
        this.testAnnotationsFile(filePath)
        this.addAnnotationsFromFile(filePath)
      }
    }

    this.writeIndexFiles()

    await this.writeThumbs()

    console.log('DONE')
  }

  async writeThumbs() {
    // TODO create folder if needed
    let parentPath = utils.resolveFilePathFromFileKey('THUMBS')

    let thumbsSummary = {}

    let thumbsSummaryLast = utils.readJsonFile(parentPath + '/thumbs.json')
    if (!thumbsSummaryLast) {
      thumbsSummaryLast = {
        data: {}
      }
    }

    for (let [varKey, boxItems] of Object.entries(this.varsBoxItems)) {
      // sort the index items for this variatn type by examplar and size of the box
      // examplar fist, largest boxes first
      boxItems.sort((a,b) => b[0].localeCompare(a[0]))

      // now save the best image under the thumbs folder
      let thumbPath = parentPath + '/' + varKey + '.jpg'
      let item = boxItems[0][1]
      let url = `${item.img}/${item.box}/,${SETTINGS.EXEMPLAR_THUMB_HEIGHT}/0/default.jpg`
      // console.log(`${url} => ${thumbPath}`)
      let existingThumb = thumbsSummaryLast.data[varKey]
      if (existingThumb && existingThumb.box === item.box && fs.existsSync(thumbPath)) {
        // console.log('SKIPPED (already saved)')
      } else {
        // fetch the image crop from the IIIF image server
        console.log(`FETCH variant type thumbnail from ${url} to ${thumbPath}`)
        await utils.fetchFile(url, thumbPath)
      }
      thumbsSummary[varKey] = item
    }

    // write the subset of the annotation index used for the thumbs
    // so we know where they come from and we can prevent fetching next time we index if the crop is the same
    this.writeJsonFile(thumbsSummary, parentPath + '/thumbs.json', `${Object.keys(thumbsSummary).length} thumbnails.`)
  }

  writeIndexFiles() {
    this.writeJsonFile(this.annotations, this.path, `${this.annotations.length} annotation(s)`)

    this.writeJsonFile(this.stats, 'STATS', 'definition stats.')

    this.writeJsonFile(this.messages, 'ANNOTATIONS_ISSUES', `${this.messages.length} messages`)
  }

  writeJsonFile(obj, path, description='') {
    path = utils.resolveFilePathFromFileKey(path)

    let fullData = {
      'meta': {
        "@context": "http://schema.org",
        'dc:modified': new Date().toISOString(),
        'dc:creator': 'https://github.com/kingsdigitallab/crossreads/blob/main/tools/index.mjs',
        'dc:source': 'https://github.com/kingsdigitallab/crossreads/tree/main/annotations',
      },
      'data': obj
    }
    let content = JSON.stringify(fullData, null, COMPRESS_OUTPUT ? 0 : 2)
    
    let action = 'WRITTEN'
    let contentBefore = utils.readJsonFile(path)
    if (contentBefore && contentBefore.data && JSON.stringify(contentBefore.data) === JSON.stringify(obj)) {
      action = 'UNCHANGED'
    } else {
      fs.writeFileSync(path, content)
    }
    console.log(`${action} ${path}, ${description}, ${(content.length / 1024 / 1024).toFixed(2)} MB.`)  
  }

}

const index = new AnnotationIndex()
await index.build()
