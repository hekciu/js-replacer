import * as fs from 'fs';
import { Node } from '@babel/types';

import Engine from './Engine';

export default class FileHandler {
    constructor() {
        throw new Error('This class should not be instantiated, use static methods instead');
    }

    public static processFileByPath(absolutePath: string, scheme: Node, target: Node ) {
        const file = fs.readFileSync(absolutePath).toString(); /* TODO need to be tested well as it could make
            with encodings */

        const processedFile = Engine.replaceMatchingExpressions(file, scheme, target);

        fs.writeFileSync(absolutePath, processedFile);
    }
}