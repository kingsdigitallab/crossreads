/**
 * Generates JSON schemas for all types of JSON data files 
 * used by the annotating envirnonemnt
 * using the 'generate-schema' library.
 */

// const GenerateSchema = require('generate-schema')
import GenerateSchema from 'generate-schema';
import {utils, FILE_PATHS} from '../../app/utils.mjs';

import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PARENT_PATH = dirname(__filename);

for (const [file_type, file_path] of Object.entries(FILE_PATHS) ) {
    const obj = utils.readJsonFile(`${PARENT_PATH}/../../${file_path}`)
    const res = GenerateSchema.json(file_type, obj)
    utils.writeJsonFile(`${PARENT_PATH}/${file_type.toLowerCase()}_schema.json`, res)
}
