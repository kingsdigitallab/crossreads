/*
TODO
M git workflow
S error management
D read annotations from folder
S add metadata to index
S index of tags
S all annotations should have a DTS target even if not letter bound
C remove decimals from region
C shorter id?
C include the letter and word in the dts selector?
*/
const fs = require('fs');
const path = require("path");

const INDEX_PATH = '../app/index.json'
const ANNOTATIONS_PATH = '../annotations'

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
    // }

    if (!fs.existsSync(filePath)) return
    let content = fs.readFileSync(filePath, {encoding:'utf8', flag:'r'})
    content = JSON.parse(content)

    for (let annotation of content) {
      let bodyValue = annotation?.body[0]?.value
      if (bodyValue?.character) {
        this.annotations.push({
          'id': annotation.id,
          'chr': bodyValue.character,
          'scr': bodyValue.script,
          'tag': bodyValue.tags,
          'doc': annotation.target[1]?.source,
          'img': annotation.target[0].source,
          'box': annotation.target[0].selector.value
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

  build(annotations_path) {

    for (let filename of fs.readdirSync(annotations_path).sort()) {
      let filePath = path.join(annotations_path, filename);
      if (filePath.endsWith('.json') && !fs.lstatSync(filePath).isDirectory()) {
        this.addAnnotationsFromFile(filePath)
      }
    }

    this.write()
  }

  write() {
    fs.writeFileSync(this.path, JSON.stringify(this.annotations, null, COMPRESS_OUTPUT ? 0 : 2))
    console.log(`WRITTEN ${this.path}, ${this.annotations.length} annotation(s).`)
  }

}

const index = new AnnotationIndex(INDEX_PATH)
index.build(ANNOTATIONS_PATH)
