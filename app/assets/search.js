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

const INDEX_PATH = 'index.json'
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
    this.search()

    // await this.initOctokit()

    // loadOpenSeaDragon(this)
  },
  watch: {
    'selection.searchPhrase'() {
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
    }
  },
  methods: {
    async loadIndex() {
      this.index = await utils.fetchJsonFile(INDEX_PATH)

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
        aggregations: {
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
          },
        },
        searchableFields: ['tag', 'docId']
      }
      this.itemsjs = window.itemsjs(this.index, config);
    },
    search() {
      // .pagination
      // data.items
      // data.aggregations
      this.results = this.itemsjs.search({
        per_page: ITEMS_PER_PAGE,
        sort: 'or1',
        query: this.selection.searchPhrase,
      })
    },
    getThumbUrlFromItem(item) {
      let ret = null
      let crop = item.box.substring(11)
      ret = `${item.img}/${crop}/,48/0/default.jpg`

      return ret
    },
    getDocIdFromItem(item) {
      let ret = (item?.doc || '').replace(/^.*id=/, '')
      return ret
    },
    getAnnotatorLinkFromItem(item) {
      // TODO: remove hard-coded assumptions.
      // the transforms (obj, img) should be more dynamic than that.
      let ret = ''
      let annotatorImageId = item.img.replace('_tiled.tif', `.jpg`).replace(/^.*\//, '')
      ret = `/annotator.html?obj=http://sicily.classics.ox.ac.uk/inscription/${this.getDocIdFromItem(item)}&img=${annotatorImageId}&ann=${item.id}`
      return ret
    }
  }
}).use(vuetify).mount('#search');
