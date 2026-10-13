import { cp, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { contentDirectory, repositoryRoot } from "../catalog-content.mjs";

/** All mutable server paths belong to a disposable directory; source copies are read-only inputs. */
export async function createServerFixture({
  seedDocumentation = true,
  productionBuild = false,
} = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "atlas-server-fixture-")));
  const options = {
    distDirectory: join(root, "dist"),
    packagesDirectory: join(root, "packages"),
    guideLibraryDirectory: join(root, "guide-library"),
    catalogDirectory: join(root, "catalog"),
    documentationDirectory: join(root, "docs"),
    stateDirectory: join(root, "state"),
    catalogOutputs: {
      generatedPath: join(root, "generated", "catalog.ts"),
      indexPath: join(root, "feed", "index.json"),
      toolsPath: join(root, "feed", "tools.json"),
    },
  };
  const cleanup = () => rm(root, { recursive: true, force: true });
  try {
    await cp(contentDirectory, options.catalogDirectory, { recursive: true });
    for (const directory of [
      options.distDirectory,
      options.packagesDirectory,
      options.guideLibraryDirectory,
      options.documentationDirectory,
      options.stateDirectory,
      join(root, "generated"),
      join(root, "feed"),
    ])
      await mkdir(directory, { recursive: true });
    if (seedDocumentation)
      await cp(join(repositoryRoot, "docs"), options.documentationDirectory, { recursive: true });
    if (productionBuild)
      await cp(join(repositoryRoot, "dist"), options.distDirectory, { recursive: true });
    else await writeFile(join(options.distDirectory, "index.html"), '<div id="root"></div>');
    return { root, options, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
