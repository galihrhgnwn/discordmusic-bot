import { Jinter } from 'jintr';
const jinter = new Jinter();
const scriptOutput = "var exportedVars = { nFunction: (n) => n, sigFunction: (n) => n };";
jinter.evaluate(scriptOutput);
const properties = ["n: exportedVars.nFunction('abc')"];
try {
  console.log(jinter.evaluate(`(function() { return { ${properties.join(', ')} } })()`));
} catch (e) {
  console.error(e);
}
