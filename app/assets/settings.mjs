import { utils } from "../utils.mjs";

// todo: import vue here
const { createApp } = Vue

createApp({
  data() {
    return {
      selection: {
        tab: 'settings',
        gtoken: window.localStorage.getItem('gtoken') || '',
      },
      afs: new utils.AnyFileSystem(),
    }
  },
  async mounted() {
    await this.testToken()
  },
  computed: {
    tabs: () => utils.tabs(),
    canSave() {
      return !!this.selection.gtoken
    },
    isTokenMissing: () => false,
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
