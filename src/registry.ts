const collected = new Set<string>();

export function registerStyle(absolutePath: string): void {
  collected.add(absolutePath);
}

export function getCollectedStyles(): string[] {
  return [...collected];
}

export function clearCollectedStyles(): void {
  collected.clear();
}
