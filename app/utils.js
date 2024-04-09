// export let utils2 = {};

// import { Octokit, App } from "https://cdn.skypack.dev/octokit@2.0.14";
// This module can be imported from the browser or nodejs
// https://stackoverflow.com/questions/950087/how-do-i-include-a-javascript-file-in-another-javascript-file
(function (exports) {

  // true if this code is running in the browser
  const isBrowser = (typeof window !== "undefined")

  let fs = null
  if (!isBrowser) {
    fs = require('fs');
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

  exports.exec = function(command) {
    const {execSync} = require('child_process')
    return execSync(command)
  }

  // --------------------------------------------
  // FILE SYSTEM
  // --------------------------------------------

  exports.AnyFileSystem = class {  
    /*
    Unified file read/write interface over different file systems.

    Should support the following systems:
    * github: classic token authentication is needed for write operations
    * http  : read-only fetches
    * local : read/write from locally mounted filesystem

    Advantages:
    * similar protocol across medium (e.g. return values, error codes)
    * allows to move data from one system to another with minimal code change (e.g. archival, testing)
    * same data can be accessed from dame code running in nodejs or browser

    author: geoffroy-noel-ddh
    */

    SYSTEMS = {
      LOCAL: 1,
      HTTP:  2,
      GIT:   3,
    }

    constructor() {
      this.resetAuthStatus()
    }

    resetAuthStatus() {
      this.user = null
      this.octokit = null
      this.authStatus = {
        // null if auth not attempted yet; true: successful; false: error
        ok: null,
        label: 'unused',
        description: 'Authentication not attempted yet'
      }
    }

    isAuthenticated() {
      return this.authStatus.ok
    }

    async authenticateToGithub(gitToken) {
      this.resetAuthStatus()
      if (gitToken) {

        this.octokit = new window.Octokit({
          auth: gitToken
        })  

        if (this.octokit) {
          let res = null
          res = await this.octokit.rest.users.getAuthenticated()
            .catch(
              err => {
                this.authStatus = {
                  // null if auth not attempted yet; true: successful; false: error
                  ok: false,
                  label: 'Error',
                  description: `Git authentication error: "${err.message}"`
                }  
                res = null
                this.octokit = null
              }
            );
          if (res) {
            this.user = res.data
            this.authStatus = {
              // null if auth not attempted yet; true: successful; false: error
              ok: true,
              label: 'Authenticated',
              description: `Git authentication was successful.`
            }  
          }
        } else {
          this.authStatus = {
            // null if auth not attempted yet; true: successful; false: error
            ok: false,
            label: 'unknown',
            description: 'Unexpected empty response from git auth.'
          }  
        }
      }

      return this.authStatus
    }

    async readJson(relativePath, system=null) {
      let ret = null;

      if (!system) {
        system = this.guessSystemFromPath(relativePath)
      }

      if (system == this.SYSTEMS.GIT) {
        ret = await exports.readGithubJsonFile(relativePath, this.octokit)
      } else {
        let data = null
        if (system == this.SYSTEMS.GIT) {
          data = await exports.fetchJsonFile(relativePath)        
        }
        if (system == this.SYSTEMS.LOCAL) {
          data = await exports.readJsonFile(relativePath)
        }
        if (data) {
          ret = {
            data: data,
            sha: null,
            ok: true,
            label: 'ok',
            description: 'ok',
          }
        }
      }

      return ret
    }

    async writeJson(relativePath, data, system=null, sha=null) {
      let ret = null;
      if (!system) {
        system = this.guessSystemFromPath(relativePath)
      }

      if (system == this.SYSTEMS.GIT) {
        ret = await exports.updateGithubJsonFile(relativePath, data, this.octokit, sha)
      } else {
        let res = null
        if (system == this.SYSTEMS.GIT) {
          // TODO: error
          // res = await exports.fetchJsonFile(relativePath)        
        }
        if (system == this.SYSTEMS.LOCAL) {
          res = await exports.writeJsonFile(relativePath, data)
        }
        if (res) {
          ret = {
            data: data,
            sha: null,
            ok: res,
            label: 'ok',
            description: 'ok',
          }
        }
        // TODO: error case
      }

      return ret
    }

    guessSystemFromPath(path) {
      // TODO: determine the system based on settings & path
      // isBrowser
      // file://
      // github://
      let ret = this.SYSTEMS.GIT
      if (path.startsWith('http:') || path.startsWith('https:')) {
        ret = this.SYSTEMS.HTTP
      }
      return ret
    }
  }

  function base64Encode(str) {
    // https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem
    if (isBrowser) {
      // return btoa(str);
      const bytes = new TextEncoder().encode(str)
      const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join("");
      return btoa(binString);      
    } else {
      throw new Error('add support for unicode to base64Encode() browser implementation')
      // return Buffer.from(str).toString("base64");
    }
  }

  function base64Decode(str) {
    if (isBrowser) {
      const binString = atob(str);
      return new TextDecoder().decode(Uint8Array.from(binString, (m) => m.codePointAt(0)));
    } else {
      throw new Error('add support for unicode to base64Decode() browser implementation')
      // return Buffer.from(str).toString("base64");
    }
  }

  // client-side
  exports.readGithubJsonFile = async function (filePath, octokit) {
    let ret = null;
    let res = null;
    if (octokit) {
      let getUrl = `https://api.github.com/repos/kingsdigitallab/crossreads/contents/${filePath}`;
      try {
        res = await octokit.request(`GET ${getUrl}`, {
          headers: {
            "If-None-Match": "",
          },
        });
        res = res.data;
      } catch (err) {
        if (err?.message != 'Not Found') {
          console.log(err);
        }
      }
    } else {
      const USE_RAW_FOR_GIT_ANONYMOUS = true
      if (USE_RAW_FOR_GIT_ANONYMOUS) {
        let getUrl = `https://raw.githubusercontent.com/kingsdigitallab/crossreads/main/${filePath}`
        if (0) {
          // TODO: simple relative fetch, no sha
          getUrl = `${filePath}`
        }
        let res = null;
        res = await fetch(getUrl);
        if (res && res.status == 200) {
          ret = {
            data: await res.json(),
            sha: null,
          };
        }
        res = null;
      } else {
        // we don't use octokit here
        // as we want this call to work without a github PAT
        // https://stackoverflow.com/a/42518434
        // TODO: use Octokit if PAT provided, so we don't exceed rate limits
        let getUrl = `https://api.github.com/repos/kingsdigitallab/crossreads/contents/${filePath}`;

        // let res = await fetch(getUrl, {cache: "no-cache"})
        let res = await fetch(getUrl);
        if (res && res.status == 200) {
          res = await res.json();
        }
      }
    }

    if (res) {
      ret = {
        // data: JSON.parse(atob(res.content)),
        data: JSON.parse(base64Decode(res.content)),
        sha: res.sha,
      };
    }

    return ret;
  };

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

  // client-side
  exports.updateGithubJsonFile = async function (
    filePath,
    data,
    octokit,
    sha = null
  ) {
    let ret = null;
    let res = null;

    // °
    // console.log(JSON.stringify(data, null, 2))

    let options = {
      owner: "kingsdigitallab",
      repo: "crossreads",
      // path: `projects/${this.selection.project}/a11y-issues.json`,
      path: filePath,
      message: `Modified ${filePath}`,
      content: base64Encode(JSON.stringify(data, null, 2)),
    };

    // TODO: sha should be obtained when we read the file the first time in the UI
    // and then passed here. Otherwise conflict detection won't work.
    // get the file sha
    if (!sha) {
      let getUrl = `https://api.github.com/repos/${options.owner}/${options.repo}/contents/${filePath}`;

      res = await fetch(getUrl);
      if (res && res.status == 200) {
        res = await res.json();
        sha = res.sha;
      }
    }

    if (sha) {
      // console.log(sha);
      options.sha = sha;
    }
    if (1) {
      try {
        res = await octokit.request(
          "PUT /repos/{owner}/{repo}/contents/{path}",
          options
        );
        ret = res.data.content.sha;
      } catch (err) {
        console.log(err);
        if (err.message.includes("does not match")) {
          console.log("CONFLICT");
          // git conflict
          ret = 0;
        } else {
        }
      }
    }

    return ret;
  };

  // --------------------------------------------

  if (isBrowser) {
    window.addEventListener("resize", initFillHeightElements);
    document.addEventListener("scroll", initFillHeightElements);
    window.addEventListener("load", (event) => {
      initFillHeightElements();
    });
  }

})(typeof exports === "undefined" ? (this["utils"] = {}) : exports);
