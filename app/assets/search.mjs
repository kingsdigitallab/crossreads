/* 
TODO:
. show the correct label for the script
. remove all hard-coded values
*/

import { utils, FILE_PATHS, DEBUG_DONT_SAVE, IS_BROWSER_LOCAL} from "../utils.mjs";
import { AnyFileSystem } from "../any-file-system.mjs";
import { createApp, nextTick } from "vue";
import { AvailableTags } from "../tags.mjs";

// const INDEX_PATH = 'app/index.json'
// const CHANGE_QUEUE_PATH = 'annotations/change-queue.json'
// const DEFINITIONS_PATH = 'app/data/pal/definitions-digipal.json'
// const VARIANT_RULES_PATH = 'app/data/variant-rules.json'
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
      },
      // instance of AnyFileSystem, to access github resources
      afs: null,
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
        perPage: [12, 24, 50, 100]
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
      return this.selection.items.size && Object.values(this.descriptions.tags).filter(t => t !== null).length
    },
    tagFormatError() {
      return this.availableTags.getTagFormatError(this.selection.newTagName, this.availableTags.tags)
    },
    typeFormatError() {
      // TODO: check for rule duplication
      let ret = this.availableTags.getTagFormatError(this.selection.newTypeName, [])
      if (!ret && this.selection.newTypeName) {
        const selectedAllographs = this.selection.facets?.chr || []
        const selectedComponentFeatures = this.selection.facets?.cxf || []
        if (selectedAllographs.length !== 1 || selectedComponentFeatures.length < 1) {
          ret = 'Please select one Allograph and at least a Component x Feature in the above filters.'
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
      // let res = await utils.readGithubJsonFile(DEFINITIONS_PATH, this.getOctokit())
      const res = await this.afs.readJson(FILE_PATHS.DEFINITIONS)
      if (res.ok) {
        this.definitions = res.data
      } else {
        this.logError('Failed to load definitions from github.')
      }
    },
    async loadIndex() {
      // fetch with API so we don't need to republish site each time the index is rebuilt.
      this.index = null
      if (IS_BROWSER_LOCAL) {  
        this.index = await utils.fetchJsonFile('index.json')
      } else {
        const res = await this.afs.readJson(FILE_PATHS.INDEX)
        if (res.ok) {
          this.index = res.data
        }
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
      for (const ann of change.annotations) {
        const item = this.annotationIdsToItem[ann.id]
        if (item) {
          // remove code duplication with reun-change-queue.mjs
          const tagsSet = new Set(item.tag || [])
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

      ret = item.doc.replace('.xml', '')
      ret += item.img.replace(/^.*(\/[^/]+)_tiled\.tif$/, '$1.jpg')
      ret = utils.slugify(ret)
      ret += '.json'

      return ret
    },
    async saveChangeQueue() {
      let ret = false
      if (DEBUG_DONT_SAVE) {
        console.log('WARNING: DEBUG_DONT_SAVE = True => skip saving.')
        ret = true
      } else {
        if (this.isUnsaved) {
          const change = {
            // annotationIds: [...this.selection.items].map(item => item.id),
            annotations: [...this.selection.items].map(item => ({'id': item.id, 'file': this.getAnnotationFileNameFromItem(item)})),
            // e.g. tags: ['tag1', -tag3', 'tag10']
            tags: Object.entries(this.descriptions.tags).filter(kv => kv[1] !== null).map(kv => (kv[1] === false ? '-' : '') + kv[0]),
            creator: this.afs.getUserId(),
            created: new Date().toISOString(),
          }
          this.changeQueue.changes.push(change)
          const res = await this.afs.writeJson(FILE_PATHS.CHANGE_QUEUE, this.changeQueue, this.changeQueueSha)
          if (res?.ok) {
            ret = true
            this.changeQueueSha = res.sha;
          }
          this.applyChangeToIndex(change)
          // TODO: error management
        }
      }
      if (ret) {
        this.selection.items.clear()
        this.unselectAllTags()
      }
      return ret
    },
    unselectAllTags() {
      for (const k of Object.keys(this.descriptions.tags)) {
        this.descriptions.tags[k] = null
      }
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
          title: 'Allograph',
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
      // .pagination
      // data.items
      // data.aggregations
      if (!keepPage) {
        this.selection.page = 1
      }
      const options = {
        per_page: this.selection.perPage,
        page: this.selection.page,
        sort: 'or1',
        query: (this.selection.searchPhrase || '').trim(),
        filters: this.selection.facets
      }
      // console.log(options)
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
      this.results = this.itemsjs.search(options)
      // img.addEventListener('load', loaded)
      this.$nextTick(() => {
        this.loadVisibleThumbs()
        // this.loadLazyThumbs()
      })
      this.setAddressBarFromSelection()
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
        const crop = item.box.substring(11)
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
      // TODO get from doc when doc will be always populated
      // let ret = (item?.doc || '').replace(/^.*id=/, '')
      const ret = (item?.img || '').replace(/^.*inscription_images\/([^/]+)\/.*$/, '$1')
      return ret
    },
    getAnnotatorLinkFromItem(item) {
      // TODO: remove hard-coded assumptions.
      // the transforms (obj, img) should be more dynamic than that.
      let ret = ''
      const annotatorImageId = item.img.replace('_tiled.tif', ".jpg").replace(/^.*\//, '')
      ret = `./annotator.html?obj=http://sicily.classics.ox.ac.uk/inscription/${this.getDocIdFromItem(item)}&img=${annotatorImageId}&ann=${item.id}`
      return ret
    },
    getOptionsFromFacet(facet) {
      const ret = facet.buckets.filter(o => {
        return o.key !== 'null'
      })
      return ret
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
    onClickItem(item) {
      if (this.selection.items.has(item)) {
        this.selection.items.delete(item)
      } else {
        this.selection.items.add(item)
      }
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
    // -----------------------
    async onAddType() {
      if (this.typeFormatError) return;

      // TODO: convert from label to key
      let scripts = this.selection.facets?.scr
      if (scripts?.length !== 1) {
        scripts = [utils.getScriptFromCharacter(this.selection.facets.chr[0], this.definitions)]
      } else {
        // convert items in 'scripts' array to the key found in this.definitions.scripts for the value matching the item
        scripts = scripts.map((script) => {
          const key = Object.keys(this.definitions.scripts).find((key) => this.definitions.scripts[key] === script);
          return key;
        })
      }

      const variantRule = {
        'variant-name': this.selection.newTypeName,
        script: scripts[0],
        allograph: this.selection.facets.chr[0],
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
      // TODO: is the allograph enough? We might need the script to disambiguate
      this.variantRules.push(variantRule)

      // ensure all the rules have a script
      for (const rule of this.variantRules) {
        if (!rule?.script) {
          rule.script = utils.getScriptFromCharacter(rule.allograph, this.definitions)
        }
      }

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
    },
    setSelectionFromAddressBar() {
      const searchParams = new URLSearchParams(window.location.search);

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
    _getNumberFromString(stringValue, defaultValue=0) {
      // TODO: move to utils.
      const res = Number.parseInt(stringValue)
      const ret = Number.isNaN(res) ? defaultValue : res
      // console.log(stringValue, res, defaultValue, ret)
      return ret
    }
  }
}).mount('#search');
