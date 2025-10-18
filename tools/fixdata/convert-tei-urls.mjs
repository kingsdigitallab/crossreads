import { ConvertURLs } from './convert-urls.mjs';


class ConvertAnnotationURLs extends ConvertURLs {

    convertAnnotation(filePath, annotation, convertFromAndTo=[]) {
        let ret = 0

        for (let target of annotation?.target ?? []) {
            if (target?.selector?.type === 'XPathSelector') {
                if (convertFromAndTo?.length) {
                    if (target.source.startsWith(convertFromAndTo[0])) {
                        target.source = convertFromAndTo[1] + target.source.substring(convertFromAndTo[0].length)
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
        if (indexItem?.doc) {
            let pattern = indexItem.doc.replace(/isic\d+\b.*$/i, '')
            if (pattern !== indexItem.doc) this.addPattern(pattern, `items in ${filePath}`, indexItem.id)
        }
    }

    showScriptDescription() {
        console.log(`Check or replace prefix of the TEI URL in the data files`)
        console.log(`like annotation files, search index and thumbs index.\n`)        
    }

}

let converter = new ConvertAnnotationURLs()
converter.run()

// Example:
//  node convert-img-urls.mjs https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF= http://localhost:4000/images
