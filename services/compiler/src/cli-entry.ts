#!/usr/bin/env node
/**
 * polaris compile city "<City>"
 */
import { compileCity } from "./index.js";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "city" && args[1]) {
    const cityName = args.slice(1).join(" ").replace(/^["']|["']$/g, "");
    console.log(`POLARIS City Compiler — compiling "${cityName}"…`);
    const result = await compileCity({ cityName });
    console.log(JSON.stringify({
      packagePath: result.packagePath,
      citySlug: result.installed.citySlug,
      cityVersion: result.installed.cityVersion,
      twinReadinessScore: result.installed.twinReadinessScore,
      packageId: result.manifest.packageId,
    }, null, 2));
    process.exit(0);
  }
  console.error(`Usage: polaris-compile city "<City Name>"`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
