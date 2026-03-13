type PlaceholderValues = {
  project: string;
  drawing: string;
  author: string;
  page: number;
  totalPages: number;
};

const tokenMap: Record<string, keyof PlaceholderValues> = {
  "<project>": "project",
  "<drawing>": "drawing",
  "<author>": "author",
  "<page>": "page",
  "<n_pages>": "totalPages"
};

export function replacePlaceholders(text: string, values: PlaceholderValues) {
  return text.replace(/<project>|<drawing>|<author>|<page>|<n_pages>/g, (match) => {
    const key = tokenMap[match];
    const value = values[key];
    return typeof value === "number" ? String(value) : value;
  });
}
