export function cn(
  ...values: Array<string | false | null | undefined | Record<string, boolean>>
): string {
  const tokens: string[] = [];

  values.forEach((value) => {
    if (!value) return;

    if (typeof value === "string") {
      tokens.push(value);
      return;
    }

    Object.entries(value).forEach(([key, condition]) => {
      if (condition) tokens.push(key);
    });
  });

  return tokens.join(" ");
}

export const isBrowser = typeof window !== "undefined";

