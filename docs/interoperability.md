# Data & service interoperability

## Data flow

Below is a step-by-step summary of how the annotator currently interacts with external content sources:

1. request to the DTS Collection API ([currently a static copy](https://kingsdigitallab.github.io/crossreads/data/2023-01/collection.json)) to obtain the list of all objects in the corpus
2. from the Collection response, retrieve the URL of the TEI documents
3. fetch the whole TEI file ([currently a static copy](https://kingsdigitallab.github.io/crossreads/data/2023-01/ISic000031.xml) on github but eventually from the DTS document endpoint)
4. get image file names from the TEI header
5. reconstruct the image URLs from the file names (currently local copy but soon a [standard IIIF image information API URL](https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=/inscription_images/ISic000001/ISic000001_tiled.tif/info.json) (\*/info.json))
6. pass the URL of user-selected image to OpenSeaDragon which then displays the image
7. converts the TEI body into HTML and display it under the image
8. as part of the conversion, assign a number to each sign, relative to the closest ancestor element with an @id (i.e. a word ).
9. when the user saves an annotation: creates a Web Annotation json file on github with two targets:
    * 9.a one target is the graph image region, expressed in standard IIIF image format obtained from OpenSeaDragon (see points 4-6)
    * 9.b another target is the corresponding sign in the text, expressed as a standard DTS document API request (for a particular line) and complemented by the id of the ancestor

## Data Services

Based on this, the external services the annotator relies on are:

| Service | Data Flow step | Priority | Data |
| ------- | -------------- | -------- | ---- |
| DTS Collection API | 1 | MUST | member > @id, title, dts:download or dts:passage |
| DTS Document API | 3 | SHOULD | /facsimile/surface/graphic/@url, /text/body/div[@type='edition'] |
| IIIF Image API | 6 | MUST | metadata (Image Info request); tiles & regions (Image request) |
| Github API | 9 | MUST | web annotation, with targets to IIIF Image API and DTS Document API |

### Note about DTS Navigation API and reference system

Note that, although the annotator doesn't need to call the DTS Navigation API, the format of the textual target in the web annotations it creates have to be compatible with the reference system (/member/ref) to address lines of text. Something like this:

`/dts/api/documents/?id=DOCID&ref=LINEREFERENCE`

That type of URL will be in the web annotation target (alongside the word id and sign/character index). This is why anyone following that link should be able to retrieve the line from the DTS server. However the annotator itself never needs to retrieve a specific line. It only fetches entire TEI documents because it is more efficient and provides contextual information.

## [Standardised conceptual model](img/cr-model2.png)

![Standardised conceptual model](img/cr-model2.png)

This diagram connects the various standard models together: IIIF, DTS and Web Annotation. The Palaeographical model is not really standard, although it inherits from Archetype data model.

The list of TEI files is obtained via the DTS Collection API. This is why the IIIF Presentation API Collection is not needed (in red). Each TEI file is obtained as a whole document via the DTS Document API. Likewise the list of available images URLs for each object is obtained from the TEI headers rather than the Sequence endpoint from the IIIF Presentation API.

The Image metadata and tiles are obtained via the IIIF Image API implemented by the IIPsrv server.

Source files in blue all accessed indirectly via middlewares (IIPSrv, DTS server and Github API).

## Discussion about annotation targets

### Textual target

Logically the reference to a sign in the document can make use of these units:

1. the document (identified by its DTS document ID or document URL)
2. the line that contains the sign (the TEI has number for each line)
3. the word that contains the sign (the TEI has unique ids for each word in the corpus)
4. the sign (its index in the word, e.g. 2 for second sign)

In principle (3, 4) is enough to locate a sign in the entire corpus. However to make the reference interoperable (LOD) we should use (1) as it allows reader to fetch the document from DTS. So we want (1, 3, 4).

Do we need the line number (2)? Probably not. But it may be useful to specify it anyway. Note that the DTS server may allow access to specific lines of the document.

https://www.w3.org/TR/annotation-model/#refinement-of-selection

```
   "source": "http://dtsdomain/dts/api/document?id=ISic000031&ref=1", // (1, 2)
   "selector": {
      "type": "XPathSelector",
      "value": "/text/body/div[@type='edition']//w[@xml:id='ISic000031-50']" // (3)
      "refinedBy": { // (4)
        "type": "TextQuoteSelector",
        "exact": "n",
        "prefix": "ia",
        "suffix": " i"
      }
   }
```

Questions:

How can we specify the index of the sign?

Yes if TextPositionSelector can be relative to the word when we use it in a refinedBy. However one common complication is when preceding signs in the word are supplied by the editor but not engraved.

In the following example, is the index of `n` in `ia[n]i`, relative to the word 3 or 13.
3 would be more practical but its interpretation would depend on conventions external to the web annotation and this making it less self-contained and less interoperable.

```
<w xml:id="ISic000031-50">
   <supplied reason="lost" xml:id="ISic000031-60">kalendarii</supplied>
   <gap reason="lost" extent="unknown" unit="character"/>
   iani
</w>
```

### Image region target

This is produced by Annotorious and contains a reference to IIIF Image URI.

```
"target": {
   "source": "https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=/inscription_images/ISic000001/ISic000001_tiled.tif",
   "selector": {
      "type": "FragmentSelector",
      "conformsTo": "http://www.w3.org/TR/media-frags/",
      "value": "xywh=pixel:4824.82763671875,2947.958984375,488.3076171875,787.592529296875"
   }
},
```