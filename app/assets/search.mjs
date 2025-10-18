/* 
TODO:
. use ChangeQueue class
. show the correct label for the script
. remove all hard-coded values
*/

import { utils, FILE_PATHS, DEBUG_DONT_SAVE, IS_BROWSER_LOCAL, SETTINGS} from "../utils.mjs";
import { AnyFileSystem } from "../any-file-system.mjs";
import { createApp, nextTick } from "vue";
import { AvailableTags } from "../tags.mjs";

const ITEMS_PER_PAGE = 24
const OPTIONS_PER_FACET = 15
const OPTIONS_PER_FACET_EXPANDED = 1000
const HIDE_OPTIONS_WITH_ZERO_COUNT = true
const TAG_EXEMPLAR = 'm.exemplar'
const SHA_UNREAD = 'SHA_UNREAD'
const DATE_MIN = -1000
const DATE_MAX = 2000


function loadFacetsSettings() {
  /* 
  {
    "chr": {"size":100,"sort":"count","order":"desc"},
    "com": {"size":15,"sort":"count","order":"desc"}
  }
  */ 
  const ret = JSON.parse(window.localStorage.getItem('facetsSettings') || '{}')

  // remove all references to .size
  for (const facetSettings of Object.values(ret)) {
    // biome-ignore lint/performance/noDelete: tiny array
    delete facetSettings.size
  }

  // console.log(ret)

  return ret
}

