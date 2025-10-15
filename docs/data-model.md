# Technical documentation of the palaeographical annotation environment in the Crossreads project.

TODO: file paths and the structure / values of the samples 
may need to be updated

Author: Geoffroy Noël

The environment is a web application and a set of command line tools
written in javascript and designed to help researchers describe the form
of graphs visible on the Latin and Greek inscriptions written over a
collection of objects created in ancient Sicily.

## Web application

The web application code lives under the /app folder. It has four pages:

-   **annotator.html:** A page that allows the researcher to annotate
    graphs found on an photograph of any object in the collection.
    Annotating a graph consists in drawing a bounding box on the image
    around the graph, linking it to the corresponding letter in the
    transcription of the inscription and then describing the observed
    features in the components of the graph. Annotations can also be
    tagged freely to label their general pattern.
-   **definitions.html:** A page that allows the researcher to define
    the descriptive language for the graphs. It has four tabs. The first
    one to define the list of characters (i.e. an alphabet) in each
    script and their respective components. The second tab to define the
    list of possible features for each component. And the last tab to
    manage a list of variant types (i.e. allograph) for each character.
-   **search.html:** A faceted search interface over all annotations.
    The pane on the left hand side contains many facets to filter the
    result. The middle pane shows the result as a grid of annotations
    with their thumbnails and attributed character. The right pane is
    used to bulk edit the annotation tags or their features.
-   **settings.html:** A page where a user can authenticate with their
    github personal access token (PAT). Once authenticated the content
    showned on other tabs is editable. All changes are saved to json
    files stored on github. For non-authenticated users, the content
    remains read-only.

## Data Model

### Concepts

Key concepts in our palaeographical data model:

-   **grapheme:** \"A minimally distinctive unit of writing in the
    context of a particular writing system\" (see Stokes on DigiPal
    blog). It is abstract from any visual form or representation. This
    can be a letter or a punctuation.
-   **graph:** a unique physical instance of a grapheme. For instance
    the first instance of a G written on a piece of paper. It\'s form is
    fixed and fully determined.
