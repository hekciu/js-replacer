import engine from "./core/engine";

const file = `
const simpleObject = {
    oneProperty: 'smth',
    secondProperty: 'something else'
}
for (const key of Object.keys(simpleObject)) {
    console.log(key);
}

for (const chuj of dupa) {
    console.log(Object);
    console.log(Object.keys([]))
}

Object.keys(simpleObject)

for (const chuj of dupa) {
    Object.keys(function() {
        chuj()
    })
}

Object.keys(ciasteczko)
Object.keys(rumianek)
`

const scheme = engine.schemeExpressionToAst('Object.keys(*1)')

const target = engine.schemeExpressionToAst('Obiekt.klucze(*1)')

console.log(engine.replaceMatchingExpressions(file, scheme, target))