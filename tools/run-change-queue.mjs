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
      utils.writeJsonFile(filePath, content)
    }
  }

  readAnnotationFile(filename) {
    let filePath = `${ANNOTATIONS_PATH}/${filename}`
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
    if (change.tags) {
      let annotationValue = annotation.body[0].value
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
    } else {
      throw new Error('WARNING: no tags in change.')
    }
    annotation.modifiedBy = change.creator
    annotation.modified = change.created
  }

}

let runner = new ChangeQueueRunner()
let changeCount = runner.run()

console.log(`done (${changeCount} change(s))`)
