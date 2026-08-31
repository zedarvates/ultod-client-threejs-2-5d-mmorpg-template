const TEXT_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

const ATTRIBUTE_ENTITIES: Record<string, string> = {
  ...TEXT_ENTITIES,
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtmlText(value: string): string {
  return value.replace(/[&<>]/g, (character) => TEXT_ENTITIES[character]!);
}

export function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ATTRIBUTE_ENTITIES[character]!);
}
