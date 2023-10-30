export type HelperLikeFunction = {
    [type: string]: Function
}

export type ReplacementObject = {
    start: number;
    end: number;
    code: string;
}

export type VariableNodeObject = {
    node: Node;
    key: string;
}