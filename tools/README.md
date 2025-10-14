This folder contains a suite of javascript command line tools to process the data used by the annotation environment.

```
.
├── filter-collection.js            (write subset of inscription collection for the annotator)
├── index-collection.mjs            (generate a metadata index of the collection subset)
├── gen-allo-type-pages.mjs         (generate static HTML page for each type of allograph)
├── gen-allo-type-tree-page.mjs     (generate static HTML page of the allograph typology)
├── get-allo-types-from-insc.mjs    (generate TEI handNote snippets of allograph types found in the inscriptions)
├── index.mjs                       (generate the search index for all annotations)
├── run-change-queue.mjs            (execute the user-defined changes found in the queue)
├── test-words.mjs                  (deprecated)
├── xgrep.mjs                       (like grep but with an Xpath selector over all TEI files)
├── toolbox.mjs                     (functions used by multiple tools)
├── idconvertor
│   ├── convert-token-ids-2024.py   (deprecated)
│   ├── convert-token-ids-2025.mjs  (convert token ids in annotation files, see gh-108)
│   ├── requirements.txt            (deprecated)
├── fixdata
│   ├── check-definitions.mjs               (report issues in the definition file)
│   ├── convert-img-urls.mjs                (check or replace references to IIIF images in dataset, see gh-109)
│   ├── convert-annotation-urls.mjs         (check or replace prefix of annotation IDs, see gh-124)
│   ├── convert-urls.mjs                    (code shared by convert-img-urls.mjs and convert-annotation-urls.mjs)
│   ├── fix-annotation-filenames.mjs        (deprecated; correct name of annotation files, see gh-71)
│   ├── report-unused-annotation-files.mjs  (report annotation files which TEI image is not found, see gh-100)
│   └── rename-scripts.mjs                  (rename the key of a script in all data files)
├── ISicily                         (a clone of the ISicily TEI corpus)
│   ├── inscriptions                (all the TEI files)
├── templates                       (liquid templates used for generating the static HTML pages)
│   ├── allo-type.liquid
│   ├── allo-types-from-insc.liquid
│   ├── allo-type-tree.liquid
│   ├── allo-type-tree-variants.liquid
│   ├── footer.liquid
│   ├── static-styles.liquid
│   ├── static-styles-tree.liquid
```

gh-X is short for https://github.com/kingsdigitallab/crossreads/issues/X

See also `npm run` (or packages.json) for aliases to some of the above tools:

* collection:filter: extract a subset of the DTS collection of TEI inscriptions
* static: generate all static html pages about the allograph types
* index: re-index the annotations for the search page
* index-collection: index the inscriptions used by the annotators

Some of the above actions are automatically called by github actions 
to keep the dataset up to date. See the content of .github/workflows .

