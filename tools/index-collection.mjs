// index metadata found in the ISicily inscription TEI files into index-collection.json.

import fs from 'fs';
import path from "path";
import { utils } from "../app/utils.mjs";
import { xmlUtils } from "../app/xml-utils.mjs";
const HELP = 'Test that the encoding of the TEI corpus allows word and sign segmentation.'

const DOWNLOAD_CORPUS = 'git clone https://github.com/ISicily/ISicily'
const UPDATE_CORPUS = 'cd ISicily && git pull'
const DTS_COLLECTION_JSON='../app/data/2023-08/inscriptions.json'

const TEI_FOLDER = './ISicily/inscriptions/'

const COMPRESS_OUTPUT = false
const PATH_INDEX_COLLECTION = 'index-collection.json'

async function readJsonFile(path) {
  let content = fs.readFileSync(path);
  return JSON.parse(content)
}

async function writeJsonFile(path, obj, description='') {
  let content = JSON.stringify(obj, null, COMPRESS_OUTPUT ? 0 : 2)
  fs.writeFileSync(path, content)
  console.log(`WRITTEN ${path}, ${description}, ${(content.length / 1024 / 1024).toFixed(2)} MB.`)
}

async function downloadCorpus() {
  if (!fs.existsSync(TEI_FOLDER)) {
    console.log(`Cloning corpus repository...`)
    await utils.exec(DOWNLOAD_CORPUS)
  } else {
    console.log(`Update corpus clone...`)
    await utils.exec(UPDATE_CORPUS)
  }
}

async function indexCollection() {
  let ret = 0

  await downloadCorpus()

  let data = {}

  let shortList = ['ISic000016']
  shortList = null

  let total = 0
  for (let filename of fs.readdirSync(TEI_FOLDER).sort()) {
    let iSicCode = filename.replace('.xml', '')
    if (shortList && !shortList.includes(iSicCode)) continue;

    let filePath = path.join(TEI_FOLDER, filename);
    if (filePath.endsWith('.xml') && !fs.lstatSync(filePath).isDirectory()) {
      console.log(filePath)
      total += 1

      let metadata = {
        'inscription_number': iSicCode,
      }

      let xml = await xmlUtils.fromString(filePath)
      let val = ''

      val = xmlUtils.xpath(xml, "//tei:layoutDesc//tei:rs//text()")
      metadata['writting_method'] = xmlUtils.toString(val) || 'unspecified'
      // ret = ret.replace(/\s+/g, ' ')
      val = xmlUtils.xpath(xml, "//tei:history/tei:origin/tei:origPlace/tei:placeName[@type='ancient']//text()")
      metadata['origin_place'] = xmlUtils.toString(val) || 'unspecified'
      val = xmlUtils.xpath(xml, "string((//tei:history/tei:origin/tei:origDate/@notBefore-custom)[1])")[0]
      metadata['origin_date_from'] = val ? parseInt(val) : 0
      val = xmlUtils.xpath(xml, "string((//tei:history/tei:origin/tei:origDate/@notAfter-custom)[1])")[0]
      metadata['origin_date_to'] = val ? parseInt(val) : 1000
      val = xmlUtils.xpath(xml, "//tei:material//text()")
      metadata['support_material'] = xmlUtils.toString(val).trim() || 'unspecified'
      val = xmlUtils.xpath(xml, "//tei:objectType//text()")
      metadata['object_type'] = xmlUtils.toString(val).trim() || 'unspecified'
  
      data[iSicCode] = metadata
    }
  }

  let index = {
    'meta': {
      "@context": "http://schema.org",
      'dc:modified': new Date().toISOString(),
      'dc:creator': 'https://github.com/kingsdigitallab/crossreads/blob/main/tools/indexCollection.mjs',
      'dc:source': 'https://github.com/ISicily/ISicily/tree/master/inscriptions',
    },
    data: data
  }

  writeJsonFile(PATH_INDEX_COLLECTION, index, `${total} inscriptions`)

  ret = 0
  return ret
}

async function start() {
  process.exitCode = await indexCollection()
}

start()
