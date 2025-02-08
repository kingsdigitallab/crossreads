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
import { utils } from "../app/utils.mjs";

const INDEX_PATH = '../app/index.json'
const STATS_PATH = '../app/stats.json'
const TESTS_PATH = '../app/data/index/tests.json'
const ANNOTATIONS_PATH = '../annotations'
const DEFINITIONS_PATH = '../app/data/pal/definitions-digipal.json'
const PATH_INDEX_COLLECTION = 'index-collection.json'

// Set to true to minify the index.json output.
// false to make it more readable for debugging purpose.
const COMPRESS_OUTPUT = false

class AnnotationIndex {
  annotations = []
  tags = {}

  constructor(path) {
    this.path = path
    this.messages = []
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
            target.source = `http://sicily.classics.ox.ac.uk/inscription/${inscriptionId}.xml`
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
    //   'chr': 'A',
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
      if (!this.isAnnotationValid(annotation, filePath)) continue;

      let bodyValue = annotation?.body[0]?.value

      if (bodyValue?.character) {
        let scriptName = this.definitions.scripts[bodyValue.script]
        let description = {'com': [], 'fea': [], 'cxf': []}
        for (let componentKey of Object.keys(bodyValue?.components || {})) {
          description['com'].push(componentKey)
          description['fea'] = [...description['fea'], ...bodyValue?.components[componentKey]?.features]
          description['cxf'] = [
            ...description['cxf'], 
            ...bodyValue?.components[componentKey]?.features.map(f => `${componentKey} is ${f}`)
          ]
        }

        this.updateStatsWithAnnotation(description, bodyValue.character, bodyValue.script, bodyValue.tags, bodyValue?.components)

        let img = annotation.target[0].source
        let inscriptionNumber = img.replace(/^.*\/(ISic\d+)\/.*$/g, '$1')
        let inscriptionMeta = this.inscriptionsMeta[inscriptionNumber]
        if (inscriptionMeta) {
          description['pla'] = inscriptionMeta.origin_place
          description['mat'] = inscriptionMeta.support_material
          description['wme'] = inscriptionMeta.writting_method
          description['daf'] = inscriptionMeta.origin_date_from
          description['dat'] = inscriptionMeta.origin_date_to
        }

        // only keep distinct features
        description['fea'] = [...new Set(description['fea'])]
        this.annotations.push({
          'id': annotation.id,
          'chr': bodyValue.character,
          'scr': scriptName,
          'tag': bodyValue.tags,
          'doc': annotation.target[1]?.source,
          'img': annotation.target[0].source,
          'box': annotation.target[0].selector.value,
          ...description
        })
      }

      // collect all unique tags
      // if (bodyValue?.tags) {
      //   for (let tag of bodyValue?.tags) {
      //     this.tags.push(tag)
      //   }
      // }
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
    this.definitions = utils.readJsonFile(DEFINITIONS_PATH)    
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
    }
  }

  updateStatsWithAnnotation(description, character, script, tags, components) {
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
  }

  updateStatsWithFacetOption(facet, option) {
    this.stats[facet][option] = (this.stats[facet][option] || 0) + 1
  }

  build(annotations_path) {

    this.loadDefinitions()

    this.indexCollection = utils.readJsonFile(PATH_INDEX_COLLECTION)
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

    console.log('DONE ')
  }

  writeIndexFiles() {
    this.writeJsonFile(this.annotations, this.path, `${this.annotations.length} annotation(s)`)

    this.writeJsonFile(this.stats, STATS_PATH, 'definition stats.')

    this.writeJsonFile(this.messages, TESTS_PATH, `${this.messages.length} messages`)
  }

  writeJsonFile(obj, path, description='') {
    obj = {
      'meta': {
        "@context": "http://schema.org",
        'dc:modified': new Date().toISOString(),
        'dc:creator': 'https://github.com/kingsdigitallab/crossreads/blob/main/tools/index.mjs',
        'dc:source': 'https://github.com/kingsdigitallab/crossreads/tree/main/annotations',
      },
      'data': obj
    }
    let content = JSON.stringify(obj, null, COMPRESS_OUTPUT ? 0 : 2)
    fs.writeFileSync(path, content)
    console.log(`WRITTEN ${path}, ${description}, ${(content.length / 1024 / 1024).toFixed(2)} MB.`)
  }

}

const index = new AnnotationIndex(INDEX_PATH)
index.build(ANNOTATIONS_PATH)
