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
const fs = require('fs');

const utils = require("../app/utils");
const path = require("path");

const INDEX_PATH = '../app/index.json'
const ANNOTATIONS_PATH = '../annotations'
const DEFINITIONS_PATH = '../app/data/pal/definitions-digipal.json'

// Set to true to minify the index.json output.
// false to make it more readable for debugging purpose.
const COMPRESS_OUTPUT = false

class AnnotationIndex {
  annotations = []
  tags = {}

  constructor(path) {
    this.path = path
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

  async loadDefinitions() {
    this.definitions = utils.readJsonFile(DEFINITIONS_PATH)    
  }

  build(annotations_path) {

    this.loadDefinitions()

    for (let filename of fs.readdirSync(annotations_path).sort()) {
      let filePath = path.join(annotations_path, filename);
      if (filePath.endsWith('.json') && !fs.lstatSync(filePath).isDirectory()) {
        this.addAnnotationsFromFile(filePath)
      }
    }

    this.write()
  }

  write() {
    let content = JSON.stringify(this.annotations, null, COMPRESS_OUTPUT ? 0 : 2)
    fs.writeFileSync(this.path, content)
    console.log(`WRITTEN ${this.path}, ${this.annotations.length} annotation(s), ${(content.length / 1024 / 1024).toFixed(2)} MB.`)
  }

}

const index = new AnnotationIndex(INDEX_PATH)
index.build(ANNOTATIONS_PATH)
