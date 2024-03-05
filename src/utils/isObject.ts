export default function isObject (input: any): boolean {
    return typeof input === 'object' && input !== null;
}