-   **component:** a particular part of the shape of a graph (e.g.
    \`crossbar\` of a H).
-   **feature:** a possible variation of a component (e.g. a crossbar
    can be \`straight\` and \`short\`).
-   **allograph:** a graphical pattern shared by multiple graphs of the
    same grapheme. It is a visual type of graphs. Allographs are
    organised into a **typology** or hierarchy. From the most abstract
    at the top to the most specific pattern at the bottom.
-   **character:** a top-level allograph in the typology. Each allograph
    has a fixed set of mandatory components. Therefore all allographs or
    graphs that descend from that character must have those components.
    A character can be mapped to a Unicode character.
-   **alphabet:** a set of characters in a given script.
-   **variant rule:** defines more a specific allograph under the level
    of a character in the typology. The rule imposes the presence of
    certain features on some components.
-   **variant type:** the allograph that is defined by a variant rule.
-   **annotation:** a description of a graph. The description has
    multiple parts. First, the script, character and set of observed
    features for the graph\'s components. Second, the location of the
    graph on the image of the object is was inscribed on. Third, the
    position of the corresponding letter in the transcription of the
    inscription. And fourth, a set of tags to further caracterise or
    categorise the graph.

This data model was borrowed from the Archetype framework. The cascade
of abstractions above a graph was simplified by removing the Ontograph
and Idiograph. Variant rules were introduced to support a flexible
hierarchy of allographs. The description of a graph into components and
their respective features remains fundamentally the same.

<img width="1026" height="803" alt="image" src="https://github.com/user-attachments/assets/cdd856ac-fb9a-4a52-a646-a97d4166eb97" />


### Definitions

The palaeographical definitions created by the researchers are stored in
/app/data/pal/definitions-digipal.json.

The following excerpt shows the scripts, all available features, all
available components and their possible features, allographs and their
mandatory components.

```json
{
  "context": "//digipal.eu",
  "version": "0.1",
  "updated": "2025-07-10T10:29:42.130Z",
  "scripts": {
    "greek": "Greek",
    "latin": "Latin"
  },
  "features": {
    "above-baseline": "above baseline",
    "below-baseline": "below baseline",
    "curved": "curved",
    "high": "high",
    "on-baseline": "on baseline",
    "sans-serif": "sans serif",
    "serif": "serif",
    "straight": "straight",
    "traversing": "traversing",
    "diagonal": "diagonal",
    "vertical": "vertical",
    "short": "short",
    "long": "long"
  },
  "components": {
    "downstroke": {
      "name": "downstroke",
      "features": [
        "above-baseline",
        "below-baseline",
        "curved",
        "high",
        "on-baseline",
        "sans-serif",
        "serif",
        "straight",
        "traversing",
        "diagonal",
        "vertical",
        "short",
        "long"
      ]
    },
    "top-bar": {
      "name": "top bar",
      "features": [
        "straight",
        "vertical",
        "long",
        "sans-serif",
        "curved",
        "diagonal",
        "not-touching",
        "serif",
        "short",
        "touching",
        "traversing",
        "horizontal",
        "parallel",
        "ascending",
        "descending",
        "extending"
      ]
    },
    "crossbar": {
      "name": "crossbar",
      "features": [
        "straight",
        "vertical",
        "touching",
        "serif",
        "sans-serif",
        "broken",
        "ascending",
        "curved",
        "descending",
        "not-touching",
        "point",
        "short",
        "circular",
        "horizontal",
        "traversing",
        "long",
        "from-baseline",
        "absent"
      ]
    },
    "body": {
      "name": "body",
      "features": [
        "circular",
        "rhomboid",
        "small",
        "square",
        "oval",
        "closed",
        "open",
        "ovoid"
      ]
    }
  },
  "allographs": {
    "Ο-greek": {
      "script": "greek",
      "character": "Ο",
      "components": [
        "body",
        "crossbar"
      ]
    },
    "Τ-greek": {
      "script": "greek",
      "character": "Τ",
      "components": [
        "downstroke",
        "top-bar"
      ]
    }
  }
}
```

### Annotations

Annotations are stored in annotations files under /annotations/\*json.
The format follows W3C Web Annotation data model. There is one file per
image of an object. All annotations drawn on that image are saved in
that file.

Below is an example of an annotation file for image ISic000086.jpg of
object ISic000086
(annotations/http-sicily-classics-ox-ac-uk-inscription-isic000086-isic000086-jpg.json).
It contains one annotation of a Latin I graph. Its \`body\` describes
the graph using the palaeographical definitions language from
definitions\*.json. The downstroke component of the graph is serif,
straight and vertical. It has two \`target\`s. The first one represents
the coordinates of the box bounding the graph on the image obtained from
a IIIF server. The second target is the position of the corresponding
letter in the expanded word (e.g. 6th letter of word with id \`AIΙAe\`)
in the transcript of the inscription. That refers to a TEI XML file for
that object on the ISicily github repository.

```json
[
  {
    "@context": "http://www.w3.org/ns/anno.jsonld",
    "type": "Annotation",
    "body": [
      {
        "type": "TextualBody",
        "purpose": "describing",
        "format": "application/json",
        "value": {
          "script": "latin",
          "components": {
            "downstroke": {
              "features": [
                "serif",
                "straight",
                "vertical"
              ]
            }
          },
          "tags": [
            "serif.slab",
            "serif.curved"
          ],
          "character": "I"
        }
      }
    ],
    "target": [
      {
        "source": "https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=/inscription_images/ISic000086/ISic000086_tiled.tif",
        "selector": {
          "type": "FragmentSelector",
          "conformsTo": "http://www.w3.org/TR/media-frags/",
          "value": "xywh=pixel:3367.760498046875,1268.7640380859375,221.83642578125,734.5250244140625"
        }
      },
      {
        "source": "http://sicily.classics.ox.ac.uk/inscription/ISic000086.xml",
        "selector": {
          "type": "XPathSelector",
          "value": "//*[@xml:id='AIΙAe']",
          "refinedBy": {
            "type": "TextPositionSelector",
            "start": 6,
            "end": 7
          }
        }
      }
    ],
    "id": "https://crossreads.web.ox.ac.uk/annotations/14280d5e-dd9b-46e7-910e-1d09622d8114",
    "generator": "https://github.com/kingsdigitallab/crossreads#2023-09-01-00",
    "creator": "https://api.github.com/users/simonastoyanova",
    "created": "2024-03-27T12:27:07.385Z",
    "modifiedBy": "https://api.github.com/users/simonastoyanova",
    "modified": "2025-03-24T15:55:16.645Z"
  }
]
```

### Variant rules and types

Variant rules are all saved in a json file under
/app/data/variant-rules.json. A variant rule is a rule about which
features certain components must exhibit. Each rule defined a variant
type (which is also an allograph). The set of all rules defines a
typology of allographs.

Below is an excerpt from variant-rules.json. It contains three rules for
Latin A. They define three types of allographs. The crossbar in Latin A
type1 must be straight. The crossbar in Latin A type1.1 must be straight
and ascending.

```json
[
  {
    "variant-name": "type1",
    "allograph": "A",
    "component-features": [
      {
        "component": "crossbar",
        "feature": "straight"
      }
    ],
    "script": "latin"
  },
  {
    "allograph": "A",
    "component-features": [
      {
        "component": "crossbar",
        "feature": "straight"
      },
      {
        "component": "crossbar",
        "feature": "ascending"
      }
    ],
    "variant-name": "type1.1",
    "script": "latin"
  },
  {
    "allograph": "A",
    "component-features": [
      {
        "component": "crossbar",
        "feature": "straight"
      },
      {
        "component": "crossbar",
        "feature": "descending"
      }
    ],
    "variant-name": "type1.2",
    "script": "latin"
  },
]
```

### Change Queue

Any change initiated by a researcher from a web page and affecting more
than one file is recorded in a change queue under
/app/data/change-queue.json. /tools/run-change-queue.mjs is a
server-sider script that asynchronously applies all the pending changes
recorded in the queue.

Below is an example of a change queue with three pending changes. The
first change adds a feature to a component (left-bar is diagonal) in one
annotation. The second change removes one tag named \"type1.2\" from an
annotation. The third change promotes two variant types of Ω to a new
character called Ω1+2.

```json
[
  {
    "changeType": "changeAnnotations",
    "creator": "https://api.github.com/users/simonastoyanova",
    "created": "2025-07-10T15:10:53.820Z",
    "annotations": [
      {
        "id": "https://crossreads.web.ox.ac.uk/annotations/9b767927-5f4d-48a6-9761-98715bab0551",
        "file": "http-sicily-classics-ox-ac-uk-inscription-isic003031-isic003031-jpg.json"
      }
    ],
    "componentFeatures": [
      [
        "left-bar",
        "diagonal"
      ]
    ]
  },
  {
    "changeType": "changeAnnotations",
    "annotations": [
      {
        "id": "https://crossreads.web.ox.ac.uk/annotations/956150df-f389-4a0b-bef1-2666a8ff0004",
        "file": "http-sicily-classics-ox-ac-uk-inscription-isic000099-isic000099-jpg.json"
      }
    ],
    "creator": "https://api.github.com/users/simonastoyanova",
    "created": "2025-07-07T15:05:05.293Z",
    "tags": [
      "-type1.2"
    ]
  },    
  {
    "changeType": "promoteTypesToCharacter",
    "types": [
      {
        "variantName": "type2",
        "script": "greek",
        "character": "Ω"
      },
      {
        "variantName": "type1",
        "script": "greek",
        "character": "Ω"
      }
    ],
    "character": "Ω1+2",
    "script": "greek"
  },
]
```
