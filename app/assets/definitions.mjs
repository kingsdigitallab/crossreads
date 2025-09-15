import { utils, FILE_PATHS } from "../utils.mjs";
import { createApp, nextTick } from "vue";
import { AnyFileSystem } from "../any-file-system.mjs";
import { ChangeQueue } from "../change-queue.mjs";

// const componentFeatureUri = '/digipal/api/componentfeature/'
const componentUri = '/digipal/api/component/?@select=name,*componentfeature_set,feature'
const allographUri = '/digipal/api/allograph/?@select=*script_set,*allograph_components,name,character,*component'
const collectionUri = './data/dts/api/collections-2023-01.json'
const SHA_UNREAD = 'SHA_UNREAD'
const SEARCH_PAGE_URL = 'search.html'

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
      // for displaying only, see updateDisplayVariantRules()
      displayVariantRules: [],
      variantRulesErrorCount: 0,

      changeQueue: null,

      selection: {
        script: '',
        scriptName: '',
        tab: 'definitions',
        innerTab: 'ac',
        gtoken: window.localStorage.getItem('gtoken') || '',
        variantRules: new Set(),
        characterNameForPromotedTypes: '',
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
      let errors = ''
      if (this.variantRulesErrorCount) {
        errors = ` (${this.variantRulesErrorCount}⚠️)`
      }
      return [
        {title: 'Characters x Components', key: 'ac'},
        {title: 'Components x Features', key: 'cf'},
        {title: 'Variant types' + errors, key: 'vt'},
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
      return this.displayVariantRules.filter(r => r.script === this.selection.script)
    },
    maxVariantCFs() {
      let ret = 0;
      for (let rule of this.variantRules) {
        ret = Math.max(ret, rule['component-features'].length)
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
    typePromotionError() {
      let ret = null
      let matches = this.selection.characterNameForPromotedTypes.match(/^\S+$/)
      if (!matches) {
        ret = 'Invalid character name for promoted types. Please use only letters and numbers.'
      }
      return ret
    },
    characterNameForPromotedTypesExists() {
      let scriptChar = `${this.selection.characterNameForPromotedTypes}-${this.selection.script}`
      let ret = (this?.definitions?.allographs[scriptChar])
      return ret
    },
    numberOfPendingVariantTypeChanges() {
      let changes = this?.changeQueue?.changes ?? []
      return changes.filter(c => c.changeType === "promoteTypesToCharacter").length
    },
  },
  async mounted() {
    this.setSelectionFromAddressBar()
    await this.initAnyFileSystem()
    await this.loadDefinitions()
    await this.loadStats()
    await this.loadVariantRules()
    await this.loadChangeQueue()
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
          let an = getNameFromItem(items[a])
          let bn = getNameFromItem(items[b])
          return an === bn ? 0 : (an > bn ? 1 : -1)
        }
        
        for (let k of Object.keys(items).sort(sortFunction)) {
          let item = items[k]
          if (collectionName !== 'allographs' || this.selection.script === item.script) {
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
    _itemExist(itemType, aname) {
      if (!['script', 'component', 'feature'].includes(itemType)) {
        throw new Error(`_itemExist: wrong itemType ${itemType}`)
      }
      let ret = false
      let items = this.definitions[`${itemType}s`]

      let name = aname.trim()
      let slug = utils.slugify(name)
      ret = !!(items[slug]);
      if (!ret) {
        ret = Object.values(items).filter(
          i => (i.name || i).toLowerCase() === name.toLowerCase()
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
        allograph.components = allograph.components.filter(slug => slug !== componentSlug)
      }
      this.areDefinitionsUnsaved = 1
    },
    onRemoveFeature(featureSlug) {
      delete this.definitions.features[featureSlug]
      for (let component of Object.values(this.definitions.components)) {
        component.features = component.features.filter(slug => slug !== featureSlug)
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
      if (itemType !== 'allograph') {
        slug = utils.slugify(name)
      } else {
        slug = `${slug}-${this.selection.script}`
      }
      if (!slug) return;

      let items = this.definitions[`${itemType}s`] 
      let item = null

      if (itemType === 'allograph') {
        item = items[slug]
        if (!(item && item.script === this.selection.script)) {
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
          if (itemType === 'component') {
            item = {
              name: name,
              features: []
            }
          }
          if (itemType === 'feature') {
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
      if (!(this.definitions?.scripts?.[this.selection.script])) {
        this.selection.script = Object.keys(this.definitions.scripts)[0]
      } else {
        // TODO: why is this not always called at the end of this method?
        // bc there's a watch on this.selection.script calling this anyway?
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
      setTimeout(() => {
        utils.initFillHeightElements();
      }, 1000)
    },
    onClickAllographComponent(allo, componentSlug) {
      if (!this.canEdit) return;
      if (allo.components.includes(componentSlug)) {
        allo.components = allo.components.filter((c) => c !== componentSlug)
      } else {
        allo.components.push(componentSlug)
      }
      this.areDefinitionsUnsaved = 1
    },
    onClickComponentFeature(component, featureSlug) {
      if (!this.canEdit) return;
      if (component.features.includes(featureSlug)) {
        component.features = component.features.filter((f) => f !== featureSlug)
      } else {
        component.features.push(featureSlug)
      }
      this.areDefinitionsUnsaved = 1
    },
    async loadStats() {
      this.stats = null
      let res = await this.afs.readJson(FILE_PATHS.STATS)
      if (res.ok) {
        this.stats = res.data
      } else {
        this.logMessage(`Could not load definition stats (${res.description})`, 'danger')
      }
    },
    async loadDefinitions() {
      let res = await this.afs.readJson(FILE_PATHS.DEFINITIONS)
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
    async loadChangeQueue() {
      this.changeQueue = new ChangeQueue()
      await this.changeQueue.authenticateToGithub(this.selection.gtoken)
      let res = await this.changeQueue.load()
      if (!res.ok) {
        this.logMessage(`Could not load change queue (${res.description})`, 'danger')
      }
    },
    async loadVariantRules() {
      let res = await this.afs.readJson(FILE_PATHS.VARIANT_RULES)
      if (res?.ok) {
        this.variantRules = res.data
        this.variantRulesSha = res.sha
        // sort the rules
        utils.sortMulti(this.variantRules, [
          'allograph', 
          'variant-name'
        ])
        // sort the C-F within each rule
        for (let rule of this.variantRules) {
          utils.sortMulti(rule['component-features'], ['component', 'feature'])
        }        
        this.updateDisplayVariantRules()
      } else {
        this.variantRules = []
        this.logMessage(`Failed to load variant rules from github (${res.description})`, 'error')
      }
    },
    onRemoveRule(rule) {
      this.variantRules = this.variantRules.filter(r => r !== rule)
      this.areVariantRulesUnsaved = 1
      this.updateDisplayVariantRules()
    },
    async saveAll() {
      // TODO: if definition fails & rules succeed user won't see error.
      await this.saveDefinitions()
      await this.saveVariantRules()
    },
    async saveDefinitions() {
      if (!this.areDefinitionsUnsaved) return;
      this.definitions.updated = new Date().toISOString()
      let res = await this.saveToJson(FILE_PATHS.DEFINITIONS, this.definitions, this.definitionsSha)
      if (res?.ok) {
        this.definitionsSha = res.sha
        this.areDefinitionsUnsaved = 0
      }
    },
    async saveVariantRules() {
      if (!this.areVariantRulesUnsaved) return;
      let res = await this.saveToJson(FILE_PATHS.VARIANT_RULES, this.variantRules, this.variantRulesSha)
      if (res?.ok) {
        this.variantRulesSha = res.sha
        this.areVariantRulesUnsaved = 0
      }
    },
    async saveToJson(targetPath, objectToSave, githubSha) {
      // let res = await utils.updateGithubJsonFile(definitionsPath, this.definitions, this.getOctokit(), this.definitionsSha)
      let res = null
      res = await this.afs.writeJson(targetPath, objectToSave, githubSha)
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
      let uri = collectionUri;

      // TODO: remove hard-coded values
      const toKeep = /ISic0000(01|07|31|46|79)$/

      fetch(uri).then(r => r.json()).then(res => {
        ret = res

        ret.member = ret.member.filter(
          m => 
          !!(m?.title.match(toKeep))
        )

        ret.totalItems = ret.member.length
        ret['dts:totalChildren'] = ret.member.length

        this.definitions = ret
      })
      
    },
    onImportDefinitions(e) {
      let uri = this.archetypeUri + componentUri;

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

        uri = this.archetypeUri + allographUri;
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
            'context': this.archetypeUri,
            'version': '0.1',
            'updated': new Date().toISOString(),
            'scripts': {},
            'features': features,
            'components': components,
            'allographs': allographs,
          };
          this.definitions = ret;
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
      this.selection.script = searchParams.get('scr') || 'latin'
    },
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
    clearMessages() {
      this.messages.length = 0
    },
    getURLFromAlloType(rule) {
      return utils.getURLFromAlloType(rule, './')
    },
    getSearchLinkFromAlloType(filteredRule) {
      let rule = filteredRule?.originalRule ?? filteredRule
      return `${SEARCH_PAGE_URL}?f.scr=${rule.script}&f.chr=${rule.allograph}&f.cxf=${rule['component-features'].map(feature => `${feature.component} is ${feature.feature}`).join('|')}`
    },
    // variant rules
    updateDisplayVariantRules() {
      // create a copy of the variant rules
      // with additional fields for rendering in a table.
      
      // structuredClone() not supported by older browsers
      // also won't work on Proxy objects
      let ret = []

      let errorCount = 0

      let ruleHashes = {}

      this.selection.variantRules.clear()

      for (let originalRule of this.variantRules) {
        let rule = JSON.parse(JSON.stringify(originalRule))
        rule.originalRule = originalRule
        ret.push(rule)
        this.setRuleTypeError(rule)
        this.setRuleComponentFeaturesErrors(rule)

        if (ruleHashes[rule.hash]) {
          rule.error = 'E9: there is another type with the same component-features'
        }

        if (rule.error || rule['component-features'].filter(cf => cf.error).length) {
          rule.hasError = 1
          errorCount += 1
        }

        ruleHashes[rule.hash] = 1
      }

      this.displayVariantRules = ret
      this.variantRulesErrorCount = errorCount

      return ret
    },
    setRuleTypeError(rule) {
      let ret = []

      let ruleType = rule['variant-name']

      // return true if typeName has format like 'type1' or 'type2.34.8.77'.
      // valid if 'type' followed by a string of dot separated numbers.
      if (!ruleType.match(/^type\d+(\.\d+)*$/)) {
        ret.push(`E6: Type has an invalid format`)
      }

      if (this.getParentRule(rule) === false) {
        ret.push(`E5: Parent type is missing`)
      }

      let rulesWithSameType = this.variantRules.filter(r => {
        return (
          r.script === rule.script
          && r.allograph === rule.allograph
          && r['variant-name'] == ruleType
        )
      })

      if (rulesWithSameType.length > 1) {
        ret.push(`E7: ${rulesWithSameType.length - 1} rule(s) with the same type`)
      }

      if (ret.length) {
        ret = ret.join('\n')
      } else {
        // return null so vuejs doens't show the tooltip attribute at all
        ret = null
      }

      rule.error = ret

      return ret
    },
    setRuleComponentFeaturesErrors(rule) {
      let ret = []

      // find parent rule
      let parentRule = this.getParentRule(rule)

      // 0. add components from character
      let characterKey = `${rule.allograph}-${rule.script}`
      let character = this.definitions.allographs[characterKey]

      // unique list of component names defined in the rule
      let ruleComponents = [...new Set(rule['component-features'].map(cf => cf.component))]
      for (let component of character.components.sort()) {
        if (ruleComponents.includes(component)) continue;
        let cfCopy = {
          component: component,
          feature: 'UNSPECIFIED',
          source: 'character'
        }
        ret.push(cfCopy)
      }

      // 1. copy CFs from parent rule
      let cfKeys = {}
      if (parentRule) {
        for (let cf of parentRule['component-features']) {
          let cfCopy = {
            component: cf.component,
            feature: cf.feature,
            source: 'parent-type',
            error: 'E1: This component-feature pair is defined in parent type but not in this type'
          }
          ret.push(cfCopy)
          let cfKey = `${cf.component}|${cf.feature}`
          cfKeys[cfKey] = cfCopy
          // cfKeys[`${cf.component}|`] = cfCopy
        }
      }

      // 2. add remaining CFs from rule
      for (let cf of rule['component-features']) {
        let cfKey = `${cf.component}|${cf.feature}`
        if (!cfKeys[cfKey]) {
          let cfCopy = {
            component: cf.component,
            feature: cf.feature,
            source: 'type',
            // error: !parentRule || cfKeys[`${cf.component}|`] ? null : 'E2: This component is not defined in the parent type'
          }
          ret.push(cfCopy)
          cfKeys[cfKey] = cfCopy
          cfKeys[`${cf.component}|`] = cfCopy
        } else {
          cfKeys[cfKey].error = null
        }
      }

      //
      if (character) {
        for (let cf of ret) {
          if (cf.source === 'character') continue;
          if (!character.components.includes(cf.component)) {
            cf.error = 'E3: This component is not part of the character definition'
          } else {
            if (!this.definitions.components[cf.component].features.includes(cf.feature)) {
              cf.error = 'E4: This feature is not part of the component definition'
            }
          }
        }
      }

      // pad with empty entries so all rows have same nb of columns
      for (let i = ret.length; i < this.maxVariantCFs; i++) {
        ret.push({
          'component': '',
          'feature': '',
        })
      }

      rule['component-features'] = ret
      rule.hash = `${rule.script}|${rule.allograph}|` + Object.keys(cfKeys).sort().join('|')

      return ret
    },
    getParentRule(rule) {
      // return reference to the rule with a parent type
      // if rule['variant-name'] = 'type1.2' =>  eturn rule with 'type1'
      // return null if rule is a root type (e.g. type1)
      // return false if the parent rule was not found
      let ret = null

      let parentType = rule['variant-name'].replace(/\.\d+$/, '')
      if (parentType !== rule['variant-name']) {
        ret = false
        let parents = this.variantRules.filter(p => {
          return (
            p.script === rule.script
            && p.allograph === rule.allograph
            && p['variant-name'] == parentType
          )
        })

        if (parents.length > 0) {
          // todo: check for multiple parents
          ret = parents[0]
        }
      }

      return ret
    },
    onToggleRuleSelection(rule) {
      var selectedRules = this.selection.variantRules
      if (selectedRules.has(rule)) {
        selectedRules.delete(rule)
      } else {
        selectedRules.add(rule)
      }
    },
    isChangePendingOnVariantType(rule) {
      if (!this.changeQueue) return false
      let matchingChanges = this.changeQueue.filter('promoteTypesToCharacter').filter(change => {
        let matchingTypes = change.types.filter(ct => {
          return (
            (ct.script === rule.script) 
            && (ct.variantName === rule['variant-name']) 
            && (ct.character === rule.allograph)
          )
        })
        return matchingTypes.length > 0
      })

      return matchingChanges.length > 0
    },
    isRuleForSubType(rule) {
      return Boolean(rule['variant-name'].match(/\d\.\d/))
    },
    async onPromoteTypesToCharacter() {
      // add a new change to the change queue
      let change = {
        changeType: 'promoteTypesToCharacter',
        types: Array.from(this.selection.variantRules).map(rule => {
          return {
            variantName: rule['variant-name'],
            script: rule.script,
            character: rule.allograph,
          }
        }),
        character: this.selection.characterNameForPromotedTypes,
        script: this.selection.script,
      }
      this.changeQueue.addChange(change)
      let res = await this.changeQueue.save()
      if (!res?.ok) {
        this.changeQueue.removeLastChange()
        this.logError(`Failed to save change queue (${res.description})`)
      } else {
        this.selection.characterNameForPromotedTypes = ''
        this.selection.variantRules.clear()
      }
    },
    getLabelFromDefinition(itemKey, itemType) {
      return utils.getLabelFromDefinition(itemKey, itemType, this.definitions)
    },
    getGitUrlTo(file_key, isRaw=false) {
      return utils.getGitUrlTo(file_key, isRaw)
    },
  },
}).mount('#definitions')

