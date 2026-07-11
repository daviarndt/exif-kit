/**
 * Opt-in update check for `exifreg update`.
 *
 * This is the ONLY part of exifregistry that reaches the network, and only
 * when the user explicitly runs `exifreg update`. It never runs on its own,
 * keeping the "100% local" promise intact for every other command.
 */

const REGISTRY = "https://registry.npmjs.org/exifregistry/latest";

/** Fetch the latest published version from npm, or null on any failure. */
export async function fetchLatestVersion(
  timeoutMs = 5000,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(REGISTRY, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

/** Compare semver-ish versions: -1 if a<b, 0 if equal, 1 if a>b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0) ? -1 : 1;
  }
  return 0;
}
