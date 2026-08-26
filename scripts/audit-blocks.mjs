import fs from "node:fs";

const source = fs.readFileSync("src/lib/engine/scripts.ts", "utf8");
const editor = fs.readFileSync("src/components/engine/ScriptEditor.tsx", "utf8");
const listMatch = source.match(/export const ALL_BLOCKS: BlockKind\[\] = \[(.*?)\];/s);
const all = [...(listMatch?.[1]?.matchAll(/"([A-Za-z0-9]+)"/g) ?? [])].map(match => match[1]);
const executed = new Set([...source.matchAll(/case "([A-Za-z0-9]+)"/g)].map(match => match[1]));
const defaults = new Set([...editor.matchAll(/case "([A-Za-z0-9]+)":/g)].map(match => match[1]));
const labels = new Set(Object.keys(Object.fromEntries([...source.matchAll(/^  ([A-Za-z0-9]+):/gm)].map(match => [match[1], true]))));
const report = {
  total: all.length,
  missingExecution: all.filter(kind => !executed.has(kind)),
  missingDefaults: all.filter(kind => !defaults.has(kind)),
  missingLabels: all.filter(kind => !labels.has(kind)),
};
console.log(JSON.stringify(report, null, 2));
if (report.missingExecution.length || report.missingDefaults.length || report.missingLabels.length) process.exitCode = 1;