createApp({
  data() {
    return {
      selection: {
        tab: 'search',
        tabEdit: 'tags', // either 'tags' or 'features'
        showSuppliedText: false,
        gtoken: window.localStorage.getItem('gtoken') || '',
        // TODO: remove partial duplication with /annotation
        annotationId: '',
        object: null, // ?
        image: null, // ?
        searchPhrase: '',
        dateFrom: DATE_MIN,
        dateTo: DATE_MAX,
        facets: {},
        page: 1,
        perPage: ITEMS_PER_PAGE,
        // facetName: {sort: key|count, order: asc|desc, size: N}
        facetsSettings: loadFacetsSettings(),
        items: new Set(),
        newTagName: '',
        newTypeName: '',
        withoutTypeTag: false,
        isInvalid: false,
      },
      // instance of AnyFileSystem, to access github resources
      afs: null,
      // TODO: use ChangeQueue class
      changeQueue: {
        changes: [],
      },
      // the github sha of the annotations file.
      // needed for writing it and detecting conflicts.
      changeQueueSha: SHA_UNREAD,
      // ---
      variantRules: [],
      variantRulesSha: SHA_UNREAD,
      // ---
      options: {
        perPage: [12, 24, 50, 100],
      },
      // See itemsjs.search()
      results: {
        pagination: {},
        data: {
          items: [],
          aggregations: {},
        }
      },
      messages: [
      ],
      cache: {
      },
      user: null,
      descriptions: {
        tags: {
        },
        componentFeatures: {
          action: 'add', // either 'add' or 'remove'
          component: '',
          feature: '',
        }
      },
      availableTags: new AvailableTags(),
      hoveredItem: null,
      showModalOnTheRight: false,
      indexDate: null,
      definitions: {},
    }
  },
  async mounted() {
    await this.availableTags.load()

    await this.initAnyFileSystem()
    
    await this.loadVariantRules()
    await this.loadChangeQueue()
    await this.loadIndex()
    // TODO: don't need to wait for this
    await this.loadDefinitions()

    // not before
    for (const tag of this.availableTags.tags) {
      this.descriptions.tags[tag] = null
    }

    this.setSelectionFromAddressBar()
    this.restoreLaqQueriesFromAddressBar()
    this.search()
  },
  watch: {
    'selection.searchPhrase'() {
      this.selection.facets = {}
      this.search()
    },
    'selection.perPage'() {
      // console.log('selection.perPage')
      this.search()
    },
    'selection.dateFrom'() {
      this.search()
    },
    'selection.dateTo'() {
      this.search()
    },
    'descriptions.componentFeatures.component'() {
      this.descriptions.componentFeatures.feature = ''
    }
  },
  computed: {
    tabs: () => utils.tabs(),
    items() {
      return this.results?.data?.items
    },
    pagination() {
      return this.results?.pagination || {
        page: 1,
        per_page: this.selection.perPage,
        total: 0
      }
    },
    tagSelection() {
      let ret = ''
      const stats = [0, 0]

      for (const state of Object.values(this.descriptions.tags)) {
        if (state === false) stats[1]++;
        if (state === true) stats[0]++;
      }

      if (stats[0]) {
        ret += `+${stats[0]}`
      }
      if (stats[1]) {
        if (ret) ret += ', ';
        ret += `-${stats[1]}`
      }

      if (ret) {
        ret = `(${ret})`
      }

      return ret
    },
    editableComponents() {
      let ret = []
      if (this.descriptions.componentFeatures.action === 'add') {
        // get the components from the definitions
        if (this.definitions.components) {
          ret = Object.keys(this.definitions.components)
        }
      } else {
        // get components from the search facet
        let facets = this.facets
        if (facets.com) {
          ret = facets.com.buckets.map(b => b.key)
        }
      }
      return ret.sort()
    },
    editableFeatures() {
      let ret = []
      if (this.descriptions.componentFeatures.action === 'add') {
        if (this?.definitions?.components) {
          let component = this.definitions.components[this.descriptions.componentFeatures.component]
          ret = component ? this.definitions.components[this.descriptions.componentFeatures.component].features : []
        }
      } else {
        // get components from the search facet
        let facets = this.facets
        if (facets.fea) {
          ret = facets.fea.buckets.map(b => b.key)
        }
      }
      return ret.sort()
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
    facets() {
      // chr: 
      //   buckets
      //     - doc_count: 3
      //       key: "A"
      //       selected: false
      return this.results?.data?.aggregations
    },
    searchName() {
      let ret = []

      // query: (this.selection.searchPhrase || '').trim(),
      // filters: this.selection.facets
      for (let [filterKey, filterValues] of Object.entries(this.selection.facets)) {
        ret.push(filterValues.join(', '))
      }

      return ret.join('; ')
    },
    pageMax() {
      let ret = 1
      const pagination = this?.results?.pagination
      if (pagination) {
        ret = Math.ceil(pagination.total / pagination.per_page)
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
      let numberOfChangedTags = Object.values(this.descriptions.tags).filter(t => t !== null).length
      let isFeatureSelected = this.selection.tabEdit === 'features' && this.descriptions.componentFeatures.feature && this.descriptions.componentFeatures.component
      return this.selection.items.size && (numberOfChangedTags || isFeatureSelected)
    },
    tagFormatError() {
      return this.availableTags.getTagFormatError(this.selection.newTagName, this.availableTags.tags)
    },
    typeFormatError() {
      // TODO: check for rule duplication
      let ret = this.availableTags.getTagFormatError(this.selection.newTypeName, [])
      if (!ret && this.selection.newTypeName) {
        const selectedScripts = this.selection.facets?.scr || []
        const selectedAllographs = this.selection.facets?.chr || []
        const selectedComponentFeatures = this.selection.facets?.cxf || []
        if (selectedScripts.length !== 1 || selectedAllographs.length !== 1 || selectedComponentFeatures.length < 1) {
          ret = 'Please select one Script and on Allograph and at least a Component x Feature in the above filters.'
        }
      }
      return ret
    }
  },
  methods: {
    async initAnyFileSystem() {
      this.afs = new AnyFileSystem()
      await this.afs.authenticateToGithub(this.selection.gtoken)
    },
    async loadDefinitions() {
      const res = await this.afs.readJson(FILE_PATHS.DEFINITIONS)
      if (res.ok) {
        this.definitions = res.data
      } else {
        this.logError('Failed to load definitions from github.')
      }
    },
    async loadIndex() {
      this.index = null
      const res = await this.afs.readJson(FILE_PATHS.INDEX)
      if (res.ok) {
        this.index = res.data
      }
      if (!this.index?.data) {
        this.logMessage(`Failed to load search index from github (${res.description})`, 'error')
        this.index = {
          meta: {
            "dc:modified": "2000-01-01T01:01:01.042Z",
          },
          data: []
        }
      }
      this.indexDate = new Date(this.index.meta['dc:modified'])

      // order field
      this.annotationIdsToItem = {}
      for (const item of this.index.data) {
        // TODO: reduce id in the key
        this.annotationIdsToItem[item.id] = item
        // reduce item.img
        item.or1 = `${item.img}-${item.scr}-${item.chr}`
        item.docId = this.getDocIdFromItem(item)
      }

      this.applyChangeQueueToIndex()

      this.resetItemsjsconfig()

      window.addEventListener('resize', this.loadVisibleThumbs);
      window.addEventListener('scroll', this.loadVisibleThumbs);
    },
    async loadChangeQueue() {
      const res = await this.afs.readJson(FILE_PATHS.CHANGE_QUEUE)
      if (res?.ok) {
        this.changeQueue = res.data
        this.changeQueueSha = res.sha
        this.changeQueue.changes = this.changeQueue?.changes || []
      } else {
        this.logMessage(`Failed to load change queue from github (${res.description})`, 'error')
      }
    },
    async loadVariantRules() {
      const res = await this.afs.readJson(FILE_PATHS.VARIANT_RULES)
      if (res?.ok) {
        this.variantRules = res.data
        this.variantRulesSha = res.sha
      } else {
        this.variantRules = []
        this.logMessage(`Failed to load variant rules from github (${res.description})`, 'error')
      }
    },
    applyChangeQueueToIndex() {
      const changes = this.changeQueue?.changes
      if (changes) {
        for (const change of changes) {
          this.applyChangeToIndex(change)
        }
      }
    },
    applyChangeToIndex(change) {
      if (change.annotations) {
        for (const ann of change.annotations) {
          const item = this.annotationIdsToItem[ann.id]
          if (item) {
            // remove code duplication with run-change-queue.mjs
            if (change?.tags) {
              const tagsSet = new Set(item?.tag || [])
              for (const tag of change.tags) {
                if (tag.startsWith('-')) {
                  tagsSet.delete(tag.substring(1))
                } else {
                  tagsSet.add(tag)
                  this.availableTags.addTag(tag)
                }
              }    
              item.tag = [...tagsSet]
            }

            // componentFeatures
            if (change?.componentFeatures) {
              const addToArrayIfNotExist = (val, arr) => {
                if (!arr.includes(val)) arr.push(val)
              };

              for (let cf of change.componentFeatures) {
                if (cf[1].startsWith('-')) {
                  let feature = cf[1].substring(1)
                  if (feature === 'ALL') {
                    item.cxf = item.cxf.filter(icxf => !icxf.startsWith(`${cf[0]} is `))
                  } else {
                    let cxf = `${cf[0]} is ${feature}`
                    item.cxf = item.cxf.filter(icxf => icxf !== cxf)
                  }
                  // get components and features from that cxf
                  item.com = item.cxf.map(icxf => icxf.split(' is ')[0])
                  item.fea = item.cxf.map(icxf => icxf.split(' is ')[1])
                } else {
                  addToArrayIfNotExist(cf[0], item.com)
                  addToArrayIfNotExist(cf[1], item.fea)
                  addToArrayIfNotExist(`${cf[0]} is ${cf[1]}`, item.cxf)              
                }
              }
            }
          }
        }
      }
    },
    getAnnotationFileNameFromItem(item) {
      // TODO: filename should be in the search index 
      // instead of hardcoding the reconstruction here.
      // But that would inflate its size.
      //
      // returns:
      // 'http-sicily-classics-ox-ac-uk-inscription-isic020930-isic020930-jpg.json'
      // from: 
      // item.doc = 'http://sicily.classics.ox.ac.uk/inscription/ISic000085.xml'
      // item.img = 'https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=/inscription_images/ISic000085/ISic000085_tiled.tif'

      let ret = ''

      ret = item.fil

      // ret = item.doc.replace('.xml', '')
      // ret += item.img.replace(/^.*(\/[^/]+)_tiled\.tif$/, '$1.jpg')
      // ret = utils.slugify(ret)
      // ret += '.json'

      return ret
    },
    resetSearch() {
      this.selection.searchPhrase = ''
      this.selection.facets = {}
      this.selection.items.clear()
      this.selection.dateFrom = DATE_MIN
      this.selection.dateTo = DATE_MAX
      this.unselectAllTags()
      this.search()
    },
    resetItemsjsconfig() {
      const config = {
        sortings: {
          or1: {
            field: 'or1',
            order: 'asc'
          }
        },
        aggregations: this.getFacetDefinitions(),
        searchableFields: ['tag', 'docId']
      }
      this.itemsjs = window.itemsjs(this.index.data, config);
    },
    onClickFacetExpand(facetKey) {
      if (this.getSelectedOptionsCount(facetKey)) return;

      const settings = this.getFacetSettings(facetKey)
      // settings.size = settings.size == OPTIONS_PER_FACET ? OPTIONS_PER_FACET_EXPANDED : OPTIONS_PER_FACET;
      settings.expanded = !(settings?.expanded)
      this.setFacetSettings(facetKey, settings)
    },
    getFacetSettings(facetKey) {
      const ret = this.selection.facetsSettings[facetKey] || {
        size: OPTIONS_PER_FACET,
        sort: 'count',
        order: 'desc',
      };
      return ret
    },
    isFacetExpanded(facetKey) {
      const settings = this.getFacetSettings(facetKey)
      return !!settings.expanded || this.getSelectedOptionsCount(facetKey)
    },
    isFacetSortedBy(facetKey, sort, order) {
      const settings = this.getFacetSettings(facetKey)
      return settings.sort === sort && settings.order === order
    },
    getSelectedOptionsCount(facetKey) {
      return this.getSelectedOptions(facetKey).length
    },
    getSelectedOptions(facetKey) {
      const ret = this.selection?.facets[facetKey] || []
      if (facetKey === 'dat') {
        if (this.selection.dateFrom > DATE_MIN) {
          ret.push(this.selection.dateFrom)
        }
        if (this.selection.dateTo < DATE_MAX) {
          ret.push(this.selection.dateTo)
        }
      }
      return ret
    },
    onClickFacetColumn(facetKey, columnName) {
      const settings = this.getFacetSettings(facetKey)
      if (settings.sort === columnName) {
        settings.order = settings.order === 'asc' ? 'desc' : 'asc'
      } else {
        settings.sort = settings.sort === 'count' ? 'key' : 'count'
        settings.order = settings.sort === 'count' ? 'desc' : 'asc'
      }
      this.setFacetSettings(facetKey, settings)
    },
    setFacetSettings(facetKey, settings) {
      this.selection.facetsSettings[facetKey] = settings;
      window.localStorage.setItem('facetsSettings', JSON.stringify(this.selection.facetsSettings));
      this.resetItemsjsconfig()
      this.search()
    },
    getFacetDefinitions() {
      const ret = {
        scr: {
          title: 'Script',
        },
        chr: {
          title: 'Character',
        },
        var: {
          title: 'Variant type',
        },
        tag: {
          title: 'Tags',
        },
        cxf: {
          title: 'Component x Features',
          // gh-56
          sort: 'key'
        },
        com: {
          title: 'Components',
        },
        fea: {
          title: 'Features',
        },
        mat: {
          title: 'Material',
        },
        wme: {
          title: 'Execution type',
        },
        pla: {
          title: 'Place',
        },
      }
      for (const facetKey of Object.keys(ret)) {
        const facet = ret[facetKey]
        const settings = this.getFacetSettings(facetKey)
        // TODO: more efficient if we don't include it when not expanded
        // note that size = 0 is treated like infinite by itemsjs
        facet.size = settings.expanded ? OPTIONS_PER_FACET_EXPANDED : 1
        facet.sort = settings.sort
        facet.order = settings.order
        facet.hide_zero_doc_count = HIDE_OPTIONS_WITH_ZERO_COUNT
      }
      // console.log('Facet Defs')
      // console.log(ret)
      return ret
    },
    search(keepPage=false) {
      // This search uses internal search and affect vuejs model and UI
      // .pagination
      // data.items
      // data.aggregations
      if (!keepPage) {
        this.selection.page = 1
      }

      this.results = this.internalSearch(this.selection.page, this.selection.perPage)
      this.$nextTick(() => {
        this.loadVisibleThumbs()
      })
      this.setAddressBarFromSelection()
    },
    internalSearch(page=1, perPage=1000000) {
      // search with itemsjs without affecting the vue model or the UI
      const options = {
        per_page: this.selection.perPage,
        page: this.selection.page,
        sort: 'or1',
        query: (this.selection.searchPhrase || '').trim(),
        filters: this.selection.facets
      }
      // custom filter by date range
      if (this.selection.dateFrom > DATE_MIN || this.selection.dateTo < DATE_MAX) {
        options.filter = (item) => {
          if (this.selection.dateFrom > DATE_MIN) {
            if (item.dat < this.selection.dateFrom) return false;
          }
          if (this.selection.dateTo < DATE_MAX) {
            if (item.daf > this.selection.dateTo) return false;            
          }
          return true
        }
      }
      // custom filtering by withoutTypeTag
      if (this.selection.withoutTypeTag || this.selection.isInvalid) {
        // TODO: don't reset the date filtering
        options.filter = (item) => {
          if (this.selection.isInvalid) {
            if (item.val) return false;
          }
          if (this.selection.withoutTypeTag) {
            if (item.tag) {
              let allTags = `£${item.tag.join('£')}`
              if (allTags.includes('£type')) return false
            }
          }
          return true
        }
        this.selection.dateFrom = DATE_MIN
        this.selection.dateTo = DATE_MAX
      }

      return this.itemsjs.search(options)
    },
    loadVisibleThumbs() {
      for (const element of document.querySelectorAll('.graph-thumb')) {
        const dataSrc = element.attributes['data-src']
        if (dataSrc) {
          const distanceFromBottom = window.innerHeight - element.getBoundingClientRect().top
          const distanceFromTop = element.getBoundingClientRect().bottom
          const distanceFromEdge = Math.min(distanceFromBottom, distanceFromTop)
          // console.log(distanceFromBottom)
          // element.setAttribute('data-dist', distanceFromBottom)
          if (distanceFromEdge > -200) {
            element.classList.add('thumb-loading')
            element.src = dataSrc.value
            element.removeAttribute('data-src')
            element.addEventListener('load', (event) => {
              element.classList.remove('thumb-loading')
            })  
          }
        }
      }
    },
    getThumbUrlFromTag(tag, height=40) {
      const item = null

      return this.getThumbUrlFromItem(item, height)
    },
    getThumbUrlFromItem(item, height=48) {
      let ret = ''
      if (item) {
        // const crop = item.box.substring(11)
        const crop = item.box.replace('xywh=pixel:', '')
        ret = `${item.img}/${crop}/,${height}/0/default.jpg`
      }

      return ret
    },
    placeholderThumb(item) {
      // data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=
      return 'data:image/svg+xml;UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect x="0" y="0" rx="2" ry="2" width="48" height="48" style="fill:lightgrey;stroke:grey;stroke-width:2;opacity:1" /></svg>'
    },
    getThumbClass(item) {
      return 'unloaded-thumb'
    },
    getDocIdFromItem(item) {
      let ret = null 
      // from the img: not good b/c it can be wrong when annotation has been copied by mistake to another doc
      // ret = (item?.img || '').replace(/^.*inscription_images\/([^/]+)\/.*$/, '$1')
      // ret = item.fil.replace(/^.*-isic(\d+)-.*$/i, 'ISic$1')
      ret = utils.getDocIdFromString(item.fil, true)
      return ret
    },
    getAnnotatorLinkFromItem(item) {
      // TODO: remove hard-coded assumptions.
      // the transforms (obj, img) should be more dynamic than that.
      let ret = ''
      // const annotatorImageId = item.img.replace('_tiled.tif', ".jpg").replace(/^.*\//, '')
      const annotatorImageId = item.img.replace(/^.*\//, '')
      ret = `./annotator.html?obj=${SETTINGS.DTS_DOC_BASE}${this.getDocIdFromItem(item)}&img=${annotatorImageId}&ann=${item.id}`
      return ret
    },
    getOptionsFromFacet(facet) {
      const ret = facet.buckets.filter(o => {
        return o.key !== 'null'
      })
      return ret
    },
    getLabelFromOption(optionKey, facetKey) {
      return utils.getLabelFromDefinition(optionKey, facetKey, this.definitions)
    },
    onClickFacetOption(facetKey, optionKey) {
      let facet = this.selection.facets[facetKey]
      if (!facet) {
        facet = this.selection.facets[facetKey] = []
      } else {
        if (facet.includes(optionKey)) {
          if (facet.length === 1) {
            delete this.selection.facets[facetKey]
          } else {
            this.selection.facets[facetKey] = facet.filter(
              o => o !== optionKey
            )
          }
          facet = null
        }
      }
      if (facet) {
        facet.push(optionKey)
      }
      this.search()
    },
    onClickPagination(step) {
      let page = this.selection.page + step
      if (page < 1) page = 1;
      if (page > this.pageMax) page = this.pageMax;
      // biome-ignore lint/suspicious/noDoubleEquals: <explanation>
      if (this.selection.page != page) {
        this.selection.page = page
        this.search(true)
      }
    },
    // preview annotation
    onMouseEnterItem(item) {
      this.hoveredItem = item
      this.showModalOnTheRight = false
    },
    onMouseLeaveItem(item) {
      this.hoveredItem = null
    },
    // preview tag examplar
    onMouseEnterTag(tag, showModalOnTheRight=false) {
      // TODO: cache the results for each tag
      let ret = null
      const selectedAllographs = this.selection.facets?.chr || []
      if (selectedAllographs.length === 1) {
        ret = this._searchByTag(tag, selectedAllographs[0], true) || this._searchByTag(tag, selectedAllographs[0])
      }
      ret = ret || this._searchByTag(tag, null, true) || this._searchByTag(tag)
      this.hoveredItem = ret
      this.showModalOnTheRight = showModalOnTheRight
    },
    _searchByTag(tag, allograph=null, exemplar=false) {
      const filters = {
        'tag': [tag]
      }
      if (exemplar) filters.tag.push(TAG_EXEMPLAR);
      if (allograph) filters.chr = [allograph]
      const res = this.itemsjs.search({
        per_page: 1,
        page: 1,
        sort: 'or1',
        query: '',
        filters: filters
      })
      const items = res?.data?.items
      const ret = items ? items[0] : null
      // console.log(tags, items.length)
      return ret
    },
    onMouseLeaveTag(tag) {
      this.hoveredItem = null
    },
    // ----------------------
    // bulk-edit
    onClickEditTab(tabKey) {
      this.selection.tabEdit = tabKey
      this.unselectAllTags()
      this.unselectDescriptions()
    },
    unselectDescriptions() {
      this.descriptions.componentFeatures.component = ''
      this.descriptions.componentFeatures.feature = ''
    },
    onClickItem(item) {
      if (this.selection.items.has(item)) {
        this.selection.items.delete(item)
      } else {
        this.selection.items.add(item)
      }
    },
    selectAllAnnotationsOnPage() {
      for (const item of this.items) {
        this.selection.items.add(item)
      }
    },    
    clearAnnotationSelection() {
      this.selection.items.clear()
    },    
    onAddTag() {
      if (this.tagFormatError) return;
      const tag = this.availableTags.addTag(this.selection.newTagName);
      if (!tag) return;
      this.descriptions.tags[this.selection.newTagName] = null
      this.selection.newTagName = ''
    },
    onClickTag(tag) {
      const stateTransitions = {true: false, false: null, null: true}
      this.descriptions.tags[tag] = stateTransitions[this.descriptions.tags[tag]]
    },
    async saveChangeQueue() {
      let ret = false

      if (this.isUnsaved) {          
        const change = {
          // annotationIds: [...this.selection.items].map(item => item.id),
          changeType: "changeAnnotations",
          annotations: [...this.selection.items].map(item => ({'id': item.id, 'file': this.getAnnotationFileNameFromItem(item)})),
          creator: this.afs.getUserId(),
          created: new Date().toISOString(),
        }
        // change in tags
        // e.g. tags: ['tag1', -tag3', 'tag10']
        let tags = Object.entries(this.descriptions.tags).filter(kv => kv[1] !== null).map(kv => (kv[1] === false ? '-' : '') + kv[0])
        if (tags.length) {
          change.tags = tags
        }
        // change in componentFeatures
        let componentFeatures = this.descriptions.componentFeatures
        if (componentFeatures.feature && componentFeatures.component) {
          let prefix = componentFeatures.action === 'remove' ? '-' : ''
          change.componentFeatures = [
            [componentFeatures.component, prefix + componentFeatures.feature]
          ]
        }

        this.changeQueue.changes.push(change)
        if (DEBUG_DONT_SAVE) {
          console.log('WARNING: DEBUG_DONT_SAVE = True => skip saving.')
          console.log(JSON.stringify(this.changeQueue, null, 2))
          ret = true
        } else {
          const res = await this.afs.writeJson(FILE_PATHS.CHANGE_QUEUE, this.changeQueue, this.changeQueueSha)
          if (res?.ok) {
            ret = true
            this.changeQueueSha = res.sha;
          }
        }
        if (ret) {
          this.applyChangeToIndex(change)
        }
      }
      if (ret) {
        this.clearAnnotationSelection()
        this.unselectAllTags()
        this.unselectDescriptions()
        this.itemsjs.reindex(this.index.data)
        this.search(true)
      }
      return ret
    },
    unselectAllTags() {
      for (const k of Object.keys(this.descriptions.tags)) {
        this.descriptions.tags[k] = null
      }
    },
    // -----------------------
    async onAddVariantType() {
      if (this.typeFormatError) return;

      // assume we have a single script and character selected
      // otherwise typeFormatError would not be empty.
      const script = this.selection.facets.scr[0]
      const character = this.selection.facets.chr[0]

      const variantRule = {
        'variant-name': this.selection.newTypeName,
        script: script,
        allograph: character,
        // ["crossbar is ascending", "crossbar is straight" ] 
        // -> [{component: 'crossbar', feature: 'ascending'}, ...]
        'component-features': this.selection.facets.cxf.map((cxf) => {
          const parts = cxf.split(' is ')
          return {
            component: parts[0],
            feature: parts[1],
          }
        }),
      }
      // console.log(variantRule)
      this.variantRules.push(variantRule)

      const res = await this.afs.writeJson(FILE_PATHS.VARIANT_RULES, this.variantRules, this.variantRulesSha)
      if (res?.ok) {
        this.variantRulesSha = res.sha
        this.selection.newTypeName = ''
      } else {
        this.logMessage("Failed to save new variant rule. You might have to reload the page and try again.", 'error')
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
    setAddressBarFromSelection() {
      // ?object
      // let searchParams = new URLSearchParams(window.location.search)
      const searchParams = {
        obj: this.selection.object,
        img: this.selection.image,
        sup: this.selection.showSuppliedText ? 1 : 0,
        ann: (this.annotation?.id || '').replace(/^#/, ''),
        // scr: this.description.script,

        q: this.selection.searchPhrase,
        pag: this.selection.page,
        ppg: this.selection.perPage,
        daf: this.selection.dateFrom,
        dat: this.selection.dateTo,
      };

      for (const facet of Object.keys(this.selection.facets)) {
        searchParams[`f.${facet}`] = this.selection.facets[facet].join('|')
      }
      
      const defaults = {
        // make sure q is always in the query string, even if ''
        q: 'DEFAULT',
        pag: 1,
        ppg: ITEMS_PER_PAGE,
        daf: DATE_MIN,
        dat: DATE_MAX,
        sup: 0,
      }
      
      utils.setQueryString(searchParams, defaults)

      window.document.title = `Search ${this.searchName}`
    },
    setSelectionFromAddressBar(queryString=null) {
      const searchParams = new URLSearchParams(queryString ?? window.location.search);

      this.selection.object = searchParams.get('obj') || ''
      this.selection.image = searchParams.get('img') || ''
      this.selection.showSuppliedText = searchParams.get('sup') === '1'
      this.selection.annotationId = searchParams.get('ann') || ''
      this.selection.dateFrom = this._getNumberFromString(searchParams.get('daf'), DATE_MIN)
      this.selection.dateTo = this._getNumberFromString(searchParams.get('dat'), DATE_MAX)
      // this.description.script = searchParams.get('scr') || ''

      // // no longer wanted
      // this.selection.searchPhrase = searchParams.get('q')
      // if (this.selection.searchPhrase === null && this.selection.image) {
      //   this.selection.searchPhrase = this.selection.image.replace(/\.[^.]+$/, '')
      // } else {
      //   this.selection.searchPhrase = (this.selection.searchPhrase || '').trim()
      // }

      this.selection.searchPhrase = (searchParams.get('q') || '').trim()

      this.selection.page = this._getNumberFromString(searchParams.get('pag'), 1)
      this.selection.perPage = this._getNumberFromString(searchParams.get('ppg'), ITEMS_PER_PAGE)

      for (const facet of Object.keys(this.getFacetDefinitions())) {
        const options = searchParams.get(`f.${facet}`)
        if (options) {
          // console.log(facet, options)
          this.selection.facets[facet] = options.split('|')
          // console.log(this.selection.facets)
        }
      }
      // console.log(this.selection.facets)
    },
    restoreLaqQueriesFromAddressBar() {
      const searchParams = new URLSearchParams(window.location.search);

      let labQueriesEncoded = searchParams.get('laq') || ''
      if (labQueriesEncoded) {
        // TODO: error management
        let labQueries = JSON.parse(atob(labQueriesEncoded))
        window.localStorage.setItem(SETTINGS.BROWSER_STORAGE_INSCRIPTION_SETS, '[]')
        for (let query of labQueries) {
          this.setSelectionFromAddressBar(query)
          this.onClickAddResultsToLab(query)
        }
        this.logOk(`Restored the Lab results from the link. Go the the Lab tab to view them.`)
      }
    },
    _getNumberFromString(stringValue, defaultValue=0) {
      // TODO: move to utils.
      const res = Number.parseInt(stringValue)
      const ret = Number.isNaN(res) ? defaultValue : res
      // console.log(stringValue, res, defaultValue, ret)
      return ret
    },
    getGitUrlTo(file_key, isRaw=false) {
      return utils.getGitUrlTo(file_key, isRaw)
    },
    onClickAddResultsToLab(queryString=null) {
      let results = this.internalSearch()

      let items = results?.data?.items
      if (items) {
        let storage_key = SETTINGS.BROWSER_STORAGE_INSCRIPTION_SETS
        let inscriptionSets = window.localStorage.getItem(storage_key) ?? '[]'
        inscriptionSets = JSON.parse(inscriptionSets)

        let inscriptionSet = {
          id: new Date().toISOString(),
          name: this.searchName,
          inscriptions: [...new Set(items.map(item => utils.getDocIdFromString(item.fil)))],
          searchQueryString: queryString ?? window.location.search
        }
        inscriptionSets.push(inscriptionSet)
        window.localStorage.setItem(storage_key, JSON.stringify(inscriptionSets))

        this.logOk(`Added new results to Lab tab: ${this.searchName}`)
      }
    }
  }
}).mount('#search');
