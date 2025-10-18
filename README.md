[![Collection filtering](actions/workflows/subcollection.yml/badge.svg)](actions/workflows/subcollection.yml)
[![Annotation indexing](https://github.com/kingsdigitallab/crossreads/actions/workflows/index.yml/badge.svg)](https://github.com/kingsdigitallab/crossreads/actions/workflows/index.yml)
[![Site publication](https://github.com/kingsdigitallab/crossreads/actions/workflows/static.yml/badge.svg)](https://github.com/kingsdigitallab/crossreads/actions/workflows/static.yml)
[![Change queue runner](https://github.com/kingsdigitallab/crossreads/actions/workflows/run-change-queue.yml/badge.svg)](https://github.com/kingsdigitallab/crossreads/actions/workflows/run-change-queue.yml)

KDL codebase for the CROSSREADS research project

Annotating environment: https://kingsdigitallab.github.io/crossreads/annotator.html

CROSSREADS site: https://crossreads.web.ox.ac.uk/

# Content

## Annotating environment

The environment is a web application to assist CORSSREADS researchers with the
creation of their palaeographic definitions and the annotation of graphs
from inscriptions using those definitions.

The application runs on github pages and uses GITHUB API to update data files
such as the annotation files or the definition file. In read-only mode, the
application doesn't need the API. Images are obtained from a IIIF Image server.
The collection of inscriptions is obtained from a DST endpoint. The text of
the inscriptions is read from TEI files hosted on the IScicily repository.

### Issues

See the github issue section and the [milestones](https://github.com/kingsdigitallab/crossreads/milestones).

# Develop

To install and run the app localy:

```bash
cd app
npm ci
npm start
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

## More information

For more information about the data model, the architecture or the links to
other services, please check the [docs folder](docs/README.md).
