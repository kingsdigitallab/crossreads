import { utils, SETTINGS, FILE_PATHS } from "../utils.mjs";
import { AnyFileSystem } from "../any-file-system.mjs";
import { createApp } from "../node_modules/vue/dist/vue.esm-browser.js";

createApp({
  data() {
    return {
      selection: {
        tab: 'settings',
        gtoken: window.localStorage.getItem('gtoken') || '',
      },
      afs: new AnyFileSystem(),
      links: [
        {
          'name': 'Annotations files',
          'url': utils.getGitUrlTo('ANNOTATIONS'),
        },
        {
          'name': 'Other data files (definitions, variant-rules, search index)',
          'url': SETTINGS.GITHUB_REPO_URL,
        },
        {
          'name': 'Image server',
          'url': SETTINGS.IIIF_SERVER_BASE.replace(/\?.*$/, ""),
        },
        {
          'name': 'DTS Collection',
          'url': SETTINGS.DTS_COLLECTION,
        },
        {
          'name': 'CROSSREADS portal',
          'url': SETTINGS.CROSSREADS_PORTAL_ROOT,
        },
        {
          'name': 'Annotating site',
          'url': SETTINGS.ANNOTATING_SITE_ROOT,
        },
        {
          'name': 'Inscription web pages',
          'url': SETTINGS.CORPUS_BUILDING_INSCRIPTION_URL.replace('{docId}', 'ISic000085'),
        },
      ]
    }
  },
  async mounted() {
    await this.testToken()
  },
  computed: {
    tabs: () => utils.tabs(),
  },
  watch: {
    "selection.gtoken": (v, vOld) => {
      window.localStorage.setItem('gtoken', v)
    }
  },
  methods: {
    getQueryString() {
      return utils.getQueryString()
    },
    async testToken() {
      // let token = this.selection.gtoken
      // let afs = new utils.AnyFileSystem()
      await this.afs.authenticateToGithub(this.selection.gtoken)
      return false
    }
  }
}).mount('#settings')
