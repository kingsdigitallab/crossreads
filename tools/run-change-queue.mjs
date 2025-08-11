import { utils, FILE_PATHS, DEBUG_DONT_SAVE } from "../app/utils.mjs";

// TODO: use ChangeQueue class

const PATH_PREFIX = '../'

class ChangeQueueRunner {

  run() {
    this.definitions = utils.readJsonFile(`${PATH_PREFIX}${FILE_PATHS.DEFINITIONS}`)

    let queue = utils.readJsonFile(`${PATH_PREFIX}${FILE_PATHS.CHANGE_QUEUE}`)
    let ret = 0
    let changes = queue.changes
    if (changes) {
      ret = changes.length;
      for (let change of changes) {
        this.applyChange(change)
      }
    }
    this.empty()
    return ret
  }

  empty() {
    if (!DEBUG_DONT_SAVE) {
      utils.writeJsonFile(`${PATH_PREFIX}${FILE_PATHS.CHANGE_QUEUE}`, {})
    } else {
      console.log('WARNING: nothing written as DEBUG_DONT_SAVE = true.')
    }
  }

  applyChange(change) {
    let ret = false

    if (change.changeType === 'promoteTypesToCharacter') {
      this.promoteTypesToCharacter(change)
      ret = true
    }

    if (change.changeType === 'changeAnnotations')  {
      ret = true

      // TODO: group by file and write them once
      for (let annotationRef of change.annotations) {
        let res = this.readAnnotationFile(annotationRef.file)
        let filePath = res[0]
        let content = res[1]
        let found = false
        for (let annotation of content) {
          if (annotation.id === annotationRef.id) {
            this.applyChangeToAnnotation(change, annotation)
            found = true
          }
        }
        if (!found) {
          // not necessarily an error, 
          // the ann may have been deleted by user after change was queued
          throw new Error(`ERROR: annotation not found. (${filePath})`)
        }
        if (!DEBUG_DONT_SAVE) {
          utils.writeJsonFile(filePath, content)
        }
      }
    }

    if (!ret) {
      throw new Error(`ERROR: unrecognised change.changeType: ${change.changeType}`)
    }

    return ret
  }

  readAnnotationFile(filename) {
    let filePath = `${PATH_PREFIX}/annotations/${filename}`
    let content = utils.readJsonFile(filePath)
    if (!content) {
      console.log(`WARNING: annotation file not found. (${filePath})`)
      // TODO: fix invalid file name in search.mjs
      // gh-70: convert invalid file name
      filePath = filePath.replace(
        'https-crossreads-web-ox-ac-uk-api-dts-documents-id-', 
        'http-sicily-classics-ox-ac-uk-inscription-'
      )
      content = utils.readJsonFile(filePath)
      if (!content) {
        throw new Error(`ERROR: annotation file not found. (${filePath})`)
      }
    }
    return [filePath, content]
  }

  applyChangeToAnnotation(change, annotation) {
    let annotationValue = annotation.body[0].value

    let hasChange = false

    if (change?.tags) {
      hasChange = true

      // example: change.tags = ['tag1', '-tag2']
      let tagsSet = new Set(annotationValue.tags || [])
      for (let tag of change.tags) {
        if (tag.startsWith('-')) {
          tagsSet.delete(tag.substring(1))
        } else {
          tagsSet.add(tag)
        }
      }
      if (tagsSet.size) {
        annotationValue.tags = [...tagsSet]
      } else {
        delete annotationValue.tags
      }
    }

    if (change?.componentFeatures) {
      /*
        Example input:

        annotationValue = {
          "script": "latin",
          "components": {
            "downstroke": {
              "features": [
                "on-baseline",
                "serif",
                "straight",
                "vertical"
              ]
            },
            "bowl": {
              "features": [
                "open",
                "rounded"
              ]
            }
          },
          "tags": [
            "serif.curved",
            "serif.slab"
          ],
          "character": "P"
        }

        change.componentFeatures = [
          ['downstroke', 'curved'], // add feature1 to component1
          ['downstroke', '-serif'], // remove feature6 from component1
          ['bowl', '-ALL']          // remove all features from component5
        ]
      */
     
      if (!annotationValue.components) {
        annotationValue.components = {}
      }

      hasChange = true

      for (let componentFeature of change.componentFeatures) {        
        let component = componentFeature[0]
        let feature = componentFeature[1].trim()

        let annotationComponent = annotationValue.components[component]
        if (feature.startsWith('-')) {
          // remove the feature
          if (annotationComponent?.features) {
            feature = feature.substring(1)
            annotationComponent.features = annotationComponent.features.filter(f => f !== feature)              
            if ((feature === 'ALL') || (annotationComponent.features.length === 0)) {
              // TODO: test this
              delete annotationValue.components[component]
            }
          }
        } else {
          // add the feature
          if (this.isCharacterComponentFeatureDefined(annotationValue.script, annotationValue.character, component, feature)) {
            if (!annotationComponent) {
              annotationComponent = {}
              annotationValue.components[component] = annotationComponent
            }
            if (!annotationComponent.features) {
              annotationComponent.features = []
            }
            if (!annotationComponent.features.includes(feature)) {
              annotationComponent.features.push(feature)
            }
          } else {
            console.log(`WARNING: can't set ${annotationValue.character}.${component} = ${feature}, no such definition. Annotation ${annotation.id}.`)
          }
        }
      }

    }

    if (!hasChange) {
      throw new Error(`change item has no action (e.g. .tags or .componentFeatures)`)
    }

    annotation.modifiedBy = change.creator
    annotation.modified = change.created
  }

  isCharacterComponentFeatureDefined(script, character, component, feature) {
    // check character x component
    // check component x feature
    let ret = false
    let characterKey = `${character}-${script}`
    let characterDefinition = this.definitions.allographs[characterKey]
    if (characterDefinition) {
      if (characterDefinition.components.includes(component)) {
        if (this.definitions.components[component]) {
          ret = this.definitions.components[component].features.includes(feature)
        }
      }
    }
    return ret
  }

  promoteTypesToCharacter(change) {
    const EXAMPLE_CHANGE = {
      "changeType": "promoteTypesToCharacter",
      "types": [
          {
              "variantName": "type1",
              "script": "greek",
              "character": "Ω"
          },
          {
              "variantName": "type2",
              "script": "greek",
              "character": "Ω"
          }
      ],
      "character": "Ω1+2",
      "script": "greek"
    }
    
  }

}

let runner = new ChangeQueueRunner()
let changeCount = runner.run()

console.log(`done (${changeCount} change(s))`)
