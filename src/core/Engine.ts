import traverse from '@babel/traverse';
import * as parser from '@babel/parser';
import { Node } from '@babel/types';
import generate from '@babel/generator';
import { compare } from '@putout/compare';

import { ReplacementObject,
    VariableNodeObject } from '../types/Engine';
import print from '../utils/print';
import deepClone from '../utils/deepClone'
import isObject from '../utils/isObject';
import { IGNORED_PROPERTIES } from './constants';

let _currentVariables: Array<string> = [];

class Engine {
    constructor() {
        throw new Error('This class should not be instantiated, use static methods instead');
    }

    static compareAst(firstPriority: Node,
        secondPriority: Node): boolean {

        let isMatch = true;

        if (!secondPriority) {
            return false;
        }

        for (const key of Object.keys(firstPriority)) {
            if (IGNORED_PROPERTIES.includes(key)) {
                continue;
            }

            if (typeof secondPriority[key] === 'object') {
                let shouldContinue = false;
                for (const value of Object.values(secondPriority[key])) {
                    shouldContinue = typeof value === 'string' && _currentVariables.includes(value);

                    if (shouldContinue) {
                        continue;
                    }
                }

                if (shouldContinue) {
                    continue;
                }
            }

            if (typeof firstPriority[key] === 'object') {
                isMatch = Engine.compareAst(firstPriority[key], secondPriority[key]);              
            } else {
                isMatch = firstPriority[key] === secondPriority[key];
            }

            if (!isMatch) {
                break;
            }
        }

        return isMatch;
    }

    static schemeExpressionToAst(schemeExpr: string, updateVariables: boolean = true): Node {
        const variables: string[] = [];
        const varRegex = new RegExp(/\*[0-9]+/); // *0, *2, *67

        while (schemeExpr.search(varRegex) > -1) {
            const variable = `js_replacer__tmp_variable__${schemeExpr.match(varRegex)[0].slice(1)}`;

            if (schemeExpr.includes(variable)) {
                throw new Error(`Please pick other number for *${variable.split('__').pop()} so it\
                doesn't have the same number as the ${variable} used inside your expression`)
            }
            schemeExpr = schemeExpr.replace(varRegex, variable);

            variables.push(variable);
        }

        if (updateVariables) {
            _currentVariables = variables;
        }

        try {
            const exprAst = parser.parseExpression(schemeExpr, {
                allowImportExportEverywhere: true,
                sourceType: 'unambiguous'
            })

            return exprAst;

        } catch (e) {
            throw new Error(`An error occured while parsing input scheme expression, error message: \n${e.message}`)
        }
    }

    static _replaceVariables(ast: Node, variableName: string, value: Node): Node {
        const astCopy = deepClone(ast) as Node;

        for (const key of Object.keys(ast)) {
            if (IGNORED_PROPERTIES.includes(key)) {
                continue;
            }

            if (isObject(astCopy[key])) {
                astCopy[key] = Engine._replaceVariables(astCopy[key], variableName, value);              
            } else if (astCopy[key] === variableName) {
                return value;
            }
        }

        return astCopy
    }

    static _generateNewExprCode(targetAst: Node, varNodeObjs: VariableNodeObject[]): string | false {
        let replacedAst = deepClone(targetAst) as Node;
        const varNodeObjsCopy = deepClone(varNodeObjs) as VariableNodeObject[];

        try {
            for (const varNodeObj of varNodeObjsCopy) {
                replacedAst = Engine._replaceVariables(replacedAst, varNodeObj.key, varNodeObj.value);
            }

            const { code } = generate(replacedAst);

            return code;
        } catch(e) {
            print(`An error occured while generating new expression code, error message: \n${e.message}`);
            return false;
        }
    }

    static _extractVariables(schemeAst: Node, elementAst: Node): Array<VariableNodeObject> {
        let variableReplacements: Array<VariableNodeObject> = [];

        for (const key of Object.keys(schemeAst)) {
            if (IGNORED_PROPERTIES.includes(key)) {
                continue;
            }

            if (typeof schemeAst[key] === 'object') {
                variableReplacements.push(...Engine._extractVariables(schemeAst[key], elementAst[key]));              
            } else if (_currentVariables.indexOf(schemeAst[key]) > -1) {
                variableReplacements.push({
                    key: schemeAst[key],
                    value: elementAst
                });
            }
        }

        return variableReplacements;
    }

    static removeVariables(node: Node) {
        const nodeCopy = deepClone(node) as Node;

        for (const key of Object.keys(nodeCopy)) {
            if (isObject(nodeCopy[key])) {
                for (const value of Object.values(nodeCopy[key])) {
                    if (_currentVariables.includes(value as string)) {
                        delete nodeCopy[key];
                        break;
                    }
                }

                if (nodeCopy[key]) {
                    nodeCopy[key] = Engine.removeVariables(nodeCopy[key]);
                }
            }
        }

        return nodeCopy
    }

    static replaceMatchingExpressions(script: string, schemeAst: Node, targetAst: Node): string {
        let output = script;
        const replacements: ReplacementObject[] = [];

        const scriptAst = parser.parse(script);

        // workaround for duplicates
        const usedPositions: { start: number, end: number }[] = [];

        const enter = function ({ node }: { node: Node }) {
            const start = node.start;
            const end = node.end;

            for (const usedPosition of usedPositions) {
                if (start === usedPosition.start && end === usedPosition.end) {
                    return;
                }
            }

            const expressionSubstr = script.slice(start, end);

            try {
                console.log('attempting to parse ', expressionSubstr)
                const elementAst = parser.parseExpression(expressionSubstr)

                const isMatch = compare(Engine.removeVariables(elementAst), Engine.removeVariables(schemeAst));

                if (isMatch) {
                    const varNodeObjs: VariableNodeObject[] = Engine._extractVariables(schemeAst, elementAst);

                    replacements.push({
                        start,
                        end,
                        code: Engine._generateNewExprCode(targetAst, varNodeObjs) || expressionSubstr
                    })

                    usedPositions.push({
                        start,
                        end
                    })
                }
            } catch (e) {
                print(`Could not parse expression with type ${node.type}, details: ${e.message}`)
            }
        }

        traverse(scriptAst, {
            enter: enter
        });

        let currentCharacterDiff = 0;

        replacements.forEach((replacementObj) => {
            const charactersBefore = output.length;
            output = `${output.slice(0, replacementObj.start + currentCharacterDiff)}${replacementObj.code}${output.slice(replacementObj.end + currentCharacterDiff)}`;
            currentCharacterDiff = currentCharacterDiff + (output.length - charactersBefore);
        })

        return output;
    }
}

export default Engine;