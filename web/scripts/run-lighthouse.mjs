import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const baseUrl = process.env.LHCI_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.resolve("lighthouse-report");
const numberOfRuns = 2;
const routes = [
  { path: "/", checkSeo: true },
  { path: "/series/moonlight-laundry", checkSeo: true },
  { path: "/studio", checkSeo: false },
];
const thresholds = {
  accessibility: 0.85,
  "best-practices": 0.8,
  performance: 0.6,
  seo: 0.85,
};

function score(result, category) {
  return result.lhr.categories[category]?.score ?? 0;
}

function reportName(route, run) {
  const routeName = route === "/" ? "home" : route.slice(1).replaceAll("/", "_");
  return `${routeName}-run-${run}`;
}

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

const chrome = await launch({
  chromePath: process.env.CHROME_PATH,
  chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
});
const manifest = [];
const failures = [];

try {
  for (const route of routes) {
    for (let run = 1; run <= numberOfRuns; run += 1) {
      const url = new URL(route.path, baseUrl).toString();
      const result = await lighthouse(url, {
        logLevel: "error",
        output: ["html", "json"],
        port: chrome.port,
      });
      if (!result) {
        throw new Error(`Lighthouse returned no result for ${url}`);
      }

      const name = reportName(route.path, run);
      const [htmlReport, jsonReport] = result.report;
      await writeFile(
        path.join(outputDirectory, `${name}.html`),
        htmlReport,
        "utf8",
      );
      await writeFile(
        path.join(outputDirectory, `${name}.json`),
        jsonReport,
        "utf8",
      );

      const summary = {
        accessibility: score(result, "accessibility"),
        bestPractices: score(result, "best-practices"),
        performance: score(result, "performance"),
        seo: score(result, "seo"),
      };
      manifest.push({ route: route.path, run, summary, url });

      for (const category of [
        "accessibility",
        "best-practices",
        ...(route.checkSeo ? ["seo"] : []),
      ]) {
        if (summary[category] < thresholds[category]) {
          failures.push(
            `${route.path} run ${run}: ${category} ` +
              `${summary[category]} < ${thresholds[category]}`,
          );
        }
      }
      if (summary.performance < thresholds.performance) {
        console.warn(
          `WARN ${route.path} run ${run}: performance ` +
            `${summary.performance} < ${thresholds.performance}`,
        );
      }

      console.log(
        `${route.path} run ${run}: ` +
          `performance=${summary.performance} ` +
          `accessibility=${summary.accessibility} ` +
          `best-practices=${summary.bestPractices} ` +
          `seo=${summary.seo}`,
      );
    }
  }
} finally {
  await chrome.kill();
}

await writeFile(
  path.join(outputDirectory, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

if (failures.length > 0) {
  throw new Error(`Lighthouse assertions failed:\n${failures.join("\n")}`);
}
