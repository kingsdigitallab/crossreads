import { utils } from "../utils.mjs";
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
