import { Node } from '@babel/types';

export type HelperLikeFunction = {
    [type: string]: Function
}

export type ReplacementObject = {
    start: number;
    end: number;
    code: string;
}

export type VariableNodeObject = {
    value: Node;
    key: string;
}
