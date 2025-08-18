import { utils, FILE_PATHS, DEBUG_DONT_SAVE } from "../app/utils.mjs";
import { ChangeQueue } from "../app/change-queue.mjs";
import fs from 'fs';
import path from "path";

const PATH_PREFIX = '../'

const CROSSREADS_AUTOMATION_USER_ID = "https://api.github.com/users/crossreads-bot"

class ApplyError extends Error {
}

class ChangeQueueRunner {

  constructor() {
    this.queue = new ChangeQueue(`${PATH_PREFIX}${FILE_PATHS.CHANGE_QUEUE}`) 
  }

  async run() {
    this.definitions = utils.readJsonFile(`${PATH_PREFIX}${FILE_PATHS.DEFINITIONS}`)
    this.variantRules = utils.readJsonFile(`${PATH_PREFIX}${FILE_PATHS.VARIANT_RULES}`)

    await this.queue.load()

    let changeCount = this.queue.length()

    let changes = this.queue.getChanges()

    // some types of changes will be processed after the others.
    // otherwise they may invalidate following changes.
    // that's b/c the web app doesn't apply those types of changes to the data.
    this.nextPassChanges = []
    this.currentPass = 1
    let appliedCount = 0

    while (true) {
      if (changes.length < 1) {
        if (this.nextPassChanges.length) {
          this.currentPass += 1
          changes = this.queue.setChanges(this.nextPassChanges)          
        } else {
          break
        }
      }

      let change = changes.shift()

      try {
        let wasApplied = this.applyChange(change)
        if (wasApplied) {
          appliedCount += 1
        }
      } catch (error) {
        if (error instanceof ApplyError) {
          console.log(`ERROR: ${error.message}`)
        }
        console.log(change)
        throw error
      }      
    }

    if (!DEBUG_DONT_SAVE) {
      await this.queue.save()
    }

    console.log(`done (${changeCount} change(s) = ${appliedCount} applied + ${changeCount - appliedCount} not applied)`)

    if (changeCount - appliedCount !== 0) {
      throw Error(`Not all changes have been applied`)
    }
  }

