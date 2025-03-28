// returns all the 

import fs from 'fs';
import path from "path";
import { FILE_PATHS, utils } from "../app/utils.mjs";

/*
Input: an inscription code like 'ISic000085'
Output: a TEI snippet following this template

<p>Types list:
  <ref target="PREFIX/data/allographs/types/latin-1-A-type1.1.html">A type 1</ref>
  <ref target="......">B type 3</ref>
</p>
*/

async function start() {
  // read the json from the variant rules file
  const variantRules = utils.readJsonFile(`../${FILE_PATHS.VARIANT_RULES}`)

  for (let file of fs.readdirSync('../annotations')) {
    if (!file.includes('.json')) continue;

    let docId = utils.getDocIdFromString(file)
    if (!docId) continue;
    
    let jsonData = fs.readFileSync(path.join('../annotations', file), 'utf-8')
    const annotations = JSON.parse(jsonData);
    if (annotations && !Array.isArray(annotations)) continue;
    const types = utils.getAlloTypesFromAnnotations(annotations, variantRules);
    // console.log(types);

    let res = utils.getTEIfromAlloTypes(types)

    if (res) {
      console.log(docId)
      console.log(res)
      console.log('-------------------------------------')
      // break;
    }
  }
}

start()
