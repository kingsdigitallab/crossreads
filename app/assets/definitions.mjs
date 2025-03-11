import { utils, DEBUG_DONT_SAVE, IS_BROWSER_LOCAL } from "../utils.mjs";
import { createApp, nextTick } from "vue";
import { AnyFileSystem } from "../any-file-system.mjs";

// const componentFeatureUri = '/digipal/api/componentfeature/'
const componentUri = '/digipal/api/component/?@select=name,*componentfeature_set,feature'
const allographUri = '/digipal/api/allograph/?@select=*script_set,*allograph_components,name,character,*component'
const collectionUri = './data/dts/api/collections-2023-01.json'
const definitionsPath = 'app/data/pal/definitions-digipal.json'
const STATS_PATH = 'app/stats.json'
const SHA_UNREAD = 'SHA_UNREAD'
const VARIANT_RULES_PATH = 'app/data/variant-rules.json'

createApp({
  data() {
    return {
      archetypeUri: '//digipal.eu',
      
      definitions: {'k1': 'v1'},
      definitionsSha: SHA_UNREAD,
      areDefinitionsUnsaved: 0,

      //
      variantRules: [],
      variantRulesSha: SHA_UNREAD,
      areVariantRulesUnsaved: 0,

      selection: {
        script: '',
        scriptName: '',
        tab: 'definitions',
        innerTab: 'ac',
        gtoken: window.localStorage.getItem('gtoken') || '',
      },
      newItems: {
        allograph: '',
        component: '',
        feature: '',
      },
      messages: [],
      afs: null,
      stats: {},
    }
  },
  computed: {
    tabs: () => utils.tabs(),
    isUnsaved() { 
      return this.areDefinitionsUnsaved || this.areVariantRulesUnsaved
    },
    innerTabs() {
      return [
        {title: 'Allographs x Components', key: 'ac'},
        {title: 'Components x Features', key: 'cf'},
        {title: 'Variant types', key: 'vt'},
      ]
    },
    isLoggedIn() {
      return this.afs?.isAuthenticated()
    },
    canEdit() {
      return this.isLoggedIn
    },
    filteredAllographs() {
      return this.getFilteredDefinitions('allographs', (a) => a.character)
    },
    filteredComponents() {
      return this.getFilteredDefinitions('components', (a) => a.name)
    },
    filteredFeatures() {
      return this.getFilteredDefinitions('features', (a) => a)
    },
    filteredVariantRules() {
      return this.variantRules.filter(r => this.definitions.allographs[`${r.allograph}-${this.selection.script}`])
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
  },
  async mounted() {
    this.setSelectionFromAddressBar()
    await this.initAnyFileSystem()
    await this.loadDefinitions()
    await this.loadStats()
    await this.loadVariantRules()
  },
  watch: {
    'selection.script'() {
      this.setScriptName()
      this.setAddressBarFromSelection()
    }
  },
  methods: {
    async initAnyFileSystem() {
      this.afs = new AnyFileSystem()
      await this.afs.authenticateToGithub(this.selection.gtoken)
    },
    getUsageFromElement(typeCode, elementSlug) {
      // returns how many times the component, feature has been annotated
      let ret = 1
      if (this?.stats?.data) {
        ret = this.stats.data[typeCode] ? this.stats.data[typeCode][elementSlug] || 0 : 0
      }
      return ret
    },
    getFilteredDefinitions(collectionName, getNameFromItem) {
      let ret = {}
      let items = this.definitions[collectionName]
      if (items) {
        function sortFunction(a, b) {
          a = getNameFromItem(items[a])
          b = getNameFromItem(items[b])
          return a === b ? 0 : (a > b ? 1 : -1)
        }
        
        for (let k of Object.keys(items).sort(sortFunction)) {
          let item = items[k]
          if (collectionName != 'allographs' || this.selection.script === item.script) {
            ret[k] = item
          }
        }
      }
      return ret
    },
    onRenameFeature(event, featureSlug) {
      let name = event.target.textContent.trim()

      // duplicate name?
      if (this._itemExist('feature', name)) name = '';

      //
      if (name) {
        this.definitions.features[featureSlug] = name
        this.areDefinitionsUnsaved = 1
      } else {
        // undo change
        event.target.textContent = this.definitions.features[featureSlug]
      }
    },
    onRenameComponent(event, component) {
      let name = event.target.textContent.trim()

      // duplicate name?
      if (this._itemExist('component', name)) name = '';

      //
      if (name) {
        component.name = name
        this.areDefinitionsUnsaved = 1
      } else {
        // undo change
        event.target.textContent = component.name
      }
    },
    _itemExist(itemType, name) {
      if (!['script', 'component', 'feature'].includes(itemType)) {
        throw new Error(`_itemExist: wrong itemType ${itemType}`)
      }
      let ret = false
      let items = this.definitions[itemType+'s']

      name = name.trim()
      let slug = utils.slugify(name)
      ret = !!(items[slug]);
      if (!ret) {
        ret = Object.values(items).filter(
          i => (i.name || i).toLowerCase() == name.toLowerCase()
        ).length > 0
      }

      return ret
    },
    onRemoveAllograph(allographSlug) {
      delete this.definitions.allographs[allographSlug]
      this.areDefinitionsUnsaved = 1
    },
    onRemoveComponent(componentSlug) {
      delete this.definitions.components[componentSlug]
      for (let allograph of Object.values(this.definitions.allographs)) {
        allograph.components = allograph.components.filter(slug => slug != componentSlug)
      }
      this.areDefinitionsUnsaved = 1
    },
    onRemoveFeature(featureSlug) {
      delete this.definitions.features[featureSlug]
      for (let component of Object.values(this.definitions.components)) {
        component.features = component.features.filter(slug => slug != featureSlug)
      }
      this.areDefinitionsUnsaved = 1
    },
    removeUndefinedComponentsAndFeatures() {
      for (let allograph of Object.values(this.definitions.allographs)) {
        allograph.components = allograph.components.filter(slug => {
          let res = slug in this.definitions.components
          if (!res) { console.log(`REMOVED ${allograph.script}.${allograph.character}.${slug}`) }
          return res
        })
      }

      for (let component of Object.values(this.definitions.components)) {
        component.features = component.features.filter(slug => {
          let res = slug in this.definitions.features
          if (!res) { console.log(`REMOVED ${component.name}.${slug}`) }
          return res
        })
      }
    },
    onAddItem(itemType) {
      let name = this.newItems[itemType]
      name = name.trim()
      if (!name) return;

      let slug = name
      if (itemType != 'allograph') {
        slug = utils.slugify(name)
      } else {
        slug = `${slug}-${this.selection.script}`
      }
      if (!slug) return;

      let items = this.definitions[itemType+'s'] 
      let item = null

      if (itemType == 'allograph') {
        item = items[slug]
        if (!(item && item.script == this.selection.script)) {
          item = {
            script: this.selection.script,
            character: name,
            components: []
          }
        } else {
          item = null
        }
      } else {
        if (!this._itemExist(itemType, name)) {
          if (itemType == 'component') {
            item = {
              name: name,
              features: []
            }
          }
          if (itemType == 'feature') {
            item = name
          }    
        }
      }

      if (item) {
        items[slug] = item
        this.newItems[itemType] = ''
        this.areDefinitionsUnsaved = 1
      }
    },
    onCreateScript() {
      let name = this.selection.scriptName.trim()
      let slug = utils.slugify(name)
      if (!slug) return;

      if (this._itemExist('script', name)) return;

      this.definitions.scripts[slug] = name
      this.selection.script = slug
      this.areDefinitionsUnsaved = 1
    },
    onRenameScript() {
      let name = this.selection.scriptName.trim()
      if (!name) return;

      if (this._itemExist('script', name)) return;
      this.definitions.scripts[this.selection.script] = name
      this.areDefinitionsUnsaved = 1  
    },
    onDeleteScript() {
      // TODO: error management
      delete this.definitions.scripts[this.selection.script]
      this.selectFirstScript()
      // TODO: delete allographs?
      this.areDefinitionsUnsaved = 1
    },
    selectFirstScript() {
      // do nothing if a valid script is already selected
      if (!(this.definitions?.scripts && this.definitions?.scripts[this.selection.script])) {
        this.selection.script = Object.keys(this.definitions.scripts)[0]
      } else {
        this.setScriptName()
      }
    },
    setScriptName() {
      if (this.definitions.scripts) {
        this.selection.scriptName = this.definitions.scripts[this.selection.script]
      }
    },
    onClickInnerTab(tabKey) {
      this.selection.innerTab = tabKey
      this.setAddressBarFromSelection()
    },
    onClickAllographComponent(allo, componentSlug) {
      if (!this.canEdit) return;
      if (allo.components.includes(componentSlug)) {
        allo.components = allo.components.filter((c) => c != componentSlug)
      } else {
        allo.components.push(componentSlug)
      }
      this.areDefinitionsUnsaved = 1
    },
    onClickComponentFeature(component, featureSlug) {
      if (!this.canEdit) return;
      if (component.features.includes(featureSlug)) {
        component.features = component.features.filter((f) => f != featureSlug)
      } else {
        component.features.push(featureSlug)
      }
      this.areDefinitionsUnsaved = 1
    },
    async loadStats() {
      this.stats = null
      if (IS_BROWSER_LOCAL) {  
        this.stats = await utils.fetchJsonFile('stats.json')
      } else {
        let res = await this.afs.readJson(STATS_PATH)
        if (res.ok) {
          this.stats = res.data
        } else {
          this.logMessage(`Could not load definition stats (${res.description})`, 'danger')
        }
      }
    },
    async loadDefinitions() {
      // // TODO: temporarily locals
      // let res = await utils.readGithubJsonFile(definitionsPath, this.getOctokit())
      let res = await this.afs.readJson(definitionsPath)
      if (res.ok) {
        this.definitions = res.data
        this.definitionsSha = res.sha
        this.removeUndefinedComponentsAndFeatures()
        this.selectFirstScript()
        this.clearMessages()
      } else {
        this.logMessage(`Could not load definitions (${res.description})`, 'danger')
      }
      this.setAddressBarFromSelection()
      this.areDefinitionsUnsaved = 0
    },
    async loadVariantRules() {
      let res = await this.afs.readJson(VARIANT_RULES_PATH)
      if (res && res.ok) {
        this.variantRules = res.data
        this.variantRulesSha = res.sha
        // sort the rules
        this.variantRules = utils.sortMulti(this.variantRules, [
          'allograph', 
          'variant-name'
        ])
      } else {
        this.variantRules = []
        this.logMessage(`Failed to load variant rules from github (${res.description})`, 'error')
      }
    },
    onRemoveRule(rule) {
      this.variantRules = this.variantRules.filter(r => r !== rule)
      this.areVariantRulesUnsaved = 1
    },
    async saveAll() {
      // TODO: if definition fails & rules succeed user won't see error.
      await this.saveDefinitions()
      await this.saveVariantRules()
    },
    async saveDefinitions() {
      if (!this.areDefinitionsUnsaved) return;
      this.definitions.updated = new Date().toISOString()
      let res = await this.saveToJson(definitionsPath, this.definitions, this.definitionsSha)
      if (res?.ok) {
        this.definitionsSha = res.sha
        this.areDefinitionsUnsaved = 0
      }
    },
    async saveVariantRules() {
      if (!this.areVariantRulesUnsaved) return;
      let res = await this.saveToJson(VARIANT_RULES_PATH, this.variantRules, this.variantRulesSha)
      if (res?.ok) {
        this.variantRulesSha = res.sha
        this.areVariantRulesUnsaved = 0
      }
    },
    async saveToJson(targetPath, objectToSave, githubSha) {
      // let res = await utils.updateGithubJsonFile(definitionsPath, this.definitions, this.getOctokit(), this.definitionsSha)
      let res = null
      if (DEBUG_DONT_SAVE) {
        res = {
          ok: false,
          description: 'Not saving in DEBUG mode. DEBUG_DONT_SAVE = true.',
        }
      } else {
        res = await this.afs.writeJson(targetPath, objectToSave, githubSha)
      }
      if (res.ok) {
        // this.definitionsSha = res.sha
        // this.isUnsaved = 0
        this.clearMessages()
        this.logMessage('Definitions saved.', 'info')
      } else {
        this.logMessage(`Could not save definitions (${res.description})`, 'danger')
      }
      return res
    },
    onShortenCollection(e) {
      const self = this;
      let uri = collectionUri;

      // TODO: remove hard-coded values
      const toKeep = new RegExp('ISic0000(01|07|31|46|79)$')

      fetch(uri).then(r => r.json()).then(res => {
        ret = res

        ret.member = ret.member.filter(
          m => 
          !!(m && m.title.match(toKeep))
        )

        ret.totalItems = ret.member.length
        ret['dts:totalChildren'] = ret.member.length

        self.definitions = ret
      })
      
    },
    onImportDefinitions(e) {
      const self = this;
      let uri = self.archetypeUri + componentUri;

      fetch(uri).then(r => r.json()).then(res => {
        let features = {};
        let components = {};
        for (let c of res.results) {
          components[this.slugify(c.name)] = {
            name: c.name,
            features: c.componentfeature_set.map(cf => this.slugify(cf.feature))
          }
          for (cf of c.componentfeature_set) {
            features[this.slugify(cf.feature)] = cf.feature
          }
        }

        uri = self.archetypeUri + allographUri;
        fetch(uri).then(r => r.json()).then(res => {
          const allographs = {};
          
          for (let a of res.results) {
            let allograph_name = a.character

            let allograph = {
              script: 'SCRIPT',
              character: a.character,
              components: a.allograph_components.map(c =>
                this.slugify(c.component.name)
              )
            }
            allographs[this.slugify(allograph_name, true)] = allograph
          }

          let ret = {
            'context': self.archetypeUri,
            'version': '0.1',
            'updated': new Date().toISOString(),
            'scripts': {},
            'features': features,
            'components': components,
            'allographs': allographs,
          };
          self.definitions = ret;
        })
      })
    },
    slugify(text, preserveCase=false) {
      // stolen from https://gist.github.com/codeguy/6684588?permalink_comment_id=4176055#gistcomment-4176055
      let ret = text
        .toString()                           // Cast to string (optional)
        .normalize('NFKD')            // The normalize() using NFKD method returns the Unicode Normalization Form of a given string.

      if (!preserveCase)
        ret = ret
        .toLowerCase()                  // Convert the string to lowercase letters

      ret = ret
        .trim()                                  // Remove whitespace from both sides of a string (optional)
        .replace(/\s+/g, '-')            // Replace spaces with -
        .replace(/[^.\w\-]+/g, '')     // Remove all non-word chars
        .replace(/\-\-+/g, '-');        // Replace multiple - with single -
      
      return ret
    },
    getQueryString() {
      return utils.getQueryString()
    },
    setAddressBarFromSelection() {
      let searchParams = new URLSearchParams(window.location.search);

      searchParams.set('itb', this.selection.innerTab)
      searchParams.set('scr', this.selection.script)

      let qs = `?${searchParams.toString()}`
      history.replaceState(null, "", qs);
    },
    setSelectionFromAddressBar() {
      let searchParams = new URLSearchParams(window.location.search);

      this.selection.innerTab = searchParams.get('itb') || 'ac'
      this.selection.script = searchParams.get('scr') || ''
    },
    logMessage(content, level = 'info') {
      // level: info|primary|success|warning|danger
      this.messages.push({
        content: content,
        level: level,
        created: new Date()
      })
    },
    clearMessages() {
      this.messages.length = 0
    },
    getURLFromAlloType(rule) {
      return utils.getURLFromAlloType(rule, '../')
    }
  }
}).mount('#definitions')

