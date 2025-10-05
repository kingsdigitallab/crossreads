/* Convert the annotation files 
to refer to the token in the TEI
by the new @n attribute 
instead of the @id attribute (old system).

For details, see:
https://github.com/kingsdigitallab/crossreads/issues/108

This script can also be used to
detect and report issues with the
reference from the annotations
to the signs in the TEI texts
in both the old and new system.
*/
import fs from 'fs';
import path from "path";
import { xmlUtils } from "../../app/xml-utils.mjs";
import { parseCommandLineArgs } from "../toolbox.mjs"

const TEI_FOLDER = '../ISicily/inscriptions/'

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
          }
        }
      }
      if (args.options['-g']) {
        // console.log(JSON.stringify(values, null, 2))
        console.log(values)
      }
    } else {
      this.showHelp(args)
    }
  }

  showHelp(args) {
    console.log(`Usage: ${args.scriptName} ACTION [ARG...] [OPTIONS...]\n`)
    console.log(`List TEI files matching a given xpath selector.\n`)
    console.log(`ACTIONS:\n`)
    console.log(`  xpath XPATH: run XPATH on TEI corpus\n`)
    console.log(`OPTIONS:\n`)
    console.log(`  -v:            more verbose output`)
    console.log(`  -g:            show grouped matches and frequencies`)
    console.log(`  -f SUBSTRINGS: file name must contain SUBSTRINGS\n`)
  }

}

const xgrep = new XGrep()
await xgrep.run()
