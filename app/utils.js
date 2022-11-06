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
      let getUrl = `https://api.github.com/repos/kingsdigitallab/webval/contents/${filePath}`;
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
        let getUrl = `https://api.github.com/repos/kingsdigitallab/webval/contents/${filePath}`;

        // let res = await fetch(getUrl, {cache: "no-cache"})
        let res = await fetch(getUrl);
        if (res && res.status == 200) {
          res = await res.json();
        }
      } else {
        // TODO: simple relative fetch, no sha
        let getUrl = `../${filePath}`;
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

  // server-side
  exports.compareScreenshots = async function (projectSlug, folderA, folderB) {
    let ret = {}

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
    const BlinkDiff = require("blink-diff");

    const diffDirName = `${folderA}-${folderB}`;

    const shotDirs = [folderA, folderB, diffDirName].map((p) =>
      path.join(screenshotsPath, p)
    );
    fs.mkdirSync(shotDirs[2], { recursive: true });

    await fs.readdirSync(shotDirs[0]).forEach(async (filename) => {
      let paths = shotDirs.map((p) => path.join(p, filename));
      if (fs.existsSync(paths[1])) {
        var diff = new BlinkDiff({
          imageAPath: paths[0], // Use already loaded image for first image
          imageBPath: paths[1], // Use file-path to select image

          delta: 20, // Make comparison more tolerant

          outputMaskRed: 255,
          outputMaskBlue: 0, // Use blue for highlighting differences

          hideShift: true, // Hide anti-aliasing differences - will still determine but not showing it

          imageOutputPath: paths[2],
          composition: true,
        });

        let res = await diff.run(function (error, result) {
          if (error) {
            throw error;
          } else {
            ret[filename] = result
            // console.log(diff.hasPassed(result.code) ? 'Passed' : 'Failed');
            // console.log('Found ' + result.differences + ' differences.');
            // console.log(paths[2])
          }
        });
      }
    });

    return ret
  };

  exports.getIssuesFromPastedSiteImprove = function(pastedIssues, webpath, host) {
    let pastedIssues2 = `
    Back to all issues
    Recheck page
    Siteimprove logoClose the Siteimprove accessibility checker
    
    Accessibility Checker
    Choose filters
    Choose conformance level
    
    A conformance 9issues
    
    AA conformance 11issues
    
    AAA conformance 12issues
    What does conformance level mean?
    Choose severity
    
    
    Error 3issues
    
    
    Warning 4issues
    
    Review 5issues
    What does severity mean?
    Choose responsibility
    
    
    Editor 3issues
    
    
    Webmaster 5issues
    
    
    Developer 4issues
    What does responsibility mean?
    Issues
    Adaptable
    
    a
    Info and Relationships
    1.3.1
    16
    occurrences
    
    
    
    Warning
    "i" tag used to format text
    1
    occurrence
    
    Webmaster
    
    
    Warning
    Non-distinguishable landmarks
    10
    occurrences
    
    Webmaster
    
    
    Warning
    Content not included in landmarks
    5
    occurrences
    
    Webmaster
    Distinguishable
    
    a
    Use of Color
    1.4.1
    4
    occurrences
    
    
    
    Error
    Link identified only by color
    4
    occurrences
    
    Developer
    
    aa
    Contrast (Minimum)
    1.4.3
    2
    occurrences
    
    
    
    Error
    Color contrast is insufficient
    2
    occurrences
    
    Developer
    Navigable
    
    a
    Bypass Blocks
    2.4.1
    1
    occurrence
    
    
    
    Warning
    No option to skip repeated content
    1
    occurrence
    
    Developer
    Get Your Full Website Check
    FAQTerms of ServicePrivacy Policy
    © 2017–2022 Siteimprove
    `
    let pastedIssues3 = `
    opens in a new window:CultureCase ↗
    Siteimprove logo
    Accessibility Checker
    
    Issues
    
    Explorer
    Issues
    3
    Search
    Page zoom is restricted →
    1.4.4 Resize text
    1.4.10 Reflow
    1
    Line height is below minimum value →
    1.4.8 Visual Presentation
    2
    Skip to main content link is missing →
    Accessibility best practices
    1
    Siteimprove logo
    opens in a new window:Get your full website check ↗    
    `
    let ret = []

    let lines = pastedIssues.split('\n').map(l => l.trim())

    let ignoreNext = false
    let code = null
    let lastNonCodeLine = ''
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]

      // new browser plugin (v2+)
      let m = line.match(/^(\d+.\d+\.\d+) (\w+.+)$/)
      if (m) {
        let code = m[1]
        let codeParts = code.split('.')
        ret.push({
          code: `SITEIMPROVE-${code}`,
          message: `${lastNonCodeLine}`,
          context: '',
          selector: '',
          runner: 'siteimprove',
          host: host,
          webpath: webpath,
          rule: {
            standard: 'WCAG2',
            principle: codeParts[0],
            guideline: codeParts[1],
            rule: codeParts[2],
          }
        })
        // console.log(code, lastNonCodeLine)
      } else {
        lastNonCodeLine = line.replace('→', '').trim()
      }

      // legacy browser plugin 127
      if (line.match(/^\d+.\d+\.\d+$/)) {
        ignoreNext = true
        code = line
      }

      if (line.match(/^occurrences?$/)) {
        if (ignoreNext) {
          ignoreNext = false
        } else {
          let codeParts = code.split('.')
          ret.push({
            code: `SITEIMPROVE-${code}`,
            message: lines[i-2],
            context: '',
            selector: '',
            runner: 'siteimprove',
            host: host,
            webpath: webpath,
            rule: {
              standard: 'WCAG2',
              principle: codeParts[0],
              guideline: codeParts[1],
              rule: codeParts[2],
            }
          })
        }
      }
    }
    // console.log(lines)

    return ret
  }
})(typeof exports === "undefined" ? (this["utils"] = {}) : exports);
