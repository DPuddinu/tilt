export function getAllIconPaths(): string[] {
  const icons = ['music', 'office', 'programming', 'school', 'muscle', 'book'];
  return icons.map((icon) => `/icons/${icon}.svg`);
}
