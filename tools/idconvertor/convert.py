from pathlib import Path
from pyepidoc.epidoc.ids import decompress, convert
from pyepidoc.epidoc.ids.errors import CompressedIDLengthError
import json
import re

# relative to this script
PATH_ANNOTATIONS_RELATIVE = '../../../annotations'
# e.g. "//*[@xml:id='bsdXs']"
PATTERN_SELECTOR_WITH_ID = r"(xml:id=')([^']+)"
# e.g. ISic020368-0040 or ISic020292-00030
# Why {4,5}? Apparently the conversion to base100 adds a 0 in front.
PATTERN_DECODED_VALID = r"^(ISic)(\d{6})-(\d{4,5})$"
BASE_FROM = 52
BASE_TO = 100
ANNOTATION_FORMAT_VERSION = '2023-09-01-00'
ANNOTATION_GENERATOR_URI = f'https://github.com/kingsdigitallab/crossreads#{ANNOTATION_FORMAT_VERSION}'
PATH_INSCRIPTIONS_RELATIVE = '../../../app/data/2023-08/inscriptions.json'
READ_ONLY = False
FILTERED_ANNOTATION_FILE = None
# FILTERED_ANNOTATION_FILE = 'isic030002-isic001408'

class AnnotationIDConvertor:

    def __init__(self):
        # the annotation being converted
        # (a fragment of the dict stored in the annotations file)
        self.annotation = None
        self.listed_inscription_ids = self.read_listed_inscription_ids()

    def read_listed_inscription_ids(self):
        '''
        Returns the list of inscription IDs currently listed in the annotator.
        e.g. ['ISic001408', 'ISic001420', ...
        '''
        inscriptions_path = (Path(__file__) / PATH_INSCRIPTIONS_RELATIVE).resolve()
        ret = json.loads(inscriptions_path.read_text())
        return ret

    def convert_word_id_in_selector(self, match):
        '''
        Re-encode a word id in a regex match from BASE_FROM to BASE_TO.
        Returns the converted matched string.
        Leave the matched string unchanged in case of error 
            or if the decoded value doesn't match PATTERN_DECODED_VALID
        
        e.g. (xml:id=')(bsdXs) => xml:id='UkεAo
        '''
        # e.g. bsdXs
        word_id = match.group(2)
        
        base = self.guess_encoding_from_word_id(word_id)

        if base == BASE_FROM:
            # word_id: bsdXs => BoεAK
            word_id = convert(word_id, BASE_FROM, BASE_TO)
        elif base != BASE_TO:
            print(f'  WARNING: word_id ({word_id}) encoded with unexpected base ({base}) (expected {BASE_FROM} or {BASE_TO})')

        return match.group(1) + word_id
    
    def guess_encoding_from_word_id(self, word_id):
        '''
        Returns:
            None: if the word_id is in not encoded (e.g. ISic020292-0030)
            FROM: if encoded in FROM base
            TO  : if encoded in TO base
            0   : if encoding unknown
        '''
        ret = 0
              
        for base in [None, BASE_TO, BASE_FROM]:
            word_id_decoded = word_id
            if base:
                try:
                    # e.g. ISic020368-0040
                    word_id_decoded = decompress(word_id, base)
                except KeyError:
                    # Possible error when we try to 52-base decode a 100-base encoded string
                    # KeyError: 'ε'
                    pass
                except CompressedIDLengthError:
                    pass
            
            if self.is_word_id_decoded(word_id_decoded):
                ret = base
                break

        return ret
    
    def is_word_id_decoded(self, word_id):
        '''
        Returns True if the passed word_id is already decoded,
        has a valid format that matches the inscription 
        of the current annotation.
        '''
        match = re.match(PATTERN_DECODED_VALID, word_id)
        return match and match.group(1)+match.group(2) == self.get_inscription_id()

    def get_inscription_id(self):
        # e.g. returns ISic020292
        # from current annotation > target > source .
        # "source": "https://crossreads.web.ox.ac.uk/api/dts/documents?id=ISic020292",
        # ret = self.annotation['target'][1]['source'][-10:]
        ret = re.sub(r'http-sicily-classics-ox-ac-uk-inscription-isic(\d+)-.*', r'ISic\1', self.annotations_file_path.name)
        return ret



    def convert_all_annotations_files(self):
        path_annotations = (Path(__file__) / PATH_ANNOTATIONS_RELATIVE).resolve()

        for file in sorted(path_annotations.glob('*.json')):
            file = Path(file)
            if not FILTERED_ANNOTATION_FILE or FILTERED_ANNOTATION_FILE in str(file):
                self.annotations_file_path = file
                print(file.name)
                changed = 0
                annotations = json.loads(file.read_text())
                for annotation in annotations:
                    self.annotation = annotation

                    if self.get_inscription_id() not in self.listed_inscription_ids:
                        print('  SKIPPED (inscription file not listed in annotator)')
                        break

                    generator = annotation.get('generator', '')
                    targets = annotation['target']
                    if type(targets) == list:
                        for target in annotation['target']:
                            # "value": "//*[@xml:id='bsdXs']",
                            selector = target['selector']['value']
                            selector_new = re.sub(PATTERN_SELECTOR_WITH_ID, self.convert_word_id_in_selector, selector)
                            if selector_new != selector:
                                changed += 1
                                target['selector']['value'] = selector_new
                                # print(f'  {selector} => {selector_new}')
                
                if len(annotations) != changed:
                    print(f'  {len(annotations)} annotations = {changed} converted + {len(annotations) - changed} unchanged.')

                if not READ_ONLY and changed:
                    print('  WRITTEN')
                    file.write_bytes(json.dumps(annotations, indent=2, ensure_ascii=False).encode('utf8'))
            
convertor = AnnotationIDConvertor()
convertor.convert_all_annotations_files()

