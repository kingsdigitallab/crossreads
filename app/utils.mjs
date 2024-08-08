// This module can be imported from the browser or nodejs
// https://stackoverflow.com/questions/950087/how-do-i-include-a-javascript-file-in-another-javascript-file

export const IS_BROWSER = (typeof window !== "undefined")
export const IS_BROWSER_LOCAL = IS_BROWSER && (window.location.hostname == 'localhost')
export const DEBUG_DONT_SAVE = false;
// export const DEBUG_DONT_SAVE = IS_BROWSER;

async function mod(exports) {

  let fs = null
  if (!IS_BROWSER) {
    fs = (await import('fs'));
  }

  exports.slugify = function(str) {
    return str.replace(/\W+/g, '-').toLowerCase()
  }

  exports.setQueryString = function(parameters) {
    let newRelativePathQuery = window.location.pathname
    let qsKeys = Object.keys(parameters)
    let qs = ''
    if (qsKeys.length) {
      for (let k of qsKeys) {
        if (parameters[k]) {
          if (qs) qs += '&';
          qs += `${k}=${parameters[k]}`
        }
      }
      if (qs) {
        qs = `?${qs}`
        newRelativePathQuery += qs
      }
    }
    history.pushState(null, "", newRelativePathQuery);
    return qs
  }

  exports.getQueryString = function() {
    // returns query string, starting with ?
    return window.location.search
  }

  exports.tabs = function() {
    return [
      {title: 'Annotator', key: 'annotator'},
      {title: 'Definitions', key: 'definitions'},
      {title: 'Search', key: 'search'},
      {title: 'Settings', key: 'settings'},
    ]
  }

  function initFillHeightElements() {
    for (let element of document.querySelectorAll('.responsive-height')) {
      let height = (window.innerHeight - element.offsetTop + window.scrollY - 15)
      if (height < 10) {
        height = 10
      }
      element.style.height = `${height}px`;
      // console.log(element.style.height)
    }
  }

  exports.exec = async function(command) {
    // TODO: test
    // const {execSync} = require('child_process')
    let child_process = (await import('child_process'));
    return child_process.execSync(command)
  }

  // --------------------------------------------
  // FILE SYSTEM
  // --------------------------------------------

  exports.fetchJsonFile = async function(path) {
    let ret = null
    let res = await fetch(path);
    if (res && res.status == 200) {
      ret = await res.json();
    }
    return ret
  }

  exports.readJsonFile = function(path) {
    let ret = null
    if (fs.existsSync(path)) {
      let content = fs.readFileSync(path, {encoding:'utf8', flag:'r'})
      ret = JSON.parse(content)
    }
    return ret
  }

  exports.writeJsonFile = function(path, content) {
    content = JSON.stringify(content, null, 2)
    fs.writeFileSync(path, content)
  }

  // --------------------------------------------

  if (IS_BROWSER) {
    window.addEventListener("resize", initFillHeightElements);
    document.addEventListener("scroll", initFillHeightElements);
    window.addEventListener("load", (event) => {
      initFillHeightElements();
    });
  }
}

export let utils = {}
await mod(utils)
