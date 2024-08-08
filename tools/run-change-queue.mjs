import * as fs from 'fs';
import * as path from 'path';
import { utils } from "../app/utils.mjs";

const ANNOTATIONS_PATH = '../annotations'
const CHANGE_QUEUE_PATH = `${ANNOTATIONS_PATH}/change-queue.json`

class ChangeQueueRunner {

  run() {
    let queue = utils.readJsonFile(CHANGE_QUEUE_PATH)
    let ret = 0
    let changes = queue.changes
    if (changes) {
      ret = changes.length;
      for (let change of changes) {
        this.applyChangeToAnnotationFiles(change)
      }
    }
    this.empty()
    return ret
  }

  empty() {
    utils.writeJsonFile(CHANGE_QUEUE_PATH, {})
  }

  applyChangeToAnnotationFiles(change) {
    // TODO: group by file and write them once
    for (let annotationRef of change.annotations) {
      let filePath = `${ANNOTATIONS_PATH}/${annotationRef.file}`
      let content = utils.readJsonFile(filePath)
      for (let annotation of content) {
        if (annotation.id === annotationRef.id) {
          this.applyChangeToAnnotation(change, annotation)
        }
      }
      utils.writeJsonFile(filePath, content)
    }
  }

  applyChangeToAnnotation(change, annotation) {
    if (change.tags) {
      let tagsSet = new Set(annotation.tags || [])
      for (let tag of change.tags) {
        if (tag.startsWith('-')) {
          tagsSet.delete(tag.substring(1))
        } else {
          tagsSet.add(tag)
        }
      }
      if (tagsSet.size) {
        annotation.tags = [...tagsSet]
      } else {
        delete annotation.tags
      }
    }
    annotation.modifiedBy = change.creator
    annotation.modified = change.created
  }

}

let runner = new ChangeQueueRunner()
let changeCount = runner.run()

console.log(`done (${changeCount} change(s))`)
