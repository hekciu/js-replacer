import _traverse from '@babel/traverse';
import * as parser from '@babel/parser';
import { Node } from '@babel/types';
import generate from '@babel/generator';

import { HelperLikeFunction, ReplacementObject } from '../types/engine';
import print from '../utils/print'

function Engine(): HelperLikeFunction {
    return {
        compareAst,
        schemeExpressionToAst
    }

    function compareAst(scheme: Node, target: Node): boolean {
        let isMatch = true;

        if (!target) {
            return false;
        }

        for (const key of Object.keys(scheme)) {
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
        const variableNodes: Node[] = []

        for (const key of Object.keys(exprCopy)) {
            if (typeof exprCopy[key] === 'object') {
                let deleted: boolean = false;

                for (const subKey of Object.keys(exprCopy[key])) {
                    if (variables.indexOf(exprCopy[key][subKey]) > -1) {
                        variableNodes.push(JSON.parse(JSON.stringify(exprCopy[key])))
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

    function schemeExpressionToAst(schemeExpr: string): {cleanNode: Node, varNodes: Node[]} | false {
        let i = 0;
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
                varNodes: variableNodes
            };
        } catch (e) {
            print(`An error occured while parsing input scheme expression, error message: \n${e.message}`)

            return false;
        }
    }

    function generateNewExprCode(ast: Node): string {

    }

    function replaceMatchingExpressions(script: string, schemeAst: Node): string {
        let output = script;
        const replacements: ReplacementObject[] = [];

        try {
            const scriptAst = parser.parse(script);

            const traverseOpts = {};
            traverseOpts[schemeAst.type] = function ({ node }: { node: Node }) {
                const start = node.start;
                const end = node.end;

                const substr = script.slice(start, end);
                const targetAst = parser.parseExpression(substr, {
                    allowImportExportEverywhere: true,
                    sourceType: 'unambiguous'
                })

                const isMatch = compareAst(schemeAst, targetAst); //TODO: przetestowanie czy to działa i ma sens

                if (isMatch) {
                    replacements.push({
                        start,
                        end,
                        code: generateNewExprCode(targetAst)
                    })
                }
            }

            const traverse = _traverse();

            traverse(scriptAst, traverseOpts);

        } catch (e) {
            print(`An error occured while parsing input file, error message: \n${e.message}`)
        }

        return output;
    }
}

export default Engine();