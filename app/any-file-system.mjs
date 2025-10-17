// This module can be imported from the browser or nodejs
// https://stackoverflow.com/questions/950087/how-do-i-include-a-javascript-file-in-another-javascript-file

import { Octokit } from 'octokit';
import { utils, DEBUG_DONT_SAVE, IS_BROWSER_LOCAL, IS_BROWSER, SETTINGS } from "./utils.mjs";

const USE_RAW_FOR_GIT_ANONYMOUS = true
const GITHUB_REPO_PATH = SETTINGS.GITHUB_REPO_PATH // 'kingsdigitallab/crossreads'

export class AnyFileSystem {  
  /*
  Unified file read/write interface over different file systems.

  Use it to read/write all JSON data files that belongs to this code base or repository.

  Use other methods (see utils.mjs) for data outside this code base.

  Should support the following systems:
  * local : read/write from locally mounted filesystem
  * http  : read-only http fetches
  * github: personal authenticationn token (PAT) is needed for write operations

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

  constructor(githubRepoPath=GITHUB_REPO_PATH) {
    this.githubRepoPath = githubRepoPath
    this.resetAuthStatus()
  }

  resetAuthStatus() {
    // prefixes to remove from the user-given paths
    this.prefixes = {}
    // this.prefixes[this.SYSTEMS.HTTP] = 'app/'
    this.prefixes[this.SYSTEMS.HTTP] = SETTINGS.HTTP_PATHS_PREFIX

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
    let ret = null

    if (!system) {
      system = this.guessSystemFromPath(relativePath)
    }

    if (!Object.values(this.SYSTEMS).includes(system)) {
      ret = {
        data: null,
        sha: null,
        label: 'Error',
        description: `Unknown file system: ${system}`,
      }
      return ret
    }

    let prefix = this.prefixes[system]
    if (prefix && relativePath.startsWith(prefix)) {
      relativePath = relativePath.substring(prefix.length)
    }

    if (system == this.SYSTEMS.GIT) {
      ret = await readGithubJsonFile(relativePath, this.octokit, this.githubRepoPath)
    } else {
      if (system == this.SYSTEMS.HTTP) {
        ret = await utils.fetchJsonFile(relativePath)
      }
      if (system == this.SYSTEMS.LOCAL) {
        ret = await utils.readJsonFile(relativePath)
      }
      ret = this.getResponseFromContent(ret)
    }

    return ret
  }

  getResponseFromContent(content) {
    let ret = {
      data: content,
      sha: null,
      label: 'Error',
      description: 'Unknown error',
    }
    ret.ok = Boolean(ret.data)
    if (ret.ok) {
      ret.label = 'ok'
      ret.description = 'ok'
    }
    return ret
  }

  async writeJson(relativePath, data, sha=null, system=null) {
    let ret = null;
    if (!system) {
      system = this.guessSystemFromPath(relativePath)
    }

    if (DEBUG_DONT_SAVE) {
      return {
        ok: false,
        label: 'saving disabled',
        description: 'Not saving in DEBUG mode. DEBUG_DONT_SAVE = true.',
      }
    }

    if (system == this.SYSTEMS.GIT) {
      ret = await updateGithubJsonFile(relativePath, data, this.octokit, this.githubRepoPath, sha)
    } else if (system == this.SYSTEMS.LOCAL) {
        utils.writeJsonFile(relativePath, data)
        ret = this.getResponseFromContent(data)
    } else if (system == this.SYSTEMS.HTTP) {
      ret = {
        ok: false,
        label: 'log in needed',
        description: `Can't save from browser without git authentication`,
      }
    } else {
      ret = {
        ok: false,
        label: 'unknown system',
        description: `Can't save to unrecognised file system ${system}`,
      }
    }

    return ret
  }

  guessSystemFromPath(path) {
    // Determine the system where to read/write a file based on settings & path.
    //
    // TODO: add a setting condition to switch between those two use cases
    // * editing period: better to read from GH so data is always fresh
    // * sustainability/portability: better to http fetch relatively
    // gh-119
    let ret = this.SYSTEMS.GIT

    let canFetchLocally = IS_BROWSER_LOCAL && path.startsWith(this.prefixes[this.SYSTEMS.HTTP])

    if (DEBUG_DONT_SAVE && canFetchLocally) {
      // bypass github and fetch locally for insulated testing purpose
      return this.SYSTEMS.HTTP
    }
    if (this.isAuthenticated()) {
      // b/c we want live content (not a stale copy on Github Pages) with SHA so it can be edited
      return this.SYSTEMS.GIT
    }
    if (path.startsWith('http:') || path.startsWith('https:')) {
      return this.SYSTEMS.HTTP
    }
    if (!IS_BROWSER) {
      return this.SYSTEMS.LOCAL
    }
    if (canFetchLocally) {
      return this.SYSTEMS.HTTP
    }

    // TODO: test thoroughly in browser with all possible paths/files.
    // Ideally we'd want to request on same domain from browser first.
    // But some data files are more up to date in github repo than github Pages.

    return ret
  }
}

function base64Encode(str) {
  // https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem
  if (IS_BROWSER) {
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
  if (IS_BROWSER) {
    const binString = atob(str);
    return new TextDecoder().decode(Uint8Array.from(binString, (m) => m.codePointAt(0)));
  } else {
    throw new Error('add support for unicode to base64Decode() browser implementation')
    // return Buffer.from(str).toString("base64");
  }
}

// client-side
async function readGithubJsonFile(filePath, octokit, githubRepoPath) {
  let ret = {
    data: null,
    sha: null,
    label: 'Error',
    description: 'Unknown error',
  };
  
  let res = null;

  let download = true;

  let apiUrl = `https://api.github.com/repos/${githubRepoPath}/contents/${filePath}`

  // first try using the API (if we have a token)
  if (octokit) {
    let getUrl = apiUrl;
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
  
  // OR use github download link
  if (download) {
    let getUrl = null
    if (USE_RAW_FOR_GIT_ANONYMOUS) {
      getUrl = `https://raw.githubusercontent.com/${githubRepoPath}/refs/heads/main/${filePath}`
    } else {
      // no need for octokit or token BUT rate limit is easily exceeded
      getUrl = apiUrl;
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
  githubRepoPath,
  sha = null,
) {
  let ret = {
    sha: null,
    ok: false,
    label: 'Error',
    description: 'Unknown error',
  };
  let res = null;

  let options = {
    owner: githubRepoPath.split('/')[0],
    repo: githubRepoPath.split('/')[1],
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
