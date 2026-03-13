let counter = 1;

export function createId(prefix: string) {
  const id = `${prefix}-${counter}`;
  counter += 1;
  return id;
}
