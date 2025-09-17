import { utils, FILE_PATHS } from "../../app/utils.mjs";

function testFunction(functionPath, cases) {
  let failCount = 0
  let func = eval(functionPath)
  for (let acase of cases) {
    let res = func(...acase[0])
    if (JSON.stringify(res) !== JSON.stringify(acase[1])) {
      console.log(`FAIL: call ${functionPath}(${acase[0]}) returns ${res} expected ${acase[1]}`)
      failCount += 1
    }
  }
  
  console.log(`INFO: ${functionPath}: ${failCount} fails / ${cases.length} tests`)
}

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


testFunction('utils.getDocIdFromString', cases)

cases = [
  [[[275, 375], 50], [250, 400]],
  [[[-275, -375], 50], [-300, -350]],
  [[[-250, 350], 50], [-250, 350]],
  [[[-250, 350], 100], [-300, 400]],
]

testFunction('utils.clipDateRange', cases)

cases = [
  [[[-50, 100]], 'between 50 BC and AD 100'],
  [[[50, 100]], 'between AD 50 and AD 100'],
  [[[-100, -50]], 'between 100 BC and 50 BC'],
  [[[50, -100]], 'between 100 BC and AD 50'],
]

testFunction('utils.getDisplayDateRange', cases)
