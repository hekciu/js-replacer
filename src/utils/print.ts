export default function print(message: string):void {
    const time = new Date();

    console.log(`[replacer-js ${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}] ${message}`)
}