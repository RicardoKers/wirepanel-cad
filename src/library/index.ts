import type { AppLibraryComponentFile, LibraryComponent } from "../models";
import { isAppLibraryComponentFile, toLibraryComponent } from "../utils/components";

const modules = import.meta.glob("./components/*.wpm", {
  eager: true,
  query: "?raw",
  import: "default"
}) as Record<string, string>;

export const builtInComponents: LibraryComponent[] = Object.entries(modules)
  .map(([path, fileContent]) => {
    let file: unknown;
    try {
      file = JSON.parse(fileContent) as AppLibraryComponentFile;
    } catch {
      console.warn(`Ignoring invalid app library component file: ${path}`);
      return null;
    }
    if (!isAppLibraryComponentFile(file)) {
      console.warn(`Ignoring invalid app library component file: ${path}`);
      return null;
    }
    const fileName = path.split("/").pop();
    return toLibraryComponent(file, { fileName, source: "app" });
  })
  .filter((value): value is LibraryComponent => Boolean(value))
  .sort((a, b) => {
    const categoryCompare = a.category.localeCompare(b.category);
    if (categoryCompare !== 0) return categoryCompare;
    return a.name.localeCompare(b.name);
  });