  applyChange(change) {
    // return true if the change has been applied
    let ret = false

    let recognisedType = false

    if (change.changeType === 'promoteTypesToCharacter') {
      recognisedType = true

      if (this.currentPass < 2) {
        this.nextPassChanges.push(change)
      } else {
        ret = true
        this.promoteTypesToCharacter(change)
      }
    }

    if (change.changeType === 'changeAnnotations')  {
      recognisedType = true

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
          // the annotations may have been deleted by user after change was queued.
          throw new ApplyError(`annotation not found. (${filePath})`)
        }
        if (!DEBUG_DONT_SAVE) {
          utils.writeJsonFile(filePath, content)
        }
      }
    }

    if (!recognisedType) {
      throw new ApplyError(`unrecognised change.changeType: ${change.changeType}`)
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
        throw new ApplyError(`annotation file not found. (${filePath})`)
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
      throw new ApplyError(`change item has no action (e.g. .tags or .componentFeatures)`)
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
          "variantName": "type2",
          "script": "greek",
          "character": "Ω"
        },
        {
          "variantName": "type1",
          "script": "greek",
          "character": "Ω"
        }
      ],
      "character": "Ω1+2",
      "script": "greek"
    }

    let characterDefinition = this.promoteCharacterDefinition(change)

    // This must be done BEFORE calling getVariantRulesFromChange()
    let changingRulesCopy = this.getVariantRulesFromChange(change)
    changingRulesCopy = JSON.parse(JSON.stringify(changingRulesCopy))

    let changingRules = this.getVariantRulesFromChange(change, true)    
    this.promoteTypesInRules(change, changingRules)

    let rulesCounts = this.promoteTypesInAnnotations(change, changingRulesCopy)

    console.log(rulesCounts)
  }

  promoteCharacterDefinition(change) {
    // get or create character in definitions
    let charKey = `${change.character}-${change.script}`
    let char = this.definitions.allographs[charKey]
    if (!char) {
      char = {
        'script': change.script,
        'character': change.character,
        'components': [],
      }
    }
    
    // ensures we include components from all promoted characters
    let components = [...char.components]
    for (let type of change.types) {
      let incomingComponents = this.definitions.allographs[`${type.character}-${type.script}`].components
      components = [...components, ...incomingComponents]
    }

    // save definitions
    char.components = [...new Set(components)]
    // console.log(charKey, char)
    this.definitions.allographs[charKey] = char
    this.definitions.updated = new Date().toISOString();
    if (!DEBUG_DONT_SAVE) {
      utils.writeJsonFile(`${PATH_PREFIX}${FILE_PATHS.DEFINITIONS}`, this.definitions)
    }
  }
  
  promoteTypesInRules(change, rules) {
    for (let rule of rules) {
      rule.script = change.script
      rule.allograph = change.character
    }

    if (!DEBUG_DONT_SAVE) {
      utils.writeJsonFile(`${PATH_PREFIX}${FILE_PATHS.VARIANT_RULES}`, this.variantRules)
    }
  }

  getVariantRulesFromChange(change, includeSubRules=false) {
    let ret = []

    for (let type of change.types) {
      for (let rule of this.variantRules) {
        if (rule.script === type.script && rule.allograph === type.character && (rule['variant-name'] +  '.').startsWith(type.variantName + '.')) {
          if (!includeSubRules && rule['variant-name'] !== type.variantName) continue;
          ret.push(rule)
        }
      }
    }

    return ret
  }
  
  promoteTypesInAnnotations(change, changingRulesCopy) {
    let ret = {}

    for (let filename of fs.readdirSync('../annotations').sort()) {
      let filePath = path.join('../annotations', filename);
      if (filePath.endsWith('.json') && !filePath.endsWith('change-queue.json') && !fs.lstatSync(filePath).isDirectory()) {
        let annotations = utils.readJsonFile(filePath)
        // console.log(filePath, changingRulesCopy.length)

        let hasChanged = false

        for (let annotation of annotations) {
          let macthingRule = this.promoteTypesInAnnotation(change, annotation, changingRulesCopy)
          
          if (macthingRule) {
            hasChanged = true
            let typeName = macthingRule["variant-name"]
            if (ret[typeName]) {
              ret[typeName] += 1
            } else {
              ret[typeName] = 1
            }
          }
        }

        if (hasChanged) {
          if (!DEBUG_DONT_SAVE) {
            utils.writeJsonFile(filePath, annotations)
          }
        }
      }
    }

    return ret
  }

  promoteTypesInAnnotation(change, annotation, changingRulesCopy) {
    let ret = null

    let bodyValue = annotation.body[0].value

    let rulesMatchingAnnotation = changingRulesCopy.filter(rule => {
      if (rule.script !== bodyValue.script || rule.allograph !== bodyValue.character) return false
      return rule['component-features'].every(cf => {
        let component = bodyValue.components[cf.component]
        if (!component) {
          console.log(`INFO: annotation ${annotation.id} is missing component ${cf.component}`)
        } else {
          return bodyValue.components[cf.component].features.includes(cf.feature)
        }
      })
    })

    if (rulesMatchingAnnotation.length > 1) {
      throw ApplyError(`Annotation ${annotation.id} matches more than one variant rule.`)
    }
    if (rulesMatchingAnnotation.length) {
      ret = rulesMatchingAnnotation[0]
    }

    if (ret) {
      bodyValue.script = change.script
      bodyValue.character = change.character
      annotation.modified = new Date().toISOString();
      annotation.modifiedBy = CROSSREADS_AUTOMATION_USER_ID;
    }

    return ret
  }

}

let runner = new ChangeQueueRunner()
await runner.run()

