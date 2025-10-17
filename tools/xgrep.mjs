/*
Run a user-given xpath selector on all XML files in a folder.
For usage see showHelp() below.
*/
import fs from 'node:fs';
import path from "node:path";
import { xmlUtils } from "../app/xml-utils.mjs";
import { parseCommandLineArgs } from "./toolbox.mjs"

const TEI_FOLDER = 'ISicily/inscriptions/'

class XGrep {

  async run() {
    let args = parseCommandLineArgs()

    if (args.action === 'xpath') {
      let filters = args.options['-f'] ?? []

      let xpath = args.params[0]
      if (!xpath) {
        console.log('Please provide a xpath selector')
        process.exit()
      }

      let values = {}

      for (let xmlFileName of fs.readdirSync(TEI_FOLDER).sort()) {
        if (!filters.every(f => xmlFileName.includes(f))) continue;

        let xmlFilePath = path.join(TEI_FOLDER, xmlFileName)
        let xmlString = fs.readFileSync(xmlFilePath, {encoding:'utf8', flag:'r'})
        let xml = null
        try {
          xml = await xmlUtils.fromString(xmlString)
        } catch (error)  {
          if (error instanceof xmlUtils.XError) {
            console.log(`WARNING: ${xmlFileName} was not parsed properly by SaxonJS.`)
            continue
          } else {
            throw error
          }
        }
        let nodes = await xmlUtils.xpath(xml, xpath)

        if (nodes?.length) {
          console.log(`${xmlFileName}: ${nodes.length} matches`)
          for (let node of nodes) {
            let rep = xmlUtils.toString(node)
            values[rep] = (values[rep] ?? 0) + 1
            if (args.verbosity > 0) {
              console.log(rep)
            }
          }
        }
      }
      if (args.options['-gj']) {
        console.log(JSON.stringify(values, null, 2))
      }
      if (args.options['-g']) {
        console.log(values)
      }
    } else {
      this.showHelp(args)
    }
  }

  showHelp(args) {
    console.log(`Usage: ${args.scriptName} ACTION [ARG...] [OPTIONS...]\n`)
    console.log(`List TEI files matching a given xpath selector.`)
    console.log(`Input file: ${TEI_FOLDER}*.xml.\n`)
    console.log(`ACTIONS:\n`)
    console.log(`  xpath XPATH: run XPATH selector on TEI corpus\n`)
    console.log(`OPTIONS:\n`)
    console.log(`  -v:            show all matching XML nodes`)
    console.log(`  -g:            show grouped matches and frequencies`)
    console.log(`  -gj:           show grouped matches and frequencies in json`)
    console.log(`  -f SUBSTRINGS: input file names must contain SUBSTRINGS\n`)
    console.log(`Frequencies are the number of nodes matching the selector.\n`)
  }

}

const xgrep = new XGrep()
await xgrep.run()
