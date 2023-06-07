# Data & service interoperability

## Data flow

Below is a step-by-step summary of how the annotator currently interacts with external content sources:

1. request to the DTS Collection API (currently a static copy) to obtain the list of all objects in the corpus
2. from the Collection response, retrieve the URL of the TEI file on github
3. fetch the whole TEI file (currently directly from github but eventually from the DTS document endpoint)
4. get image file names from the TEI header
5. reconstruct the image URLs from the file names (currently local copy but soon a standard IIIF image information API URL (*/info.json))
6. pass the URL of user-selected image to OpenSeaDragon which then displays the image
7. converts the TEI body into HTML and display it under the image
8. as part of the conversion, assign a number to each sign, relative to the closest ancestor element with an @id (i.e. a word <w>).
9. when the user saves an annotation: creates a Web Annotation json file on github with two targets:
   * 9.a one target is the graph image region, expressed in standard IIIF image format obtained from OpenSeaDragon (see points 4-6)
   * 9.b another target is the corresponding sign in the text, expressed as a standard DTS document API request (for a particular line) and complemented by the id of the ancestor

## Data Services

Based on this, the external services the annotator relies on are:

| Service  | Data Flow step  | Priority  |
|---|---|---|
| DTS Collection API | 1  | MUST  |
| DTS Document API  | 3 | SHOULD |
| IIIF Image API  | 6 | MUST |
| Github API  | 9 | MUST |

