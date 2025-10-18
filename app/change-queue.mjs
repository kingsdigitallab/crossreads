import { FILE_PATHS} from "./utils.mjs";
import { AnyFileSystem } from "./any-file-system.mjs";

const SHA_UNREAD = 'SHA_UNREAD'

export class ChangeQueue {
  /*
  Manages a queue a changes to the data.

  change-queue.json contains the list of outstanding changes.
  */

  constructor(queuePath=null) {
    this.setQueuePath(queuePath)
    this.sha = SHA_UNREAD
    this.afs = new AnyFileSystem()
    this.changes = []
    this.clear()
  }

  async authenticateToGithub(gitToken) {
    await this.afs.authenticateToGithub(gitToken)
  }

  setQueuePath(queuePath=null) {
    this.queuePath = queuePath ?? FILE_PATHS.CHANGE_QUEUE
  }

  async load() {
    let res = await this.afs.readJson(this.queuePath)
    if (res?.ok) {
      this.changes = res.data?.changes || []
      this.sha = res.sha
    }

    return res
  }

  async save() {
    let content = {
      changes: this.changes
    }
    // console.log(JSON.stringify(content, null, 2))
    let res = await this.afs.writeJson(this.queuePath, content, this.sha)
    if (res?.ok) {
      this.sha = res.sha
    }

    return res    
  }

  filter(changeType) {
    return this.changes.filter(c => c?.changeType === changeType)
  }

  addChange(change) {
    if (!change.created) {
      change.created = new Date().toISOString()
    }
    if (!change.creator) {
      change.creator = this.afs.getUserId()
    }
    this.changes.push(change)
  }

  removeLastChange() {
    this.changes.pop()
  }

  setChanges(changes) {
    this.changes = changes
    return changes
  }

  length() {
    return this.changes.length
  }

  clear() {
    this.changes.length = 0
  }

  getChanges() {
    return this.changes
  }

  getFileSystem() {
    return this.afs.guessSystemFromPath(this.queuePath)
  }

}

/* Example of a change queue with three outstanding changes.
  First change sets a component and feature pair to one annotation.
  Second change promotes two types to a new character.
  Third change removes one tag from an annotion.
*/
const SAMPLE_CHANGE_QUEUE = {
  "changes": [
    {
      "changeType": "changeAnnotations",
      "creator": "https://api.github.com/users/simonastoyanova",
      "created": "2025-07-10T15:10:53.820Z",
      "annotations": [
        {
          "id": "https://crossreads.web.ox.ac.uk/annotations/9b767927-5f4d-48a6-9761-98715bab0551",
          "file": "http-sicily-classics-ox-ac-uk-inscription-isic003031-isic003031-jpg.json"
        }
      ],
      "componentFeatures": [
        [
          "left-bar",
          "diagonal"
        ]
      ]
    },
    {
      "changeType": "changeAnnotations",
      "annotations": [
        {
          "id": "https://crossreads.web.ox.ac.uk/annotations/956150df-f389-4a0b-bef1-2666a8ff0004",
          "file": "http-sicily-classics-ox-ac-uk-inscription-isic000099-isic000099-jpg.json"
        }
      ],
      "creator": "https://api.github.com/users/simonastoyanova",
      "created": "2025-07-07T15:05:05.293Z",
      "tags": [
        "-type1.2"
      ]
    },    
    {
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
    },
  ]
}
