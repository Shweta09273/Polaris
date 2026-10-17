#!/usr/bin/env node
/**
 * POLARIS CLI — bootstrap + compile + package helpers
 */
import { runCli as runBootstrapCli } from "@polaris/bootstrap";
import { compileCity } from "@polaris/compiler";
import { PolarisRuntime } from "@polaris/runtime";
import { resolve } from "node:path";

async function main() {
  const argv = process.argv.slice(2);
  const [cmd, sub, ...rest] = argv;

  if (cmd === "bootstrap") {
    const code = await runBootstrapCli(process.argv);
    process.exit(code);
  }

  if (cmd === "compile" && sub === "city") {
    const cityName = rest.join(" ").replace(/^["']|["']$/g, "");
    if (!cityName) {
      console.error('Usage: polaris compile city "<City>"');
      process.exit(1);
    }
    const result = await compileCity({ cityName });
    console.log(
      JSON.stringify(
        {
          packagePath: result.packagePath,
          citySlug: result.installed.citySlug,
          cityVersion: result.installed.cityVersion,
          twinReadinessScore: result.installed.twinReadinessScore,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  if (cmd === "package" && sub === "export") {
    const slug = rest[0];
    const out = rest[1] ?? `${slug}.polaris`;
    if (!slug) {
      console.error("Usage: polaris package export <citySlug> [out.polaris]");
      process.exit(1);
    }
    const runtime = new PolarisRuntime();
    const path = await runtime.exportPackage(slug, resolve(out));
    console.log(path);
    process.exit(0);
  }

  if (cmd === "package" && sub === "import") {
    const path = rest[0];
    if (!path) {
      console.error("Usage: polaris package import <file.polaris>");
      process.exit(1);
    }
    const runtime = new PolarisRuntime();
    const city = await runtime.importPackage({ packagePath: resolve(path) });
    console.log(
      JSON.stringify(
        {
          citySlug: city.citySlug,
          cityVersion: city.cityVersion,
          twinReadinessScore: city.manifest.twinReadinessScore,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  if (cmd === "package" && sub === "validate") {
    const path = rest[0];
    if (!path) {
      console.error("Usage: polaris package validate <file.polaris>");
      process.exit(1);
    }
    const runtime = new PolarisRuntime();
    const result = await runtime.validatePackage(resolve(path));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 2);
  }

  if (cmd === "cities" && (sub === "list" || !sub)) {
    const runtime = new PolarisRuntime();
    console.log(JSON.stringify(runtime.listInstalled(), null, 2));
    process.exit(0);
  }

  console.error(`POLARIS CLI

  polaris bootstrap city "<City>"
  polaris compile city "<City>"
  polaris package export <citySlug> [out.polaris]
  polaris package import <file.polaris>
  polaris package validate <file.polaris>
  polaris cities list
`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
