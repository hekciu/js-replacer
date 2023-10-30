import traverse from '@babel/traverse';
import * as parser from '@babel/parser';
import { Node } from '@babel/types';
import generate from '@babel/generator';

import { HelperLikeFunction, ReplacementObject, VariableNodeObject } from '../types/engine';
import print from '../utils/print';
import { IGNORED_PROPERTIES } from './constants';

function Engine(): HelperLikeFunction {
    return {
        compareAst,
        schemeExpressionToAst,
        replaceMatchingExpressions
    }

    function compareAst(scheme: Node, target: Node): boolean {
        let isMatch = true;

        if (!target) {
            return false;
        }

        for (const key of Object.keys(scheme)) {
            if (IGNORED_PROPERTIES.indexOf(key) > -1) {
                continue;
            }

            if (typeof scheme[key] === 'object') {
                isMatch = compareAst(scheme[key], target[key]);              
            } else {
                isMatch = scheme[key] === target[key];
            }

            if (!isMatch) {
                break;
            }
        }

        return isMatch;
    }

    function _removeVariables(exprAst: Node, variables: string[]) {
        const exprCopy = JSON.parse(JSON.stringify(exprAst));
        const variableNodes: VariableNodeObject[] = [];

        for (const key of Object.keys(exprCopy)) {
            if (typeof exprCopy[key] === 'object' && exprCopy[key]) {
                let deleted: boolean = false;

                for (const subKey of Object.keys(exprCopy[key])) {
                    if (variables.indexOf(exprCopy[key][subKey]) > -1) {
                        variableNodes.push({
                            node: JSON.parse(JSON.stringify(exprCopy[key])),
                            key: key
                        })
                        delete exprCopy[key];
                        deleted = true;
                    }
                }

                if (!deleted) {
                    const {
                        newVariableNodes,
                        newNodeCopy
                    } = _removeVariables(exprCopy[key], variables);
                    exprCopy[key] = newNodeCopy;
                    variableNodes.push(...newVariableNodes)
                }
            }

            if (Array.isArray(exprCopy[key])) {
                exprCopy[key] = exprCopy[key].filter((el: Node | undefined) => {
                    return typeof el !== 'undefined';
                })
            }
        }

        return {
            newVariableNodes: variableNodes,
            newNodeCopy: exprCopy
        };
    }

    function schemeExpressionToAst(schemeExpr: string): {cleanNode: Node, nodeWithVars: Node, varNodes: VariableNodeObject[]} | false {
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

        try {
            const exprAst = parser.parseExpression(schemeExpr, {
                allowImportExportEverywhere: true,
                sourceType: 'unambiguous'
            })

            const {
                newVariableNodes: variableNodes,
                newNodeCopy: nodeCopy
            } = _removeVariables(exprAst, variables);

            return {
                cleanNode: nodeCopy,
                nodeWithVars: exprAst,
                varNodes: variableNodes
            };
        } catch (e) {
            print(`An error occured while parsing input scheme expression, error message: \n${e.message}`)

            return false;
        }
    }

    function _hasCertainValue(node: Node, value: string): boolean {
        for (const key of Object.keys(node)) {
            if (node[key] === value) {
                return true;
            }
        }

        return false;
    }

    function _replaceWithCertainValue(ast: Node, value: string, replacement: Node) {
        const astCopy = JSON.parse(JSON.stringify(ast));

        if (_hasCertainValue(astCopy, value)) {
            return replacement;
        }

        for (const key of Object.keys(astCopy)) {
            if (typeof astCopy[key] !== 'object' || astCopy[key] === null) {
                continue;
            }

            if (_hasCertainValue(astCopy[key], value)) {
                astCopy[key] = JSON.parse(JSON.stringify(replacement));
            } else {
                astCopy[key] = JSON.parse(JSON.stringify(_replaceWithCertainValue(astCopy[key], value, replacement)));
            }
        }

        return astCopy;
    }

    // TODO: wyciaganie zmiennych z aktualnie przetwarzanego faktycznego node'a w skrypcie,
    // aktualnie to dziala jakos chujowo inaczej

    function _generateNewExprCode(targetAst: Node, varNodeObjs: VariableNodeObject[]): string | false {
        const targetAstCopy = JSON.parse(JSON.stringify((targetAst)));
        const varNodeObjsCopy = JSON.parse(JSON.stringify(varNodeObjs));

        try {
            let replacedAst = targetAstCopy;

            for (const varNodeObj of varNodeObjsCopy) {
               replacedAst = _replaceWithCertainValue(targetAstCopy, varNodeObj.key, varNodeObj.node);
            }

            const codeObj = generate(replacedAst);

            return codeObj.code;
        } catch(e) {
            print(`An error occured while generating new expression code, error message: \n${e.message}`);
            return false;
        }
    }

    function _extractVariables(variableArray: Node[], schemeAst: Node, targetAst: Node):void {
        for (const key of Object.keys(targetAst)) {
            //dodaj wyciaganie tych rzeczy ktore sa w scheme jako VARIABLES, nie sa w IGNORED, chyba moga byc null
            // to nie moze byc czysty node tylko node ze zmiennymi i te rzeczy ktore beda mialy zmienne 
            // w _hasCertainValue to znaczy (chyba) ze to jest wlasnie ta zmienna i trzeba to zamienic w targecie / outpucie
        }
    }

    function replaceMatchingExpressions(script: string, schemeAst: Node, targetAst: Node, varNodeObjs: VariableNodeObject[]): string {
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

                const isMatch = compareAst(schemeAst, elementAst);

                if (isMatch) {
                    replacements.push({
                        start,
                        end,
                        code: _generateNewExprCode(targetAst, varNodeObjs) || substr
                    })
                }
            }

            traverse(scriptAst, traverseOpts);

            replacements.forEach((replacementObj) => {
                output = `${output.slice(0, replacementObj.start)}${replacementObj.code}${output.slice(replacementObj.end)}`;
            })
        } catch (e) {
            print(`An error occured while parsing input file, error message: \n${e.message}`)
        }

        return output;
    }
}

export default Engine();