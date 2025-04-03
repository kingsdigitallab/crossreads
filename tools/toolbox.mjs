import { Liquid } from 'liquidjs'

export function renderTemplate(templateName, context) {
    const engine = new Liquid({
        root: './templates/'
    })
    return engine.renderFileSync(templateName, context)
}
