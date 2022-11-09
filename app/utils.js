(function (exports) {
  function base64Encode(str) {
    if (typeof window !== "undefined") {
      return btoa(str);
    } else {
      return Buffer.from(str).toString("base64");
    }
  }

  /**
   * Returns a hash code from a string
   * @param  {String} str The string to hash.
   * @return {Number}    A 32bit integer
   * @see http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
   * @see https://stackoverflow.com/a/8831937
   */
  function hashCode(str) {
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
        let chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  // LEGACY: used for upgrading legacy issue files
  // generate a hash code (int) for that issue, so it can be indexed
  exports.getKeyFromIssue_0_1_0 = function(issue, includeWebPath=false) {
    // TODO: use the WCAG numbers instead of the whole code
    // so we can marge with Axe-core issues. 
    let ret = `${issue.code}|${issue.context}|${issue.selector}`
    if (includeWebPath) {
      ret = `${issue.webpath}|` + ret
    }
    ret = hashCode(ret)
    return ret
  }

  // generate a hash code (int) for that issue, so it can be indexed
  exports.getKeyFromIssue = function(issue, includeWebPath=false) {
    let ret = `${issue.rule.standard}|${issue.rule.principle}|${issue.rule.guideline}|${issue.rule.rule}|${issue.context}|${issue.selector}`
    if (includeWebPath) {
      ret = `${issue.webpath}|` + ret
    }
    ret = hashCode(ret)
    return ret
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
        console.log(err);
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
          getUrl = `../${filePath}`
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
        data: JSON.parse(atob(res.content)),
        sha: res.sha,
      };
    }

    return ret;
  };

  // client-side
  exports.updateGithubJsonFile = async function (
    filePath,
    data,
    octokit,
    sha = null
  ) {
    let ret = null;
    let res = null;
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
      console.log(sha);
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

    console.log(ret);

    return ret;
  };

  // server-side
  exports.copyScreenshots = function (projectSlug, source, target) {
    const path = require("path");
    const fs = require("fs");
    const pathScripts = __dirname;
    const screenshotsPath = path.join(
      pathScripts,
      "..",
      "projects",
      projectSlug,
      "screenshots"
    );
    const shotDirs = [
      path.join(screenshotsPath, source),
      path.join(screenshotsPath, target),
    ];
    fs.mkdirSync(shotDirs[1], { recursive: true });
    fs.readdirSync(shotDirs[0]).forEach((filename) => {
      fs.copyFileSync(
        path.join(shotDirs[0], filename),
        path.join(shotDirs[1], filename)
      );
      // console.log(`${path.join(shotDirs[0], filename)} -> ${path.join(shotDirs[1], filename)}`)
    });
  };

  exports.slugify = function(str) {
    return str.replace(/\W+/g, '-')
  }

})(typeof exports === "undefined" ? (this["utils"] = {}) : exports);
