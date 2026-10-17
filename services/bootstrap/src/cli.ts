function printHelp(): void {
  console.log(`POLARIS Living City Bootstrap Engine

Usage:
  polaris bootstrap city "<City Name>"

Examples:
  polaris bootstrap city "Hyderabad"
  polaris bootstrap city "Singapore"
  polaris bootstrap city "Tokyo, Japan"

Options:
  --work-root <path>   Output root (default: ./data/bootstrap)
  --skip <id,id>       Comma-separated connector ids to skip
  -h, --help           Show help

Never fabricates missing datasets. Reports gaps in bootstrap-report.md.
`);
}

export async function runCli(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    return args.length === 0 ? 1 : 0;
  }

  if (args[0] === "bootstrap" && args[1] === "city") {
    const cityParts: string[] = [];
    let workRoot: string | undefined;
    let skip: string[] = [];
    for (let i = 2; i < args.length; i++) {
      const a = args[i]!;
      if (a === "--work-root") {
        workRoot = args[++i];
        continue;
      }
      if (a === "--skip") {
        skip = (args[++i] ?? "").split(",").filter(Boolean);
        continue;
      }
      cityParts.push(a);
    }
    const cityName = cityParts.join(" ").replace(/^"|"$/g, "").trim();
    if (!cityName) {
      console.error("City name required.");
      printHelp();
      return 1;
    }
    const { bootstrapCity } = await import("./pipeline/bootstrap-city.js");
    try {
      const report = await bootstrapCity({ cityName, workRoot, skipConnectors: skip });
      console.log(`\nReport: ${report.storage.filesystem}/bootstrap-report.md`);
      return report.twinReadinessScore >= 40 ? 0 : 2;
    } catch (err) {
      console.error("Bootstrap failed:", err instanceof Error ? err.message : err);
      return 1;
    }
  }

  console.error(`Unknown command: ${args.join(" ")}`);
  printHelp();
  return 1;
}
