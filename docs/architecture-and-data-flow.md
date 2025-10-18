
![Crossreads Petrography workflow - Data Flow Diagram (v1, March 2025)](https://github.com/user-attachments/assets/f31734bd-7774-4854-a39f-63ce01d90866)

The annotating environment is a web application written in static html, js (vuejs reactive framework) and css (Bulma framework).

* Images are displayed with OpenSeaDragon Viewer with IIIF extension to fetch images from Image server hosted in Oxford
* Annotations (W3C Web Annotation format) are drawn using annotorious extension to OpenSeaDragon
* TEI Collection is obtained from flatfile DTS endpoint on ISicily github repository
* TEI documents obtained from that github repository
* TEI transformed into HTML in teh browser using SaxonJS library
* All other data files are stored in json format in this github repository (`/annotations` and `/app/data`)
* They are read and written using Github API (octokit)
* Battery of nodejs/javscript tools for offline data processing lives under `/tools` folder
* Github actions for generating the search index, stats.json, building the typology and publishing the site
* All github actions delegate data processing to the tools
* Some javascript modules (e.g. utils.mjs) are shared between the browser app and the offline tools
* These modules are written and tested to remain compatible with both environments
