import * as path from 'path';
import * as fs from 'fs';
import { utils, FILE_PATHS, SETTINGS } from '../../app/utils.mjs';
import { fileURLToPath } from 'url';
import { ConvertURLs } from './convert-urls.mjs';


class ConvertAnnotations extends ConvertURLs {

    convertAnnotation(filePath, annotation, convertFromAndTo=[]) {
        let ret = 0

        if (annotation?.id) {
            if (convertFromAndTo?.length) {
                if (annotation.id.startsWith(convertFromAndTo[0])) {
                    annotation.id = convertFromAndTo[1] + target.source.substring(convertFromAndTo[0].length)
                    ret += 1
                }
            }
            let pattern = annotation.id.replace(/[^/]+\/?$/i, '')
            if (pattern !== annotation.id) this.addPattern(pattern, 'annotation files', filePath)
        }

        return ret
    }

    checkIndexItem(filePath, indexItem) {
        if (indexItem?.id) {
            let pattern = indexItem.id.replace(/[^/]+\/?$/i, '')
            if (pattern !== indexItem.id) this.addPattern(pattern, `items in ${filePath}`, indexItem.id)
        }
    }

    showScriptDescription() {
        console.log(`Check or replace prefix of the annotation IDs in the data files`)
        console.log(`like annotation files, search index and thumbs index.\n`)        
    }

}

let converter = new ConvertAnnotations()
converter.run()

// Example:
//  node convert-img-urls.mjs https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF= http://localhost:4000/images
