/* 
TODO:
. sort results
. show the correct label for the script
. remove all hard-coded values
*/

import { utils, DEBUG_DONT_SAVE, IS_BROWSER_LOCAL} from "../utils.mjs";
import { AnyFileSystem } from "../any-file-system.mjs";
import { createApp, nextTick } from "vue";
import { AvailableTags } from "../tags.mjs";

// const INDEX_PATH = 'index.json'
const INDEX_PATH = 'app/index.json'
const ITEMS_PER_PAGE = 24
const OPTIONS_PER_FACET = 15
const OPTIONS_PER_FACET_EXPANDED = 100
const HIDE_OPTIONS_WITH_ZERO_COUNT = true

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
        facets: {},
        page: 1,
        perPage: ITEMS_PER_PAGE,
        // facetName: {sort: key|count, order: asc|desc, size: N}
        facetsSettings: JSON.parse(window.localStorage.getItem('facetsSettings') || '{}'),
        items: new Set(),
      },
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
      definitions: {
        tags: {
          'test1': {selected: false},
          'test2': {selected: false},
        }
      }
    }
  },
  async mounted() {
    this.availableTags = new AvailableTags()
    await this.availableTags.load()
    this.tags = this.availableTags.tags

    await this.loadIndex()
    this.setSelectionFromAddressBar()
    this.search(true)
  },
  watch: {
    'selection.searchPhrase'() {
      this.selection.facets = {}
      this.search()
    },
    'selection.perPage'() {
      console.log('selection.perPage')
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
      let pagination = this?.results?.pagination
      if (pagination) {
        ret = Math.ceil(pagination.total / pagination.per_page)
      }
      return ret
    }
  },
  methods: {
    async loadIndex() {
      // this.index = await utils.fetchJsonFile(INDEX_PATH)
      // fetch with API so we don't need to republish site each time the index is rebuilt.

      if (IS_BROWSER_LOCAL) {
        this.index = await utils.fetchJsonFile('index.json')
      } else {
        let afs = new AnyFileSystem()
        let res = await afs.readJson(INDEX_PATH)
        // let res = await utils.readGithubJsonFile(INDEX_PATH)
        this.index = res.data
      }

      // order field
      for (let item of this.index) {
        // reduce item.img
        item.or1 = `${item.img}-${item.scr}-${item.chr}`
        item.docId = this.getDocIdFromItem(item)
      }

      this.resetItemsjsconfig()

      window.addEventListener('resize', this.loadVisibleThumbs);
      window.addEventListener('scroll', this.loadVisibleThumbs);
    },
    resetItemsjsconfig() {
      let config = {
        sortings: {
          or1: {
            field: 'or1',
            order: 'desc'
          }
        },
        aggregations: this.getFacetDefinitions(),
        searchableFields: ['tag', 'docId']
      }
      this.itemsjs = window.itemsjs(this.index, config);
    },
    onClickFacetExpand(facetKey) {
      let settings = this.getFacetSettings(facetKey)
      settings.size = settings.size == OPTIONS_PER_FACET ? OPTIONS_PER_FACET_EXPANDED : OPTIONS_PER_FACET;
      this.setFacetSettings(facetKey, settings)
    },
    getFacetSettings(facetKey) {
      let ret = this.selection.facetsSettings[facetKey] || {
        size: OPTIONS_PER_FACET,
        sort: 'count',
        order: 'desc',
      };
      return ret
    },
    isFacetExpanded(facetKey) {
      let settings = this.getFacetSettings(facetKey)
      return settings.size != OPTIONS_PER_FACET 
    },
    isFacetSortedBy(facetKey, sort, order) {
      let settings = this.getFacetSettings(facetKey)
      return settings.sort == sort && settings.order == order
      
    },
    onClickFacetColumn(facetKey, columnName) {
      let settings = this.getFacetSettings(facetKey)
      if (settings.sort == columnName) {
        settings.order = settings.order == 'asc' ? 'desc' : 'asc'
      } else {
        settings.sort = settings.sort == 'count' ? 'key' : 'count'
        settings.order = settings.sort == 'count' ? 'desc' : 'asc'
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
      let ret = {
        scr: {
          title: 'Script',
        },
        chr: {
          title: 'Allograph',
        },
        tag: {
          title: 'Tags',
        },
        com: {
          title: 'Components',
        },
        fea: {
          title: 'Features',
        },
        cxf: {
          title: 'Component x Features',
          // gh-56
          sort: 'key'
        },
      }
      for (let facetKey of Object.keys(ret)) {
        let facet = ret[facetKey]
        let settings = this.getFacetSettings(facetKey)
        facet.size = settings.size
        facet.sort = settings.sort
        facet.order = settings.order
        facet.hide_zero_doc_count = HIDE_OPTIONS_WITH_ZERO_COUNT
      }
      return ret
    },
    search(keepPage=false) {
      // .pagination
      // data.items
      // data.aggregations
      if (!keepPage) {
        this.selection.page = 1
      }
      this.results = this.itemsjs.search({
        per_page: this.selection.perPage,
        page: this.selection.page,
        sort: 'or1',
        query: this.selection.searchPhrase,
        filters: this.selection.facets
      })
      // img.addEventListener('load', loaded)
      this.$nextTick(() => {
        this.loadVisibleThumbs()
        // this.loadLazyThumbs()
      })
      this.setAddressBarFromSelection()
    },
    loadVisibleThumbs() {
      for (let element of document.querySelectorAll('.graph-thumb')) {
        let dataSrc = element.attributes['data-src']
        if (dataSrc) {
          let distanceFromBottom = window.innerHeight - element.getBoundingClientRect().top
          let distanceFromTop = element.getBoundingClientRect().bottom
          let distanceFromEdge = Math.min(distanceFromBottom, distanceFromTop)
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
    getThumbUrlFromItem(item) {
      let ret = null
      let crop = item.box.substring(11)
      ret = `${item.img}/${crop}/,48/0/default.jpg`

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
      let ret = (item?.img || '').replace(/^.*inscription_images\/([^/]+)\/.*$/, '$1')
      return ret
    },
    getAnnotatorLinkFromItem(item) {
      // TODO: remove hard-coded assumptions.
      // the transforms (obj, img) should be more dynamic than that.
      let ret = ''
      let annotatorImageId = item.img.replace('_tiled.tif', `.jpg`).replace(/^.*\//, '')
      ret = `./annotator.html?obj=http://sicily.classics.ox.ac.uk/inscription/${this.getDocIdFromItem(item)}&img=${annotatorImageId}&ann=${item.id}`
      return ret
    },
    getOptionsFromFacet(facet) {
      let ret = facet.buckets.filter(o => {
        return o.key != 'null'
      })
      return ret
    },
    onClickFacetOption(facetKey, optionKey) {
      let facet = this.selection.facets[facetKey]
      if (!facet) {
        facet = this.selection.facets[facetKey] = []
      } else {
        if (facet.includes(optionKey)) {
          if (facet.length == 1) {
            delete this.selection.facets[facetKey]
          } else {
            this.selection.facets[facetKey] = facet.filter(
              o => o != optionKey
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
      if (this.selection.page != page) {
        this.selection.page = page
        this.search(true)
      }
    },
    getQueryString() {
      return utils.getQueryString()
    },
    onClickItem(item) {
      if (this.selection.items.has(item)) {
        this.selection.items.delete(item)
      } else {
        this.selection.items.add(item)
      }
    },
    setAddressBarFromSelection() {
      // ?object
      // let searchParams = new URLSearchParams(window.location.search)
      let searchParams = {
        obj: this.selection.object,
        img: this.selection.image,
        sup: this.selection.showSuppliedText ? 1 : 0,
        ann: (this.annotation?.id || '').replace(/^#/, ''),
        // scr: this.description.script,

        q: this.selection.searchPhrase,
        pag: this.selection.page,
        ppg: this.selection.perPage,
      };

      for (let facet of Object.keys(this.selection.facets)) {
        searchParams[`f.${facet}`] = this.selection.facets[facet].join('|')
      }
      utils.setQueryString(searchParams)
    },
    setSelectionFromAddressBar() {
      let searchParams = new URLSearchParams(window.location.search);

      this.selection.object = searchParams.get('obj') || ''
      this.selection.image = searchParams.get('img') || ''
      this.selection.showSuppliedText = searchParams.get('sup') === '1'
      this.selection.annotationId = searchParams.get('ann') || ''
      // this.description.script = searchParams.get('scr') || ''

      this.selection.searchPhrase = searchParams.get('q') || ''
      this.selection.page = parseInt(searchParams.get('pag') || '1')
      this.selection.perPage = parseInt(searchParams.get('ppg') || ITEMS_PER_PAGE)

      for (let facet of Object.keys(this.getFacetDefinitions())) {
        let options = searchParams.get(`f.${facet}`)
        if (options) {
          this.selection.facets[facet] = options.split('|')
        }
      }
    },
  }
}).mount('#search');
