export default function deepClone(inputObject: object): object {
    return JSON.parse(JSON.stringify(inputObject));
}