// This module can be imported from the browser or nodejs
// https://stackoverflow.com/questions/950087/how-do-i-include-a-javascript-file-in-another-javascript-file

import { Octokit } from 'octokit';
import { utils } from "./utils.mjs";

const isBrowser = (typeof window !== "undefined")

export class AnyFileSystem {  
  /*
  Unified file read/write interface over different file systems.

  Should support the following systems:
  * github: classic token authentication is needed for write operations
  * http  : read-only fetches
  * local : read/write from locally mounted filesystem

  Advantages:
  * similar protocol across medium (e.g. return values, error codes)
  * allows to move data from one system to another with minimal code change (e.g. archival, testing)
  * same data can be accessed from same code running in nodejs or browser

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
      ok: false,
      label: 'missing',
      description: 'Token missing'
    }
  }

  getUserId() {
    return this.user?.url || ''
  }

  isAuthenticated() {
    return this.authStatus.ok
  }

  async authenticateToGithub(gitToken) {
    this.resetAuthStatus()
    if (gitToken) {

      this.octokit = new Octokit({
        auth: gitToken,
        // Otherwise any conflict takes sevral seconds to return
        // causing a long, confusing delay in the UI.
        // Unfortunately we can't disable retry for specific requests.
        retry: { enabled: false }
      })  

      if (this.octokit) {
        let res = null
        res = await this.octokit.rest.users.getAuthenticated()
          .catch(
            err => {
              // e.g. 'Bad credentials'
              this.authStatus = {
                // null if auth not attempted yet; true: successful; false: error
                ok: false,
                label: 'Error',
                description: `${err.message}`
              }  
              res = null
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

    if (!this.authStatus.ok) {
      this.octokit = null
      this.user = null
    }

    return this.authStatus
  }

  async readJson(relativePath, system=null) {
    let ret = null;

    if (!system) {
      system = this.guessSystemFromPath(relativePath)
    }

    if (system == this.SYSTEMS.GIT) {
      ret = await readGithubJsonFile(relativePath, this.octokit)
    } else {
      if (system == this.SYSTEMS.HTTP) {
        ret = await utils.fetchJsonFile(relativePath)        
      }
      if (system == this.SYSTEMS.LOCAL) {
        ret = await utils.readJsonFile(relativePath)
      }
    }

    return ret
  }

  async writeJson(relativePath, data, sha=null, system=null) {
    // todo: default error struct
    let ret = null;
    if (!system) {
      system = this.guessSystemFromPath(relativePath)
    }

    if (system == this.SYSTEMS.GIT) {
      ret = await updateGithubJsonFile(relativePath, data, this.octokit, sha)
    } else {
      if (system == this.SYSTEMS.HTTP) {
        // TODO: error
        // ret = await utils.fetchJsonFile(relativePath)        
      }
      if (system == this.SYSTEMS.LOCAL) {
        ret = await utils.writeJsonFile(relativePath, data)
      }
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
async function readGithubJsonFile(filePath, octokit) {
  let ret = {
    data: null,
    sha: null,
    label: 'Error',
    description: 'Unknown error',
  };
  
  let res = null;

  let download = true;

  if (octokit) {
    let getUrl = `https://api.github.com/repos/kingsdigitallab/crossreads/contents/${filePath}`;
    try {
      res = await octokit.request(`GET ${getUrl}`, {
        headers: {
          "If-None-Match": "",
        },
      });
      ret.sha = res.data.sha;
      if (res.data.encoding === 'base64') {
        ret.data = JSON.parse(base64Decode(res.data.content))
        download = false
      }
    } catch (err) {
      download = false;
      ret.description = err?.message
      // TODO: populate label
      // if (err?.message != 'Not Found') {
      //   console.log(err);
      // }
    }
  } 
  
  if (download) {
    const USE_RAW_FOR_GIT_ANONYMOUS = true
    let getUrl = null
    if (USE_RAW_FOR_GIT_ANONYMOUS) {
      getUrl = `https://raw.githubusercontent.com/kingsdigitallab/crossreads/main/${filePath}`
    } else {
      // no need for octokit or token BUT rate limit is easily exceeded
      getUrl = `https://api.github.com/repos/kingsdigitallab/crossreads/contents/${filePath}`;
    }
    res = await utils.fetchJsonFile(getUrl)
    if (res) {
      if (USE_RAW_FOR_GIT_ANONYMOUS) {
        ret.data = res
      } else {
        ret.data = JSON.parse(base64Decode(ret.content))
        ret.sha = res.sha
      }
    }
  }

  ret.ok = Boolean(ret.data)
  if (ret.ok) {
    ret.label = 'ok'
    ret.description = 'ok'
  }

  return ret;
};

// client-side
async function updateGithubJsonFile (
  filePath,
  data,
  octokit,
  sha = null
) {
  let ret = {
    sha: null,
    ok: false,
    label: 'Error',
    description: 'Unknown error',
  };
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

    res = await utils.fetchJsonFile(getUrl);
    if (res) {
      sha = res.sha        
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
      ret = {
        ok: true,
        sha: res.data.content.sha,
        label: 'ok',
        description: 'ok'
      }
    } catch (err) {
      console.log(err.message);
      if (err.message.includes("does not match")) {
        ret.label = 'Conflict'
        ret.description = 'Conflict: file already changed by another interface. Please reload the web page to get the latest version.'
      } else {
        ret.description = err.message
      }
    }
  }

  return ret;
};
