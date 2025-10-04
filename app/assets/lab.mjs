/* TODO
C shared periods
C histogram: add marker for centuries
D optimise the size and ratio of the histograms
D co-occurence matrix
D show insc data on hover histogram
*/
import { AnyFileSystem } from "../any-file-system.mjs";
import { createApp} from "vue";
import { utils, FILE_PATHS, SETTINGS} from "../utils.mjs";

const ANYWHERE = 'Anywhere'

createApp({
  data() {
    return {
      collectionIndex: {},
      inscriptionSets: [],
      places: [],
      maxDateRange: [-500, 500],
      maxInscriptionsPerPlace: 0,

      zoomedCell: null,
      zoomedCellSticky: null,

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
      let ret = this.inscriptionSets.filter(iset => !iset.hidden)
      return ret
    },
    coreInscriptionSets() {
      return (this.inscriptionSets.filter(inscSet => !['intersection', 'union'].includes(inscSet.id)))
    },
    filteredPlaces() {
      return [ANYWHERE, ...this.places]
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
    permalink() {
      let ret = ''
      let isets = this.coreInscriptionSets
      if (isets.length) {
        let queries = this.coreInscriptionSets.map(
          iset => iset.searchQueryString
        )
        let queriesEncoded = btoa(JSON.stringify(queries))
        ret = `search.html?laq=${queriesEncoded}`
      }
      return ret
    }
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
      if (excludedId === 'union') {
        this.inscriptionSets = []
      } else {
        this.inscriptionSets = this.inscriptionSets.filter(iset => iset.id !== excludedId)
      }

      let ret = JSON.parse(JSON.stringify(this.inscriptionSets))

      this.addIntersectionSet()

      let unionSet = this.addUnionSet()

      this.addPlacesAndDateRangesToInscriptionSets()

      this.maxDateRange = this.getPlaceTimeRange(unionSet)

      this.maxInscriptionsPerPlace = this.getMaxInscriptionsPerPlace(unionSet)

      return ret
    },
    getMaxInscriptionsPerPlace(unionSet) {
      let ret = 0

      for (let ranges of Object.values(unionSet?.places ?? {})) {
        ret = Math.max(ret, ranges.length)
      }

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
          name: 'Shared inscriptions',
          inscriptions: intersection
        })
      }
    },
    addUnionSet() {
      let ret = {}

      let union = []
      for (let aset of this.inscriptionSets) {
        union = [...union, ...aset.inscriptions]
      }
      ret = {
        id: 'union',
        name: 'All inscriptions',
        inscriptions: [...new Set(union)],
        hidden: (this.inscriptionSets.filter(iset => iset.id !== 'intersection').length < 2)
      }

      this.inscriptionSets.push(ret)

      return ret
    },
    getPlaceTimeRangeStr(inscriptionSet, place=ANYWHERE) {
      return this.getPlaceTimeRange(inscriptionSet, place).join(', ')
    },
    getPlaceTimeRange(inscriptionSet, place=ANYWHERE) {
      // returns the date range as an array [from, to]
      // that spans all date ranges in a place in an inscriptionSet.
      // If place is ANYWHERE, return the date range across all places.
      let ret = []

      if (inscriptionSet?.places) {
        for (let [placeKey, dateRanges] of Object.entries(inscriptionSet.places)) {
          if (place === ANYWHERE || placeKey === place) {
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

      return ret
    },
    getSvgFromInscriptionSetAndPlace(inscriptionSet, place) {
      let ret = ''

      if (inscriptionSet.places) {

        let ranges = inscriptionSet.places[place] ?? []
        if (place === ANYWHERE) {
          ranges = (inscriptionSet.inscriptions ?? []).map(inscId => {
            let inscriptionData = this.collectionIndex[inscId]
            ret = [inscriptionData['origin_date_from'], inscriptionData['origin_date_to']]
            return ret
          })
        }

        if (ranges.length) {
          let chartMargin = 10
          let axisThickness = 2
          let barColor = utils.getCssVar('barColor')
          let axesColor = '#888'

          // let chartSize = [300, 100]
          function getDimFromCssVar(varName, defaultValue) {
            let ret = utils.getCssVar(varName, defaultValue).replace('px', '')
            ret = parseInt(ret)
            return ret
          }

          let boxSize = [
            getDimFromCssVar('histogramWidthPx', '50px'), 
            getDimFromCssVar('histogramHeightPx', '50px')
          ]
          // margin on each side of the chart
          let chartSize = [boxSize[0] - 2 * chartMargin, boxSize[1] - 2 * chartMargin]

          // add the bars, one for each data bin
          let binsData = this.getDateBinsFromDateRanges(ranges, chartSize[0])
          let chart = ''
          let binWidth = chartSize[0] / binsData.bins.length
          let binX = chartMargin
          let alternateClass = ''
          for (let bin of binsData.bins) {
            let height = bin.inscriptionsCount / this.maxInscriptionsPerPlace * chartSize[1]
            if (height) {
              // fill="${barColor}"
              chart += `<rect class="histogram-bar ${alternateClass}" data-year="${bin.from}" data-qt="${bin.inscriptionsCount}" x="${binX}" y="${boxSize[1] - chartMargin - height}" width="${binWidth}" height="${height}" />\n`
            }
            binX += binWidth
            alternateClass = alternateClass ? '' : 'alternate'
          }

          // add axes
          // X axis
          let axes = `<rect x="${chartMargin}" y="${boxSize[1] - chartMargin}" width="${chartSize[0]}" height="${axisThickness}" fill="${axesColor}" />\n`
          // Y axis
          axes += `<rect x="${chartMargin}" y="${chartMargin}" width="${axisThickness}" height="${chartSize[1] + 1}" fill="${axesColor}" />\n`

          axes += `<text x="0" y="${chartMargin}" font-family="Arial" font-size="10">${this.maxInscriptionsPerPlace}</text>\n`

          // let centuries = utils.clipDateRange(this.maxDateRange, 100)
          
          ret = `<svg width="100%" height="100%" viewBox="0 0 ${boxSize[0]} ${boxSize[1]}" preserveAspectRatio2="xMidYMid meet">`
          ret += chart
          ret += axes
          ret += `</svg>`
        }
      }

      return ret
    },
    getDateBinsFromDateRanges(ranges, totalWidthInPixels) {
      let bins = []
     
      let alignToNearest = 100
      let maxDateRange = utils.clipDateRange(this.maxDateRange, alignToNearest)

      let yearsPerBin = 0
      let totalExtentInYears = maxDateRange[1] - maxDateRange[0]
      let yearsPerBinCandidates = [1, 5, 10, 50, 100, 500]
      for (yearsPerBin of yearsPerBinCandidates) {
        if ((totalExtentInYears / yearsPerBin) < totalWidthInPixels) break;
      }

      for (let b0 = maxDateRange[0]; b0 < maxDateRange[1]; b0 += yearsPerBin) {
        let b1 = b0 + yearsPerBin
        let inscriptionsCount = ranges.filter(r => ((r[1] >= b0) && (b1 >= r[0]))).length
        bins.push({
          from: b0,
          to: b1,
          inscriptionsCount: inscriptionsCount
        })
      }

      return {
        maxDateRange: maxDateRange,
        yearsPerBin: yearsPerBin,
        bins: bins
      }
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
    },
    breakLongNames(name) {
      return name.replace(' ', '<br>')
    },
    titlelise(str) {
      return str.replace(
        /\w\S*/g,
        text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
      );
    },
    onMouseEnterCell(inscriptionSets, place=ANYWHERE) {
      let inscriptions = []
      for (let inscriptionSet of inscriptionSets) {
        if (inscriptionSet === inscriptionSets[0]) {
          inscriptions = inscriptionSet.inscriptions
        } else {
          inscriptions = inscriptions.filter(inscId => inscriptionSet.inscriptions.includes(inscId))
        }
      }
      inscriptions = inscriptions.map(inscId => this.collectionIndex[inscId])
      if (place !== ANYWHERE) {
        inscriptions = inscriptions.filter(insc => insc.origin_place.includes(place))
      }
      this.zoomedCell = {
        inscriptionSets: inscriptionSets,
        place: place,
        inscriptions: inscriptions.sort()
      }
    },
    onMouseLeaveCell() {
      this.zoomedCell = this.zoomedCellSticky
    },
    onUnstickZoomedCell() {
      this.zoomedCellSticky = null
      this.zoomedCell = null
    },
    onStickZoomedCell() {
      this.zoomedCellSticky = this.zoomedCell
    },
    getSharedInscriptions(inscriptionSet1, inscriptionSet2) {
      return inscriptionSet1.inscriptions.filter(inscId => inscriptionSet2.inscriptions.includes(inscId))
    }
  }
}).mount('#lab');
