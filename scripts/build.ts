import { execFileSync } from "child_process";
import { rename } from "fs/promises";

let extension = "";
if (process.platform === "win32") {
  extension = ".exe";
}

async function main() {
  const rustInfo = execFileSync("rustc", ["-vV"]).toString("utf8");
  const targetTriple = (/host: (\S+)/g.exec(rustInfo) ?? [])[1]?.trim();
  if (!targetTriple) {
    console.error("Failed to determine platform target triple");
  }
  await rename(
    `src-tauri/bin/server${extension}`,
    `src-tauri/bin/server-${targetTriple}${extension}`
  );
}

main().catch((e) => {
  throw e;
});
