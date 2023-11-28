/* 
TODO:
. read index.json from github
. sort results
. show the MS
. show the correct label for the script
. pagination
. link to annotator
. remove all hard-coded values
*/

// const INDEX_PATH = 'index.json'
const INDEX_PATH = 'app/index.json'
const ITEMS_PER_PAGE = 12

class AvailableTags {

  constructor() {
    this.tags = []
  }

  addTag(tag) {
    if (this.tags.includes(tag)) return;
    this.tags.push(tag)
    this.saveToSession()
  }

  load() {
    // TODO: load from github
    // if copy in session is more recent, use that instead
  }

  loadFromSession() {
    this.tags = JSON.parse(window.localStorage.getItem('AvailableTags.tags') || '[]')
  }

  saveToSession() {
    window.localStorage.setItem('AvailableTags.tags', JSON.stringify(this.tags))
  }

}

const { createApp } = Vue

createApp({
  data() {
    return {
      selection: {
        tab: 'search',
        showSuppliedText: false,
        gtoken: window.localStorage.getItem('gtoken') || '',
        // TODO: remove partial duplication with /annotation
        annotationId: '',
        object: null,
        image: null,
        searchPhrase: '',
        facets: {},
        page: 1
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
      queryString: '',
      octokit: null,
      user: null
    }
  },
  async mounted() {
    this.availableTags = new AvailableTags()
    this.availableTags.loadFromSession()
    this.tags = this.availableTags.tags

    await this.loadIndex()
    this.setSelectionFromAddressBar()
    this.search(true)

    // await this.initOctokit()

    // loadOpenSeaDragon(this)
  },
  watch: {
    'selection.searchPhrase'() {
      this.selection.facets = {}
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
        per_page: 12,
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
      let res = await utils.readGithubJsonFile(INDEX_PATH)
      this.index = res.data

      // order field
      for (let item of this.index) {
        // reduce item.img
        item.or1 = `${item.img}-${item.scr}-${item.chr}`
        item.docId = this.getDocIdFromItem(item)
      }

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
    getFacetDefinitions() {
      return {
        scr: {
          title: 'Script',
          size: 30
        },
        chr: {
          title: 'Character',
          size: 30
        },
        tag: {
          title: 'Tags',
          size: 30,
        }
      }
    },
    search(keepPage=false) {
      // .pagination
      // data.items
      // data.aggregations
      if (!keepPage) {
        this.selection.page = 1
      }
      this.results = this.itemsjs.search({
        per_page: ITEMS_PER_PAGE,
        page: this.selection.page,
        sort: 'or1',
        query: this.selection.searchPhrase,
        filters: this.selection.facets
      })
      // img.addEventListener('load', loaded)
      this.$nextTick(() => {
        this.resetThumbs()
        // this.loadLazyThumbs()
      })
      this.setAddressBarFromSelection()
    },
    resetThumbs() {
      for (let element of document.querySelectorAll('.graph-thumb')) {
        element.classList.add('thumb-loading')
        // element.src = this.placeholderThumb(1)
        if (element.classList.contains('thumb-unbound')) {
          element.classList.remove('thumb-unbound')
          element.addEventListener('load', (event) => {
            element.classList.remove('thumb-loading')
          })  
        }
        // element.classList.remove('thumb-unbound')
      }
    },
    // loadLazyThumbs() {
    //   for (let element of document.querySelectorAll('img[data-img]')) {
    //     element.src = element.attributes['data-img'].value
    //     // element.classList.remove('thumb-unloaded')
    //   }
    // },
    getThumbUrlFromItem(item) {
      let ret = null
      let crop = item.box.substring(11)
      ret = `${item.img}/${crop}/,48/0/default.jpg`

      return ret
    },
    placeholderThumb(item) {
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

      for (let facet of Object.keys(this.getFacetDefinitions())) {
        let options = searchParams.get(`f.${facet}`)
        if (options) {
          this.selection.facets[facet] = options.split('|')
        }
      }
    },
  }
}).use(vuetify).mount('#search');
