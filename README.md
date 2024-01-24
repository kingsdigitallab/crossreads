KDL codebase for the CROSSREADS research project

Annotator: https://kingsdigitallab.github.io/crossreads/annotator.html

Main site: https://crossreads.web.ox.ac.uk/

# Content

## Annotator

A pure client-side javascript application running in the browser allowing researchers
to bound graphs found in photographs of text-bearing objects and describe them using 
a structured language.

### Principles & aims

* "Severless" app: most of the code runs in the browser. The data is read from and written to github.
* The architecture is meant to be open and modular so it can be easily integrated with other services
* Follow existing data standards, as much as possible
* Intuitive and efficient UI, designed to streamline bulk annotation of a large number of graphs

Status: **working prototype**

### Features:

* fetch paleographical definitions from remote Archetype instances and save them as json files
* fetch and lists texts from a Distributed Text Service
* filter texts by keyword
* fetch remote TEI/EpiDoc document associated with a text
* list images found in the document
* shows selected image in OpenSeaDragon, requestd from IIIF server
* draw boxes around graphs on the image with Annotorious plugin
* describe the palaeographical features of the graph using previously fetched definitions
* encode the annotation according to Web Annotation standard
* extract the diplomatic version of the TEI text and show it below the image viewer
* load & save annotations to github (currently saved in Browser session)

### TODO

See the github issue section and the [milestones](https://github.com/kingsdigitallab/crossreads/milestones).

# Develop

To install and run the app localy:

```bash
cd app
npm ci
npm start
```

## Testing

Test that the encoding of the TEI corpus allows word and sign segmentation.

```bash
cd tools
npm ci
npm run test:words
```

## Controlling which inscriptions are listed in the Annotator

A javscript command line app regenerates the DTS sub-collection to inscription listed in the annotator.

It takes two input files:
* [inscriptions.js](https://github.com/kingsdigitallab/crossreads/blob/main/app/data/2023-08/inscriptions.json): an array of inscription IDs.
* [collections.json](https://github.com/kingsdigitallab/crossreads/blob/main/app/data/dts/api/collections.json): the full collection of inscriptions obtained from the DTS Poc in Nov 2022.

And produces [collection.json](https://github.com/kingsdigitallab/crossreads/blob/main/app/data/2023-08/collection.json) a subset, or sub-collection, made by filtering the full collections.json with the shortlisted IDs.

Note that the IDs are case sensitive.

To add more inscriptions to the Annotator, add the desired IDs to the inscriptions.js file then ask a KDL developper to run the filtering script.

```
cd tools
npm ci
npm run collection:filter
```

Then, to publish the changes to the live annotator, [run the deployment action on github](https://github.com/kingsdigitallab/crossreads/actions/workflows/static.yml).

