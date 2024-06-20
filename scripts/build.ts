import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { readdir, rename, rm } from "fs/promises";

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
  const bins = await readdir(`src-tauri/bin`, { encoding: "utf8" });
  bins.sort((a, b) => b.length - a.length);
  console.log(bins);
  for (let bin of bins) {
    const strs = bin.split(".");
    if (strs.length > 1) strs.pop();
    bin = strs.join(".");

    const oldPath = `src-tauri/bin/${bin}${extension}`;
    const newPath = `src-tauri/bin/${bin}-${targetTriple}${extension}`;

    if (bin.includes(targetTriple)) {
      await rm(oldPath, { recursive: true, maxRetries: 3 });
    } else {
      await rename(oldPath, newPath);
      console.log(`renamed file: ${oldPath} --> ${newPath}`);
    }
  }
}

main().catch((e) => {
  throw e;
});
