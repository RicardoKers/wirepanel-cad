import type { AppLibraryComponentFile, LibraryComponent } from "../models";
import { isAppLibraryComponentFile, toLibraryComponent } from "../utils/components";

const modules = import.meta.glob("./components/*.json", { eager: true }) as Record<string, { default: AppLibraryComponentFile } | AppLibraryComponentFile>;

export const builtInComponents: LibraryComponent[] = Object.entries(modules)
  .map(([path, moduleValue]) => {
    const file = "default" in moduleValue ? moduleValue.default : moduleValue;
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