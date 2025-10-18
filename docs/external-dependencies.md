This document explains how to change internal ids or references 
to external services or resources. 
Mainly as a consequence of a changing domain.

# Tokens in the TEI

[See Github issue #108](https://github.com/kingsdigitallab/crossreads/issues/gh-108)

In 2025, the way to reference the tokens in the edition 
found in all TEI files has changed.
The old reference system used to have xml:id attribute on some elements. 
The new system uses the n attribute instead.
There is a transition period during which both systems co-exist.

The annotator is able to read and write annotations and TEI files 
using the old and the new system. 
New annotations will be created with a system that match 
the newest available in associated TEI file.

⚠ **As the research team is adding the new system to more TEI files, 
they can convert old-style references** to the new one 
in the associated annotation files in bulk using this script:

```bash
cd tools/idconvertor
node convert-token-ids-2025.mjs convert > conversion.log
```

Then check conversion.log for issues.

If there's no major issue, commit and push:

```bash
git commit -am "fix(data): converted more annotation files to new token system; gh-108"
git push
```

⚠ **Before removing the old system from the TEI files, the research team 
should first ensure that all annotation files have been converted** 
with the above command.

One way to check:

```bash
cd tools/idconvertor
node convert-token-ids-2025.mjs check > conversion.log
```

Then check conversion.log for issues.

# Annotation IDs

[See Github issue #124](https://github.com/kingsdigitallab/crossreads/issues/124)

Up until 18 Oct 2025 the annotations had a unique ID that looked like this URI:

`https://crossreads.web.ox.ac.uk/annotations/48d9bead-38bb-4771-a78b-cecf7b5f3751`

[Found in annotation file for inscription ISic000085](https://github.com/kingsdigitallab/crossreads/blob/551ec5092b75ff4a60f6da426aa8bea270a18e58/annotations/sicily-classics-ox-ac-uk-inscription-isic000085-isic000085_tiled-tif.json#L273)

As with other URIs, it was deemed preferable to use the following domain
instead:

`https://sicily.classics.ox.ac.uk/annotations/48d9bead-38bb-4771-a78b-cecf7b5f3751`

The IDs were converted in bulk using this command:

```bash
cd tools/fixdata; 
node convert-annotations-urls.mjs convert 'https://crossreads.web.ox.ac.uk/annotations/' 'https://sicily.classics.ox.ac.uk/annotations/'
```

And the value of `ANNOTATION_URI_PREFIX` in `settings.mjs` was updated 
accordingly so new annotations created by the annotator use the new prefix. 

## Dereferencing annotation IDs

Annotation URIs are not dereferencable. 
But they could lead to the annotation file if bulk redirects are set up
on the research team servers.

To assist with that, a CSV file with mapping 
(annotation URI -> annotation file URL) can be generated like this:

```bash
cd tools; 
node map-annotation-ids-to-files.mjs
```

This can be uploaded to Excel for bulk replacement of prefixes 
if they need to match other permanent URLs.

# Image server

[See Github issue #109](https://github.com/kingsdigitallab/crossreads/issues/gh-109)

As of 19 OCt 2025, the IIIF image server used by the annotating environment
is located at this address:

https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi

⚠ If this changes to, say `https://sicily.classics.ox.ac.uk/image/`, 
follow these steps:

(Note: be careful about trailing slashes, they matter)

1. update the value of `IIIF_SERVER_BASE` in 
[settings.mjs](https://github.com/kingsdigitallab/crossreads/blob/551ec5092b75ff4a60f6da426aa8bea270a18e58/app/settings.mjs#L127) 
to `https://sicily.classics.ox.ac.uk/image/`.

2. convert all the references recorded in the annotation files:

```bash
cd tools;
node convert-img-urls.mjs convert `https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=` `https://sicily.classics.ox.ac.uk/image/`
```

3. regenerate the search index

```bash
cd tools
node run index
```

4. test (1) by checking that the annotator can still load the inscription images

5. test (2) by checking that the search page displays the thumbnails

6. if all good, commit and push

7. when the changes have been published to the live site, 
retest (4) and (5) there

# DTS Collection and TEI files

[See Github issue #61](https://github.com/kingsdigitallab/crossreads/issues/gh-61)
and [#19](https://github.com/kingsdigitallab/crossreads/issues/gh-19)

A DTS collection of the TEI files is generated and hosted on the ISicily 
repository. Its address as of 18 Oct 2025:

https://raw.githubusercontent.com/ISicily/ISicily/master/dts/collection.json

The research assistant maintains [a list of inscription IDs](https://github.com/kingsdigitallab/crossreads/blob/551ec5092b75ff4a60f6da426aa8bea270a18e58/app/data/2023-08/inscriptions.json#L2) 
the annotator should make visible to the user.

A [github action] fetches the full DTS collection and saves a subset matching
those IDs into a [subcollection file](https://github.com/kingsdigitallab/crossreads/blob/551ec5092b75ff4a60f6da426aa8bea270a18e58/app/data/2023-08/collection.json#L41).

When a user selects an inscription in the annotator, 
it extract [the address of the TEI files](https://github.com/kingsdigitallab/crossreads/blob/551ec5092b75ff4a60f6da426aa8bea270a18e58/annotations/sicily-classics-ox-ac-uk-inscription-isic000085-isic000085_tiled-tif.json#L273) from the `subcollection dts:download` field. As of 18 Oct 2025:

http://sicily.classics.ox.ac.uk/inscription/ISic000085.xml

This is redirected by the sicily site to the TEI URL on github:

https://raw.githubusercontent.com/ISicily/ISicily/master/inscriptions/ISic000085.xml

⚠ If http://sicily.classics.ox.ac.uk/inscription/ISic000085.xml is changed to
a new address, follow these steps:

⚠ **NOT CURRENTLY POSSIBLE**

1. change the address in the [DTS github action](https://github.com/ISicily/ISicily/blob/1affe1cc8ea91e2c2eb99d7bf9c91c8293ffeb18/.github/workflows/updateCollection.yaml#L18) 
of the ISicily repo.
2. change the value of `DTS_DOC_BASE` in 
[settings.mjs](https://github.com/kingsdigitallab/crossreads/blob/551ec5092b75ff4a60f6da426aa8bea270a18e58/app/settings.mjs#L131) 
to `https://sicily.classics.ox.ac.uk/image/`.
3. convert all annotation file names (unless only the protocol has changed)
(this script does not exist)
4. convert the pointer to the TEI file in all annotation files 
(this script does not yet exist)

# Typology and type pages

[See Github issue #92](https://github.com/kingsdigitallab/crossreads/issues/92)

It is advised to set up permanent redirects to the variant types pages
included in the annotating environment as they were designed for long term
hosting.

Their current locations as of Oct 2025:

[Latin A type 1.1 page](https://kingsdigitallab.github.io/crossreads/data/allographs/types/latin-A-type1.1.html)

[Full typology page](https://kingsdigitallab.github.io/crossreads/data/allographs/types/all.html#latin-A-type1.1)

