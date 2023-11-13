KDL codebase for the CROSSREADS research project

Annotator: https://kingsdigitallab.github.io/crossreads/annotator.html

Main site: https://crossreads.web.ox.ac.uk/

# Content

## Annotator

A pure client-side javascript application running in the browser allowing researchers
to bound graphs found in photographs of text-bearing objects and describe them using 
a structured language.

### Principles

* The architecture is meant to be open and modular so it can be easily integrated with other services.
* Follow existing data standards, as much as possible
* Intuitive and efficient UI, designed to streamline bulk annotation of a large number of graphs

Status: **local prototype**

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

### TODO:

* new UI to edit the palaeographical definitions
* load & save annotation to github (currently saved in Browser session)
* modular backend to load & save (e.g. github, Archetype, DB)


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
