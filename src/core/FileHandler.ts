import fs from 'fs';

export default class FileHandler {
    constructor() {
        throw new Error('This class should not be instantiated, use static methods instead');
    }

    public static processFileByPath(path: string) {
        const file = fs.read
    }
}