## References

* Current DTS server POC: [https://github.com/ISicily/isicily-dts](https://github.com/ISicily/isicily-dts)
* DTS Specification: [https://distributed-text-services.github.io/specifications/](https://distributed-text-services.github.io/specifications/)
* Annotator data workflow: [https://github.com/kingsdigitallab/crossreads/blob/main/docs/interoperability.md](https://github.com/kingsdigitallab/crossreads/blob/main/docs/interoperability.md)

## Keys

Priority:

* M: Must-have
* S: Should
* C: Could
* W: Won't have (this time or ever); not needed.

Clients of the DTS Server:

* the Annotator / annotating environment: to show the list of inscriptions and match the annotated graphs on the object images with the characters in the TEI;
* new ISicily site: mainly the text viewer on the Inscription page;
* third-party apps: other researchers who want to browse the Crossreads collection programmatically or via a DTS-based user interface;

## Requirements

Priorities suggested by KDL based on the current or expected needs of the annotator (Musts), ISicily (Should) or community (Could). To be confirmed.
It would be good if the server could comply with the latest version of DTS specification `1.0.0draft-2.json`.

| ID | Priority | DTS Endpoint | Feature | Description | Current work-around implementation in the Annotator |
| --- | -------- | ------------ | ------- | ----------- | --------------------------------------------------- |
| C1 | M | Collection | Returns single collection with all TEI in the corpus. | request: `/API-PATH/collections`<br>DTS Server returns the collection response for the entire TEI corpus. One member per TEI file in the corpus.<br>I think this is already implemented like that in the POC.<br>Please provide `passage`, `references` & `download` properties for each item/member to facilite following calls to other API endpoints for any given document. | Annotator uses a static copy of the collection response generated once by the POC DTS server. Then manually modified for testing purpose. But this is not scalable. |
| C2 | M | Collection | Reflects latest change in TEI corpus | request: `/API-PATH/collections`<br>The response should reflect recent state of the corpus on github (e.g. new files will automatically appear; IDs are up to date, etc.).<br>At best this would be dynamic/immediate.<br>Another option is to run a github action to or cronjob to force the DTS server to update & cache its collection index/response. | / |
| C3 | S | Collection | Return the citation structure for each item | request: `/API-PATH/collections`<br>Please supply a value for the `citeStructure` property so it is clear/explicit how to address sections and lines within a document (see other requirements below). | / |
| C4 | C | Collection | Paging | request: `/API-PATH/collections?page=PAGE`<br>Optional for the annotator. | Optional as the Annotator can fetch the entire collection in one request/response. |
| N1 | S | Navigation | Returns document metadata | request: `/API-PATH/navigation?id=DOCID`<br>Returns standard DTS response, with list of available references in `member` (see below). | Collection contains reference to TEI document URL on github. And segmentation logic (sections & lines) is part of the annotator. |
| N2 | S | Navigation | Returns section references | request: `/API-PATH/navigation?id=DOCID`<br>Response should contain a `member` element with a list of references to the sections in the document, if any. <br>e.g.<br>"member": [<br> {"ref": "section 1", "level": 1}, <br> ...<br>] | Not currently needed. But may be required later.<br>To be discussed with Simona. |
| N3 | S | Navigation | Returns line references | request: `/API-PATH/navigation?id=DOCID`<br>Response should contain a `member` element with a list of references to the lines in the document. | Not needed by the annotator.<br>New ISicily site could make use of it (TBC 2024). |
| N4 | W | Navigation | Paging of navigation response | request: `/API-PATH/navigation?id=DOCID&page=PAGE`<br>NOT needed due to small size of the texts. | / |
| D1 | M | Document | returns whole TEI, including headers | request: `/API-PATH/document?id=DOCID` | Collection/Navigation contains reference to TEI document URL on github. |
| D2 | S | Document | returns document in HTML format | request: `/API-PATH/document?id=DOCID&format=html`<br>Known clients of the DTS are the annotator and the new ISicily site. Both will probably need their own HTML format. Annotator currently uses XSLT. But ideally this conversion (for at least one HTML format) should be part of the DTS server. | Transform from TEI to HTML is part of the Annotator. |
| D3 | C | Document | Returns individual section of a document (in TEI format) | request: `/API-PATH/document?id=DOCID&ref=SECTIONID`<br>Returns the TEI document with full headers and only the fragment of the edition matching the requested section. | Annotator contains logic to parses the TEI XML & extract sections from it using XPATH. |
| D4 | C | Document | Return individual line of a document (in TEI format) | request: `/API-PATH/document?id=DOCID&ref=LINEID`<br>Returns the TEI document with full headers and only the fragment of the edition matching the requested line. | Not actually needed for the annotator and the ISicily site. |
| I1 | M | / | Documentation<br>& Dockerisation | So Oxford ITS can deploy & configure the DTS server on their infrastructure without any assistance from KDL, as KDL does not support or manage third-party servers.<br>Also for KDL to deploy the DTS server locally for development/testing purpose if needed.<br>Dockerisation of the server would help (i.e. docker compose) as it's more portable/universal. | / |
