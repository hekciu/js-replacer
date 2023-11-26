import traverse from '@babel/traverse';
import * as parser from '@babel/parser';
import { Node } from '@babel/types';
import generate from '@babel/generator';

import { HelperLikeFunction,
    ReplacementObject,
    VariableNodeObject } from '../types/engine';
import print from '../utils/print';
import { IGNORED_PROPERTIES } from './constants';

function Engine(): HelperLikeFunction {
    return {
        schemeExpressionToAst,
        replaceMatchingExpressions
    }

    let _currentVariables: Array<string> = [];

    function compareAst(firstPriority: Node,
        secondPriority: Node,
        keysToIgnore: Array<string>,
        valuesToIgnore: Array<string>): boolean {

        let isMatch = true;

        if (!secondPriority) {
            return false;
        }

        for (const key of Object.keys(firstPriority)) {
            if (keysToIgnore.indexOf(key) > -1 || valuesToIgnore.indexOf(secondPriority[key]) > -1) {
                continue;
            }

            if (typeof firstPriority[key] === 'object') {
                isMatch = compareAst(firstPriority[key], secondPriority[key], keysToIgnore, valuesToIgnore);              
            } else {
                isMatch = firstPriority[key] === secondPriority[key];
            }

            if (!isMatch) {
                break;
            }
        }

        return isMatch;
    }

    function schemeExpressionToAst(schemeExpr: string): Node | false {
        const variables: string[] = [];
        const varRegex = new RegExp(/\*[0-9]+/); // *0, *2, *67

        while (schemeExpr.search(varRegex) > -1) {
            const variable = `var${schemeExpr.match(varRegex)[0].slice(1)}`;

            if (schemeExpr.indexOf(variable) > -1) {
                throw new Error(`Please pick other number for *${variable.slice(3)} so it doesn't have the 
                same number as the ${variable} used inside your expression`)
            }
            schemeExpr = schemeExpr.replace(varRegex, variable);

            variables.push(variable);
        }

        _currentVariables = variables;

        try {
            const exprAst = parser.parseExpression(schemeExpr, {
                allowImportExportEverywhere: true,
                sourceType: 'unambiguous'
            })

            return exprAst;

        } catch (e) {
            print(`An error occured while parsing input scheme expression, error message: \n${e.message}`)

            return false;
        }
    }

    function _replaceVariables(ast: Node, variableName: string, value: string | Node): Node {
        const astCopy = JSON.parse(JSON.stringify(ast));

        for (const key of Object.keys(ast)) {
            if (typeof astCopy[key] === 'object') {
                astCopy[key] = _replaceVariables(astCopy[key], variableName, value);              
            } else if (astCopy[key] === variableName){
                astCopy[key] = value;
            }
        }

        return astCopy
    }

    function _generateNewExprCode(targetAst: Node, varNodeObjs: VariableNodeObject[]): string | false {
        const targetAstCopy = JSON.parse(JSON.stringify((targetAst)));
        const varNodeObjsCopy = JSON.parse(JSON.stringify(varNodeObjs));

        try {
            let replacedAst = targetAstCopy;

            for (const varNodeObj of varNodeObjsCopy) {
               replacedAst = _replaceVariables(targetAstCopy, varNodeObj.key, varNodeObj.value);
            }

            const codeObj = generate(replacedAst);

            return codeObj.code;
        } catch(e) {
            print(`An error occured while generating new expression code, error message: \n${e.message}`);
            return false;
        }
    }

    function _extractVariables(schemeAst: Node, elementAst: Node): Array<VariableNodeObject> {
        const variableReplacements: Array<VariableNodeObject> = [];

        for (const key of Object.keys(schemeAst)) {
            if (typeof schemeAst[key] === 'object') {
                variableReplacements.push(..._extractVariables(schemeAst[key], elementAst[key]));              
            } else if (_currentVariables.indexOf(schemeAst[key]) > -1) {
                variableReplacements.push({
                    key: schemeAst[key],
                    value: elementAst[key] // idk???? TODO TODO TODO
                });
            }
        }

        return variableReplacements;
    }

    function replaceMatchingExpressions(script: string, schemeAst: Node, targetAst: Node): string {
        let output = script;
        const replacements: ReplacementObject[] = [];

        try {
            const scriptAst = parser.parse(script);

            const traverseOpts = {};
            traverseOpts[schemeAst.type] = function ({ node }: { node: Node }) {
                const start = node.start;
                const end = node.end;

                const substr = script.slice(start, end);
                const elementAst = parser.parseExpression(substr, {
                    allowImportExportEverywhere: true,
                    sourceType: 'unambiguous'
                })

                const isMatch = compareAst(elementAst, schemeAst, IGNORED_PROPERTIES, _currentVariables);

                if (isMatch) {
                    const varNodeObjs : VariableNodeObject[] = _extractVariables(schemeAst, elementAst);
    
                    replacements.push({
                        start,
                        end,
                        code: _generateNewExprCode(targetAst, varNodeObjs) || substr
                    })
                }
            }

            traverse(scriptAst, traverseOpts);

            let currentCharacterDiff = 0;

            replacements.forEach((replacementObj) => {
                const charactersBefore = output.length;
                output = `${output.slice(0, replacementObj.start + currentCharacterDiff)}${replacementObj.code}${output.slice(replacementObj.end + currentCharacterDiff)}`;
                currentCharacterDiff = currentCharacterDiff + (output.length - charactersBefore);
            })
        } catch (e) {
            print(`An error occured while parsing input file, error message: \n${e.message}`)
        }

        return output;
    }
}

export default Engine();