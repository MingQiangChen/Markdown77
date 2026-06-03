import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { packager } from "@electron/packager";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootPackage = JSON.parse(await fs.readFile(path.join(rootDir, "package.json"), "utf8"));
const desktopPackagePath = path.join(rootDir, "apps/desktop/package.json");
const desktopPackage = JSON.parse(await fs.readFile(desktopPackagePath, "utf8"));
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
const releaseRoot = path.join(rootDir, "release", `Markdown77-cross-${rootPackage.version}-${stamp}`);

const targets = [
  { platform: "win32", arch: "x64", zipName: `Markdown77-win-x64-${rootPackage.version}.zip` },
  { platform: "linux", arch: "x64", zipName: `Markdown77-linux-x64-${rootPackage.version}.zip` }
];

await fs.mkdir(releaseRoot, { recursive: true });
await fs.writeFile(
  desktopPackagePath,
  `${JSON.stringify(
    {
      ...desktopPackage,
      name: "markdown77",
      productName: "Markdown77",
      author: "Markdown77"
    },
    null,
    2
  )}\n`,
  "utf8"
);

try {
  for (const target of targets) {
    const outputPaths = await packager({
      dir: path.join(rootDir, "apps/desktop"),
      out: releaseRoot,
      name: "Markdown77",
      platform: target.platform,
      arch: target.arch,
      electronVersion: "22.3.27",
      overwrite: true,
      appVersion: rootPackage.version,
      appBundleId: "com.markdown77.desktop",
      executableName: "Markdown77",
      ignore: [
        /^\/src($|\/)/,
        /^\/electron($|\/)/,
        /^\/node_modules($|\/)/,
        /^\/tsconfig.*$/,
        /^\/vite.config.*$/,
        /^\/index.html$/
      ],
      prune: false
    });

    const appDir = outputPaths[0];
    const zipPath = path.join(releaseRoot, target.zipName);
    const zipResult = spawnSync("zip", ["-qry", zipPath, path.basename(appDir)], {
      cwd: releaseRoot,
      stdio: "inherit"
    });

    if (zipResult.status !== 0) {
      throw new Error(`Failed to zip ${appDir}`);
    }

    console.log(`${target.platform}-${target.arch}=${zipPath}`);
  }

  console.log(`RELEASE_DIR=${releaseRoot}`);
} finally {
  await fs.writeFile(desktopPackagePath, `${JSON.stringify(desktopPackage, null, 2)}\n`, "utf8");
}
