// Run from any directory. Optional --pdf uses the local PDFreactor service.
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { buildIppltViewModel } from "./view-model.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const cases = ["single", "multiple", "no-refund", "loan"];
if (args.some((a) => a !== "--pdf" && ![...cases, "many-rows"].includes(a))) {
  console.error(
    "Usage: node src/ipplt/run-example.js [single|multiple|no-refund|loan|many-rows] [--pdf]",
  );
  process.exit(1);
}
const selected = args.filter((a) => a !== "--pdf");
const output = join(root, "output/ipplt");
mkdirSync(output, { recursive: true });
for (const name of selected.length ? selected : cases) {
  const input = JSON.parse(
    readFileSync(join(root, `data-samples/ipplt/${name}.json`), "utf8"),
  );
  const model = buildIppltViewModel(input);
  const modelPath = join(output, `${name}.view-model.json`);
  const htmlPath = join(output, `${name}.html`);
  writeFileSync(modelPath, JSON.stringify(model, null, 2) + "\n");
  execFileSync(
    process.execPath,
    [
      join(root, "src/render.js"),
      join(root, "templates/ipplt.hbs"),
      modelPath,
      "--out",
      htmlPath,
    ],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  console.log(`View model: ${modelPath}\nHTML: ${htmlPath}`);
  if (args.includes("--pdf")) {
    execFileSync(
      process.execPath,
      [join(root, "src/html-to-pdf.js"), htmlPath, join(output, `${name}.pdf`)],
      { stdio: "inherit" },
    );
  }
}
