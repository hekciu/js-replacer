export type HelperLikeFunction = {
    [type: string]: Function
}

export type ReplacementObject = {
    start: number;
    end: number;
    code: string;
}