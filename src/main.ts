import engine from "./core/engine";

const file = `
const simpleObject = {
    oneProperty: 'smth',
    secondProperty: 'something else'
}
for (const key of Object.keys(simpleObject)) {
    console.log(key);
}
`

const {
    cleanNode: schemeAst,
    nodeWithVars,
    varNodes: varNodeObjs
} = engine.schemeExpressionToAst('Object.keys(*1)')

const {
    cleanNode: targetAst,
    nodeWithVars: targetNodeWithVars,
    varNodes: targetVarNodes
} = engine.schemeExpressionToAst('Obiekt.klucze(*1)')

console.log('input 1 ', file)
console.log('input 2 ', schemeAst)
console.log('input 3 ', targetAst)
console.log('input 4 ', varNodeObjs)

console.log(engine.replaceMatchingExpressions(file, schemeAst, targetAst, varNodeObjs))