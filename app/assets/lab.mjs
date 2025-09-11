/* 
TODO:
*/

import { utils, FILE_PATHS, DEBUG_DONT_SAVE, IS_BROWSER_LOCAL, SETTINGS} from "../utils.mjs";
import { AnyFileSystem } from "../any-file-system.mjs";
import { createApp, nextTick } from "vue";


createApp({
  data() {
    return {
      collectionIndex: {},
      inscriptionSets: [],
      places: [],
      selection: {
        tab: 'lab',
        tabEdit: 'tags', // either 'tags' or 'features'
        gtoken: window.localStorage.getItem('gtoken') || '',
      },
      // instance of AnyFileSystem, to access github resources
      afs: null,
      messages: [
      ],
      cache: {
      },
      user: null,
    }
  },
  async mounted() {
    await this.initAnyFileSystem()    
    await this.loadCollectionIndex()

    this.loadInscriptionSets()
  },
  watch: {
  },
  computed: {
    tabs: () => utils.tabs(),
    filteredInscriptionSets() {
      let ret = this.inscriptionSets
      return ret
    },
    lastMessage() {
      let ret = {
        content: '',
        level: 'info',
        created: new Date()
      }
      if (this.messages.length) {
        ret = this.messages[this.messages.length - 1]
      }
      return ret
    },
    canEdit() {
      return this.isLoggedIn
    },
    isLoggedIn() {
      return this.afs?.isAuthenticated()
    },
    isUnsaved() {
      return false
    },
  },
  methods: {
    async initAnyFileSystem() {
      this.afs = new AnyFileSystem()
      await this.afs.authenticateToGithub(this.selection.gtoken)
    },
    async loadCollectionIndex() {
      const res = await this.afs.readJson(FILE_PATHS.INDEX_COLLECTION)
      if (res.ok) {
        this.collectionIndex = res.data?.data ?? {}
      } else {
        this.logError('Failed to load collection index.')
      }
    },
    loadInscriptionSets(excludedId=null) {
      let storage_key = SETTINGS.BROWSER_STORAGE_INSCRIPTION_SETS
      let inscriptionSets = window.localStorage.getItem(storage_key) ?? '[]'
      this.inscriptionSets = JSON.parse(inscriptionSets)
      if (excludedId == 'union') {
        this.inscriptionSets = []
      } else {
        this.inscriptionSets = this.inscriptionSets.filter(iset => iset.id !== excludedId)
      }

      let ret = JSON.parse(JSON.stringify(this.inscriptionSets))

      this.addIntersectionSet()

      this.addUnionSet()

      this.addPlacesAndDateRangesToInscriptionSets()

      return ret
    },
    addPlacesAndDateRangesToInscriptionSets() {
      // add .places to each set, which is a dict placeName -> Array([min, max date])
      let places = []
      for (let iset of this.inscriptionSets) {
        iset.places = {}
        for (let inscriptionId of iset.inscriptions) {
          let inscriptionData = this.collectionIndex[inscriptionId]
          if (inscriptionData) {
            let place = inscriptionData['origin_place']
            let date_range = [inscriptionData['origin_date_from'], inscriptionData['origin_date_to']]
            if (place && !(date_range[0] == null) && !(date_range[1] == null)) {
              places[place] = 1
              if (!iset.places[place]) {
                iset.places[place] = []
              }
              iset.places[place].push(date_range)
            }
          }
        }
      }
      this.places = Object.keys(places)
    },
    addIntersectionSet() {
      if (this.inscriptionSets.length > 1) {
        let intersection = [...this.inscriptionSets[0].inscriptions]
        for (let aset of this.inscriptionSets) {
          intersection = intersection.filter(id => aset.inscriptions.includes(id))
        }
        this.inscriptionSets.push({
          id: 'intersection',
          name: 'Intersection',
          inscriptions: intersection
        })
      }
    },
    addUnionSet() {
      // 2 because that's more than one user-provided set + intersection set
      if (this.inscriptionSets.length > 2) {
        let union = []
        for (let aset of this.inscriptionSets) {
          union = [...union, ...aset.inscriptions]
        }
        this.inscriptionSets.push({
          id: 'union',
          name: 'Union',
          inscriptions: [...new Set(union)]
        })
      }
    },
    getPlaceTimeRange(inscriptionSet, place=null) {
      // returns the date range as a string
      // that contains all date ranges in a place in an inscriptionSet.
      // If place is null, return the date range across all places.
      let ret = []

      if (inscriptionSet.places) {
        for (let [placeKey, dateRanges] of Object.entries(inscriptionSet.places)) {
          if (!place || placeKey == place) {
            for (let dateRange of dateRanges) {
              if (ret.length < 1) {
                ret = dateRange
              } else {
                ret[0] = Math.min(ret[0], dateRange[0])
                ret[1] = Math.max(ret[1], dateRange[1])
              }
            }
          }
        }
      }

      return ret.join(', ')
    },
    // -----------------------
    logMessage(content, level = 'info') {
      // level: info|primary|success|warning|danger
      this.messages.push({
        content: content,
        level: level,
        created: new Date()
      })
    },
    logWarning(content) {
      this.logMessage(content, 'warning')
    },
    logError(content) {
      this.logMessage(content, 'danger')
    },
    logOk(content) {
      this.logMessage(content, 'success')
    },
    getQueryString() {
      return utils.getQueryString()
    },
    // ----------------
    onClickRemoveInscriptionSet(inscriptionSet) {
      let inscriptionSets = this.loadInscriptionSets(inscriptionSet.id)
      window.localStorage.setItem(
        SETTINGS.BROWSER_STORAGE_INSCRIPTION_SETS, 
        JSON.stringify(inscriptionSets)
      )
    }
  }
}).mount('#lab');
