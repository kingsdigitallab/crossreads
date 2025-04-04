/*
Input: an inscription code like 'ISic000085'
Output: a TEI snippet following this template

<p>Types list:
  <ref target="PREFIX/data/allographs/types/latin-1-A-type1.1.html">A type 1</ref>
  <ref target="......">B type 3</ref>
</p>
*/

import fs from 'node:fs';
import path from "node:path";
import { FILE_PATHS, utils } from "../app/utils.mjs";
import * as toolbox from './toolbox.mjs'


const ANNOTATIONS_PATH = '../annotations'

async function main() {
  // read the json from the variant rules file
  const variantRules = utils.readJsonFile(`../${FILE_PATHS.VARIANT_RULES}`)

  // console.log(variantRules)

  let inscriptions = []

  for (let file of fs.readdirSync(ANNOTATIONS_PATH)) {
    if (!file.includes('.json')) continue;

    let inscription = {
      id: utils.getDocIdFromString(file)
    }
    if (!inscription.id) continue;
    
    const annotations = utils.readJsonFile(path.join(ANNOTATIONS_PATH, file))
    if (annotations && !Array.isArray(annotations)) continue;
    const types = utils.getAlloTypesFromAnnotations(annotations, variantRules);
    inscription.snippet = utils.getTEIfromAlloTypes(types)

    if (inscription.snippet) {
      inscriptions.push(inscription)
    }
  }

  const outputXml = toolbox.renderTemplate('allo-types-from-insc.liquid', {inscriptions: inscriptions})

  // toolbox.isXMLWellFormed(outputXml)
  
  console.log(outputXml)
}

main()
