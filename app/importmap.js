const importmap = {
  "imports": {
    "vue": "./node_modules/vue/dist/vue.esm-browser.js"
  }
}

// Ugly injection to work around 
// absence of external importmap support
// in 2024 html standard.
// https://github.com/WICG/import-maps/issues/235
// Issues with Firefox...
document.write(`<script type="importmap">${JSON.stringify(importmap)}</script>`)
