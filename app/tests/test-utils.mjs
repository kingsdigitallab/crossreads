import { utils, FILE_PATHS } from "../../app/utils.mjs";

let func = utils.getDocIdFromString
let funcName = 'getDocIdFromString'

let cases = [
  [['ISic020317'], 'isic020317'],
  [['Sic020317'], ''],
  [['Isic020317'], 'isic020317'],
  [['Isic020317', false], 'isic020317'],
  [['Isic020317', true], 'ISic020317'],
  [['http-sicily-classics-ox-ac-uk-inscription-isic003367-isic003367-jpg.json', true], 'ISic003367'],
  [['http-sicily-classics-ox-ac-uk-inscription-isic003367-isic003367-jpg.json'], 'isic003367'],
  [['http-sicily-classics-ox-ac-uk-inscription-isic003367-isic003368-jpg.json'], 'isic003367'],
]

for (let acase of cases) {
  let res = func(...acase[0])
  if (res !== acase[1]) {
    console.log(`FAIL: call ${funcName}(${acase[0]}) returns ${res} expected ${acase[1]}`)
  }
}

