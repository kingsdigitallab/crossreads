const { createApp } = Vue

// const componentFeatureUri = '/digipal/api/componentfeature/'
const componentUri = '/digipal/api/component/?@select=name,*componentfeature_set,feature'
const allographUri = '/digipal/api/allograph/?@select=*script_set,*allograph_components,name,character,*component'
const collectionUri = './data/dts/api/collections-2023-01.json'
const definitionsPath = 'app/data/pal/definitions-digipal.json'

createApp({
  data() {
    return {
      archetypeUri: '//digipal.eu',
      definitions: {'k1': 'v1'},
      definitionsSha: null,
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
      isUnsaved: 0,
    }
  },
  computed: {
    tabs: () => utils.tabs(),
    innerTabs() {
      return [
        {title: 'Allographs x Components', key: 'ac'},
        {title: 'Components x Features', key: 'cf'},
      ]
    },
    canSave() {
      return !!this.selection.gtoken
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
  },
  mounted() {
    // so we are sure all js modules have been loaded
    window.addEventListener("load", (event) => {
      this.loadDefinitions()
    });
  },
  watch: {
    'selection.script'() {
      this.setScriptName()
    }
  },
  methods: {
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
      // TODO: error management: value already taken
      console.log('renamed')
      // let value = event.target.value.trim()
      let value = event.target.textContent.trim()
      if (value.length) {
        this.definitions.features[featureSlug] = value
      } else {
        event.target.textContent = this.definitions.features[featureSlug]
      }
      this.isUnsaved = 1
    },
    onRenameComponent(event, component) {
      // TODO: error management: value already taken
      let value = event.target.textContent.trim()
      if (value.length) {
        component.name = value
      } else {
        event.target.textContent = component.name
      }
      this.isUnsaved = 1
    },
    onRemoveAllograph(allographSlug) {
      delete this.definitions.allographs[allographSlug]
      this.isUnsaved = 1
    },
    onRemoveComponent(componentSlug) {
      delete this.definitions.components[componentSlug]
      for (let allograph of Object.values(this.definitions.allographs)) {
        allograph.components = allograph.components.filter(slug => slug != componentSlug)
      }
      this.isUnsaved = 1
    },
    onRemoveFeature(featureSlug) {
      delete this.definitions.features[featureSlug]
      for (let component of Object.values(this.definitions.components)) {
        component.features = component.features.filter(slug => slug != featureSlug)
      }
      this.isUnsaved = 1
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
      if (name.length < 1) return;

      let slug = name
      if (itemType != 'allograph') {
        slug = utils.slugify(name)
      } else {
        slug = `${slug}-${this.selection.script}`
      }

      let item = this.definitions[itemType+'s'][slug]

      if (itemType == 'allograph') {
        if (!(item && item.script == this.selection.script)) {
          this.definitions.allographs[slug] = {
            script: this.selection.script,
            character: name,
            components: []
          }
        }
      } else {
        if (!item) {
          if (itemType == 'component') {
            this.definitions.components[slug] = {
              name: name,
              features: []
            }
          }
          if (itemType == 'feature') {
            this.definitions.features[slug] = name
          }
        }
      }

      this.newItems[itemType] = ''
      this.isUnsaved = 1
    },
    onCreateScript() {
      // TODO: error management
      let name = this.selection.scriptName
      let slug = utils.slugify(name)
      this.definitions.scripts[slug] = name
      this.selection.script = slug
      this.isUnsaved = 1
    },
    onRenameScript() {
      // TODO: error management
      this.definitions.scripts[this.selection.script] = this.selection.scriptName
      // TODO: change slug???
      this.isUnsaved = 1
    },
    onDeleteScript() {
      // TODO: error management
      delete this.definitions.scripts[this.selection.script]
      this.selectFirstScript()
      // TODO: delete allographs?
      this.isUnsaved = 1
    },
    selectFirstScript() {
      this.selection.script = Object.keys(this.definitions.scripts)[0]
    },
    setScriptName() {
      this.selection.scriptName = this.definitions.scripts[this.selection.script]
    },
    onClickAllographComponent(allo, componentSlug) {
      if (allo.components.includes(componentSlug)) {
        allo.components = allo.components.filter((c) => c != componentSlug)
      } else {
        allo.components.push(componentSlug)
      }
      this.isUnsaved = 1
    },
    onClickComponentFeature(component, featureSlug) {
      if (component.features.includes(featureSlug)) {
        component.features = component.features.filter((f) => f != featureSlug)
      } else {
        component.features.push(featureSlug)
      }
      this.isUnsaved = 1
    },
    getOctokit() {
      // TODO: create wrapper class around Octokit
      // TODO: cache this
      let ret = null
      if (this.selection.gtoken) {
        ret = new Octokit({
          auth: this.selection.gtoken
        })
      }
      return ret
    },
    async loadDefinitions() {
      // // TODO: temporarily locals
      let res = await utils.readGithubJsonFile(definitionsPath, this.getOctokit())
      // let res = await utils.readGithubJsonFile('../' + definitionsPath)
      if (res) {
        this.definitions = res.data
        this.definitionsSha = res.sha
        this.removeUndefinedComponentsAndFeatures()
        this.selectFirstScript()
      }
      this.setAddressBarFromSelection()
      this.isUnsaved = 0
    },
    async saveDefinitions() {
      // TODO: sha
      this.definitions.updated = new Date().toISOString()
      this.definitionsSha = await utils.updateGithubJsonFile(definitionsPath, this.definitions, this.getOctokit(), this.definitionsSha)
      this.isUnsaved = 0
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
      ret = text
        .toString()                           // Cast to string (optional)
        .normalize('NFKD')            // The normalize() using NFKD method returns the Unicode Normalization Form of a given string.

      if (!preserveCase)
        ret = ret
        .toLowerCase()                  // Convert the string to lowercase letters

      ret = ret
        .trim()                                  // Remove whitespace from both sides of a string (optional)
        .replace(/\s+/g, '-')            // Replace spaces with -
        .replace(/[^\w\-]+/g, '')     // Remove all non-word chars
        .replace(/\-\-+/g, '-');        // Replace multiple - with single -
      
      return ret
    },
    getQueryString() {
      return utils.getQueryString()
    },
    setAddressBarFromSelection() {
      let searchParams = new URLSearchParams(window.location.search);

      let qs = `?${searchParams.toString()}`
      decodeURIComponent(qs)
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
  }
}).mount('#definitions')
