// index metadata found in the ISicily inscription TEI files into index-collection.json.

import fs from 'fs';
import path from "path";
import { utils, FILE_PATHS } from "../app/utils.mjs";
import { xmlUtils } from "../app/xml-utils.mjs";

const DOWNLOAD_CORPUS = 'git clone https://github.com/ISicily/ISicily'
const UPDATE_CORPUS = 'cd ISicily && git pull'

const TEI_FOLDER = './ISicily/inscriptions/'

const COMPRESS_OUTPUT = false

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

  let shortList = ['ISic020600', 'ISic001132']
  shortList = null

  let notWellFormedFiles = []

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

      let xml = null
      try {
        xml = await xmlUtils.fromString(filePath)
      } catch (e) {
        notWellFormedFiles.push(filePath)
        console.log(`ERROR: could not parse XML from ${filePath}. Type: ${e.name}. Cause: ${e.message}`)
        continue
      }
      let val = ''

      metadata['writting_method'] = getMultipleValuesFromXML(xml, "//tei:layoutDesc//tei:rs//text()")
      
      // ret = ret.replace(/\s+/g, ' ')
      // val = xmlUtils.xpath(xml, "//tei:history/tei:origin/tei:origPlace/tei:placeName[@type='ancient']//text()")
      // metadata['origin_place'] = xmlUtils.toString(val) || 'unspecified'

      metadata['origin_place'] = getMultipleValuesFromXML(xml, "//tei:history/tei:origin/tei:origPlace/tei:placeName[@type='ancient']//text()")

      val = xmlUtils.xpath(xml, "string((//tei:history/tei:origin/tei:origDate/@notBefore-custom)[1])")[0]
      metadata['origin_date_from'] = val ? parseInt(val) : 0
      val = xmlUtils.xpath(xml, "string((//tei:history/tei:origin/tei:origDate/@notAfter-custom)[1])")[0]
      metadata['origin_date_to'] = val ? parseInt(val) : 1000
      val = xmlUtils.xpath(xml, "//tei:material//text()")
      metadata['support_material'] = xmlUtils.toString(val).trim() || 'unspecified'
      val = xmlUtils.xpath(xml, "//tei:objectType//text()")
      metadata['object_type'] = xmlUtils.toString(val).trim() || 'unspecified'
  
      data[iSicCode.toLowerCase()] = metadata
    }
  }

  function getMultipleValuesFromXML(xml, xpath) {
    let ret = []
    let vals = xmlUtils.xpath(xml, xpath)
    if (vals && vals.length) {
      vals.forEach(v => ret.push(xmlUtils.toString(v).toLowerCase()))
    } else {
      ret.push('unspecified')
    }
    return ret
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

  utils.writeJsonFile('INDEX_COLLECTION', index, `${total} inscriptions`)

  if (notWellFormedFiles.length) {
    console.log(`Following files were not loaded properly: ${notWellFormedFiles}.`)
  }

  ret = 0
  return ret
}

async function start() {
  process.exitCode = await indexCollection()
}

start()
