(function (exports) {
  function base64Encode(str) {
    // https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem
    if (typeof window !== "undefined") {
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
    if (typeof window !== "undefined") {
      const binString = atob(str);
      return new TextDecoder().decode(Uint8Array.from(binString, (m) => m.codePointAt(0)));
    } else {
      throw new Error('add support for unicode to base64Decode() browser implementation')
      // return Buffer.from(str).toString("base64");
    }
  }

  /**
   * Returns a hash code from a string
   * @param  {String} str The string to hash.
   * @return {Number}    A 32bit integer
   * @see http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
   * @see https://stackoverflow.com/a/8831937
   */
  // function hashCode(str) {
  //   let hash = 0;
  //   for (let i = 0, len = str.length; i < len; i++) {
  //       let chr = str.charCodeAt(i);
  //       hash = (hash << 5) - hash + chr;
  //       hash |= 0; // Convert to 32bit integer
  //   }
  //   return hash;
  // }

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
      if (0) {
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
      } else {
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
    this.queryString = qs
    history.pushState(null, "", newRelativePathQuery);
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
    for (let element of document.querySelectorAll('.fill-height')) {
      let height = (window.innerHeight - element.offsetTop + window.scrollY - 15)
      if (height < 10) {
        height = 10
      }
      element.style.height = `${height}px`;
    }
  }
  
  window.addEventListener("resize", initFillHeightElements);
  document.addEventListener("scroll", initFillHeightElements);
  window.addEventListener("load", (event) => {
    initFillHeightElements();
  });

})(typeof exports === "undefined" ? (this["utils"] = {}) : exports);
