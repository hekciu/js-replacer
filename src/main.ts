import Engine from "./core/Engine";
import FileHandler from "./core/FileHandler";


const scheme = Engine.schemeExpressionToAst('Object.keys(*1, *2)')

const target = Engine.schemeExpressionToAst('Obiekt.klucze(*1, *2)', false) //known bug
FileHandler.processFileByPath(__dirname + '/../examples/file.js', scheme, target)

// console.log(Engine.replaceMatchingExpressions(file, scheme, target))
