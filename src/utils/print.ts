export default function print(message: string, isError: boolean = false):void {
    const time = new Date();

    console[isError ? 'error' : 'log'](`[replacer-js ${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}] ${message}`)
}