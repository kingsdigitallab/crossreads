import { ConvertURLs } from './convert-urls.mjs';
import { SETTINGS } from '../../app/settings.mjs';


export class ConvertImageURLs extends ConvertURLs {

    convertAnnotation(filePath, annotation, convertFromAndTo=[]) {
        let ret = 0

        for (let target of annotation?.target ?? []) {
            if (target?.selector?.type === 'FragmentSelector') {
                if (convertFromAndTo?.length) {
                    if (target.source.startsWith(convertFromAndTo[0])) {
                        target.source = convertFromAndTo[1] + target.source.substring(convertFromAndTo[0].length)
                        // remove docid if no longer used 
                        // e.g. /ISic020304/ -> ''
                        if (!SETTINGS.IIIF_SERVER_OBJ_ID.includes('/{DOCID}/')) {
                            target.source = target.source.replace(/\/isic\d+\//i, '/')
                        }
                        ret += 1
                    }
                }
                let pattern = target.source.replace(/isic\d+\b.*$/i, '')
                if (pattern !== target.source) this.addPattern(pattern, 'annotation files', filePath)
            }
        }

        return ret
    }

    checkIndexItem(filePath, indexItem) {
        if (indexItem?.img) {
            let pattern = indexItem.img.replace(/isic\d+\b.*$/i, '')
            if (pattern !== indexItem.img) this.addPattern(pattern, `items in ${filePath}`, indexItem.id)
        }
    }

    showScriptDescription() {
        console.log(`Check or replace references to IIIF server in the data files`)
        console.log(`like annotation files, search index and thumbs index.\n`)        
    }
}

let converter = new ConvertImageURLs()
converter.run()

// Example:
//  node convert-img-urls.mjs https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF= http://localhost:4000/images
