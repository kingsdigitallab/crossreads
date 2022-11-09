## Standards

* M Distributed Text Services
* M IIIF Image API
* M Web Annotations data model
    https://www.w3.org/TR/annotation-model/
* (OpenAnnotations, precusor of W3c Web Annotations)
* S [IIIF Presentation API](https://iiif.io/api/presentation/2.1/)
* C [IIIF Search API](https://iiif.io/api/search/1.0/)


## [Annotators](https://github.com/IIIF/awesome-iiif#annotations)

* [Annotorius](https://recogito.github.io/annotorious/) (and [Recogito](https://github.com/pelagios/recogito2))
  * W3C web annotations
  * standalone or openseadragon plug-in
* [Annona](https://github.com/ncsu-libraries/annona): JavaScript library that allows users to display W3 Web Annotations in a visual format.
* [Annonatate](https://annonatate.herokuapp.com/)
* [Mirador](https://projectmirador.org/)

## Annotation server

https://github.com/glenrobson/SimpleAnnotationServer: A simple IIIF and Mirador compatible Annotation Server 

## [Viewers](https://iiif.io/get-started/iiif-viewers/)

* Universal Viewer
* Mirador
* OpenSeadragon
* Tify
* Leaflet-iiif
* OpenLayers
* [-2021] Diva.js
* [-2019] IIIFViewer

## Questions

* Q1. where are the annotation encoded?
* Q2. how to encode structured annotations?
* Q3. what is the minimal set of sustainable components that match our requirements?
* Q4. annotators?
* Q5. does IIIP presentation API allows insertion of annotations?
* Q6. where does the list of objects come from?
  * a) IIIP collections - with annotation to DTS api
  * b) DTS - with matching url convention to find corresponding IIIF manifest 

## Requirements

Image
* M view iiif image
* M bound a graphs on image
* M description of the graph (annotation)
* M search/browse objects
* S viewer is embeddable and highly customisation

Text
* M view text
* M link graph to text

Annotation
* M structured annotation
* M save annotations
* S terminological definition
* S browse annotations
* S search annotations

## Other resources

IIIF training material
* [image api](https://training.iiif.io/iiif-online-workshop/day-two/image-api.html)
* [presentation api](https://training.iiif.io/iiif-online-workshop/day-three/)
* [annotations](https://training.iiif.io/iiif-online-workshop/day-four/annotations-and-annotation-lists.html)

Others
* [web annotations (devopedia)](https://devopedia.org/web-annotation)
* [web annotations spec](https://www.w3.org/TR/annotation-model/)
* https://iiif.io/api/cookbook/recipe/0266-full-canvas-annotation/
* https://iiif.io/api/cookbook/recipe/0001-mvm-image/

Image servers

* [Loris](https://github.com/loris-imageserver/loris) (v2 compliant)
* [IIPServer](https://github.com/ruven/iipsrv) (v3 compliant but still beta)
* [Cantaloupe](https://cantaloupe-project.github.io/) (v3 compliant)
* 


docker run --rm -d -p 8182:8182 -e "CANTALOUPE_ENDPOINT_ADMIN_SECRET=secret" -e "CANTALOUPE_ENDPOINT_ADMIN_ENABLED=true" --name crossread-img2 -v /home/jeff/src/prj/crossreads/crossreads/data/2022:/imageroot cantaloupe

mvn docker:start -Dimage.root=/home/jeff/src/prj/crossreads/crossreads/data/2022

## definitions

https://github.com/kcl-ddh/digipal/wiki/Letters-and-Other-Symbols

ontograph (A, generalised grapheme, abstract from physical rendition)
    character (form: minuscule <- unicode: 1234)
        allograph (recognised variant, script(s): caroline)
            % component
                % feature

=>

project
    script
        allograph
            % component
                feature

a-c, c, f, c-f can be project-specific
on, ch: see unicode
script: ? (alphabet (e.g. latin) > )
al = (ch,sc)

https://www.fileformat.info/info/unicode/char/00c1/index.htm
http://scriptorium.blog/graphemics/introduction/


Q: does Unicode differentiate scripts? i.e. different unicode pt for insular vs caroline (carolingian)

1. which mechanism should we use to avoid repetition of definitions among scripts? e.g. inheritence, default definition, overridden by particular scripts.
2. can we assume that the set of features available to a component is the same across allographs?
3. possible issue with Archeytpe model is that an allograph can belong to multiple
scripts if the rendition is the same. So when a user sees a graph description in isolation they can tell the actual script they belong to. Which may (if not possible to
tell even with context) or may not be desirable. 
4. character ideally should match unicode, whenever possible, by archetype has accent, ligature, wynn, 7!, thorn
    5. do we want to record the script as part of the annotation? (e.g. greek l vs roman l)

A font assigns glyphs to unicode graphemes


http://digipal.eu/digipal/api/allograph/?@select=*script_set,*allograph_components,name,character,*component

http://digipal.eu/digipal/api/componentfeature/

----

Example of a IIIF collection

https://iiif.wellcomecollection.org/presentation/v2/collections/contributors/hmrvb7uv

and manifest:

https://wellcomecollection.org/_next/data/Xh7dbMDDshVtHh3MO4uEZ/item.json?workId=hysqmpp6&source=work

http://localhost:49154/iiif/2/ISic000031.JPG/full/full/0/default.jpg

---

navigational path from collection to text & image

collection
    https://isicily-dts.herokuapp.com/dts/api/collections/
object
    https://raw.githubusercontent.com/ISicily/ISicily/master/inscriptions/ISic000001.xml
    
    image
        TEI/facsimile/surface[@type=front]/graphic
            @height
            @width
            @url
        deepzoom on sicily.classics.ox.ac.uk

        http://sicily.classics.ox.ac.uk/deepzoom/images/ISic000001/ISic000001_tiled.tif_files/12/12_3.jpg
    body
        TEI/text/body/div[@type=edition]

---

Advantages over Archetype:
1. better reuse of standards
2. more interoperable (bc 1)
3. more modular, as opposed to monolithic (bc 2)
4. more sustainable (bc 1, 2 ,3)
5. forward compatible
6. bridges instances (bc 2 & 6)
7. cloud-native/"server-less"
8. better UI & interop for terminology definitions
9. annotating offline
10. text-image linking

TODO:

# Encoding Annotations

## Collection of annotations

Collection
    AnnotationPage
        Annotation

https://www.w3.org/TR/annotation-model/#collections


{
  "@context": "http://www.w3.org/ns/anno.jsonld",
  "id": "http://example.org/collection1",
  "type": "AnnotationCollection",
  "label": "Two Annotations",
  "total": 2,
  "first": {
    "id": "http://example.org/page1",
    "type": "AnnotationPage",
    "startIndex": 0,
    "items": [
      {
        "id": "http://example.org/anno1",
        "type": "Annotation",
        "body": "http://example.net/comment1",
        "target": "http://example.com/book/chapter1"
      },
      {
        "id": "http://example.org/anno2",
        "type": "Annotation",
        "body": "http://example.net/comment2",
        "target": "http://example.com/book/chapter2"
      }
    ]
  }
}


## Format of the body

Ideally a json-ld encoded in json rather than string encoding of json.

format? (should be present, but what? jsonld?)
where does description go? (NOT value)

https://stackoverflow.com/a/46154465

"kar": "archetype.kdl.kcl.ac.uk"

"kar:graph":
    "kar:allograph": 
        "kar:id": latin.X
        ("kar:unicode": ???)
        "kar:script": latin
    "kar:components":
        - "kar:component": ascender
          "kar:features": [approach-stroke, curved]
        - ...
    

## Multiple contexts in json-ld

"@context": 
[
  "http://schema.org/",
  {"oos": "http://our_own_schema.org/"}
],


## Textual range

https://www.w3.org/TR/annotation-model/#xpath-selector

https://devopedia.org/web-annotation#sample-code


