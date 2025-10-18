# Portability

This document goes through a few different scenarios to move the code, the site and the data from their original location on King's Digital Lab repository (https://github.com/kingsdigitallab/crossreads). 

## Scenario 1: fork the site (but use data from `kingsdigitallab/crossreads`)

1. Fork this repository `https://github.com/kingsdigitallab/crossreads` (the **upstream** repository)
2. Enable the Github Pages in Settings (top) > Pages (left) > Source (dropdown) = Github actions
3. Open `app/settings.mjs` and change the value of ANNOTATING_SITE_ROOT to match your site
4. Build the site by going to Actions (top) > Build and deploy annotating site to Github Pages (left) > Run Workflow (green button)
5. To visit site, go back to Settings (top) > Pages (left) > Visit site (button)

You can use your site to view and edit the data (annotations, definitions, etc.).

The code and site are in your fork. **But the data files (annotations, definitions, index, change-queue, stats) are read from (and written to) the upstream repository**.

**Only one action should be run on your fork: Build and deploy annotating site to Github Pages**.

The three others can be run but will update data files on your repo which are not read by your site. So they are ineffective. The three other actions should be run on the upstream repository. For the same reasons, any data processing tool under the `tools` folder should only be run on the upstream repository.

## Scenario 2: fork the site and use forked data

Same as above. And also do the following:

1. UPDATE your main branch with the latest version from the main branch on `kingsdigitallab/crossreads`
2. Open `app/settings.mjs` and change the value of GITHUB_REPO_PATH to match your fork path on github.
3. Build the site (see step 4 above)

**Now you have a copy which is independent from the upstream repo. All the code and data (annotations, definitions, variant-rules, ...) are in your repository. Your site and the command line tools will update your data files.**

## Scenario 3: host the site outside github (but keep the data on github)

Same as scenario 1 or 2 but instead of publishing on github Pages, you clone your fork on your own server.

The site is static (only html, css and client-side javascript) 
and easy to serve using mainstream web services such as nginx, lighttpd or apache. 
Just point the web root to the `/app` folder.

## Scenario 4: host a read-only site and data snapshot outside github

**Note that the annotating environment is not designed to edit data outside github**. 
In this scenario all the data files displayed on the site come from the clone of the fork on your server. 
But everything must stay read-only.

This scenario is for longer term sustainability or archival when dependencies with github are no longer needed.

Same as scenario 3. And also do the following:

1. Open `app/settings.mjs` and change the value of `GITHUB_REPO_PATH` to `null`
2. Change the value of `ANNOTATIONS` to `app/data/annotations`
3. Create a symlink from `app/data/annotations` to `annotations`: `cd app/data; ln -s ../../annotations`
4. Build the site (see step 4 above)
