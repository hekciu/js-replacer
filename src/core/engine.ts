import _traverse from '@babel/traverse';
import * as parser from '@babel/parser';
import { Node } from '@babel/types';

import { HelperLikeFunction, ReplacementObject } from '../types/engine';
import print from '../utils/print'

function Engine(): HelperLikeFunction {
    return {
        compareAst,
        schemeExpressionToAst
    }

    const traverse = _traverse();

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
        const exprCopy = JSON.parse(JSON.stringify(exprAst))

        for (const key of Object.keys(exprCopy)) {
            if (typeof exprCopy[key] === 'object') {
                let deleted: boolean = false;

                for (const subKey of Object.keys(exprCopy[key])) {
                    if (variables.indexOf(exprCopy[key][subKey]) > -1) {
                        delete exprCopy[key];
                        deleted = true;
                    }
                }

                if (!deleted) {
                    exprCopy[key] = _removeVariables(exprCopy[key], variables);
                }
            }

            if (Array.isArray(exprCopy[key])) {
                exprCopy[key] = exprCopy[key].filter((el: Node | undefined) => {
                    return typeof el !== 'undefined';
                })
            }
        }

        return exprCopy;
    }

    function schemeExpressionToAst(schemeExpr: string): Node | false {
        let i = 0;
        const variables: string[] = [];

        while (schemeExpr.indexOf('*') > -1) {
            const variable = `var${i}`;
            i++;

            if (schemeExpr.indexOf(variable) === -1) {
                schemeExpr = schemeExpr.replace('*', variable);

                variables.push(variable);
            }
        }

        try {
            const exprAst = parser.parseExpression(schemeExpr, {
                allowImportExportEverywhere: true,
                sourceType: 'unambiguous'
            })

            return _removeVariables(exprAst, variables);
        } catch (e) {
            print(`An error occured while parsing input scheme expression, error message: \n${e.message}`)

            return false;
        }
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
            }
        } catch (e) {
            print(`An error occured while parsing input file, error message: \n${e.message}`)
        }

        return output;
    }
}

export default Engine();