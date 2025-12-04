import { ConvertURLs } from './convert-urls.mjs';


class ConvertAnnotationURLs extends ConvertURLs {

    convertAnnotation(filePath, annotation, convertFromAndTo=[]) {
        let ret = 0

        if (annotation?.id) {
            if (convertFromAndTo?.length) {
                if (annotation.id.startsWith(convertFromAndTo[0])) {
                    annotation.id = convertFromAndTo[1] + annotation.id.substring(convertFromAndTo[0].length)
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

let converter = new ConvertAnnotationURLs()
converter.run()

// Example:
//  node convert-annotation-url.mjs 
