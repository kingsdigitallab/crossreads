import { Liquid } from 'liquidjs'

export function renderTemplate(templateName, context) {
    const engine = new Liquid({
        root: './templates/'
    })
    return engine.renderFileSync(templateName, context)
}

// export function isXMLWellFormed(xmlString) {
//     let ret = false

//     const parser = new DOMParser();
//     try {
//         const doc = parser.parseFromString(xmlString, 'application/xml');
//         if (doc.getElementsByTagName('parsererror').length === 0) {
//             ret = true
//             console.log('XML is well-formed.');
//         } else {
//             console.log('XML is not well-formed.');
//         }
//     } catch (e) {
//         console.log('XML is not well-formed.');
//     }

//     return ret
// }
