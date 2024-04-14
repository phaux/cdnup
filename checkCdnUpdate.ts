import { info } from "https://deno.land/std@0.222.1/log/info.ts";
import memoize from "https://esm.sh/memoizee@0.4.15";
import { match } from "https://esm.sh/ts-pattern@5.1.1";

export const RELEASE_TYPES = ["patch", "minor", "major"] as const;

export const versionRegexp =
  /@(?<op>\^|~|<=?|==?)?(?<v>v)?(?<v1>\d+|[*x])(?:\.(?<v2>\d+|[*x]))?(?:\.(?<v3>\d+|[*x]))?(?:-(?<pre>[\w\d_.+-]+))?(?=\W|$)/di;

export interface CdnUpdate {
  currentUrl: string;
  currentVersion: CdnVersion;
  baseUrl: string;
  latestUrl: string;
  latestVersion: CdnVersion;
  release: typeof RELEASE_TYPES[number];
}

export interface CheckUpdateOptions {
  maxUpdate?: (typeof RELEASE_TYPES)[number] | undefined;
  fetch?: typeof fetch | undefined;
}

export const checkCdnUpdateMemoized = memoize(
  checkCdnUpdate,
  {
    promise: true,
    normalizer: (args) => JSON.stringify(args),
  },
);

/**
 * Check if a CDN URL can be updated to a newer version.
 *
 * @returns Update info or null if the latest version is the same as current version.
 * @throws when fetching the update fails or the response is not correct.
 */
export async function checkCdnUpdate(
  url: string,
  options?: CheckUpdateOptions,
): Promise<CdnUpdate | null> {
  const currentUrl = new URL(url);
  const maxUpdate = options?.maxUpdate ?? "major";

  // parse current version from url
  const currentVersion = parseCdnVersion(currentUrl.href);
  if (currentVersion == null) {
    throw new Error(`No version in ${currentUrl}`);
  }

  // check if current version doesn't already allow any possible update
  if (currentVersion.major == null) {
    throw new Error(`No major version in ${currentVersion.match}`);
  }
  if (currentVersion.minor == null && maxUpdate !== "major") {
    throw new Error(
      `No minor version in ${currentVersion.match} and max update is not major`,
    );
  }
  if (currentVersion.patch == null && maxUpdate === "patch") {
    throw new Error(
      `No patch version in ${currentVersion.match} and max update is patch`,
    );
  }

  // get base url which should redirect to latest version
  const baseVersion = match(maxUpdate)
    .with("major", () => "")
    .with("minor", () => `@${currentVersion.prefix}${currentVersion.major}`)
    .with(
      "patch",
      () =>
        `@${currentVersion.prefix}${currentVersion.major}.${currentVersion.minor}`,
    )
    .exhaustive();
  const baseUrl = new URL(
    currentUrl.href.substring(0, currentVersion.index.start) +
      baseVersion +
      currentUrl.href.substring(currentVersion.index.end),
  );

  // fetch base url and look for redirect
  const localFetch = options?.fetch ?? globalThis.fetch;
  let response;
  try {
    info(`Fetching ${baseUrl}`);
    response = await localFetch(baseUrl, { method: "HEAD" });
  } catch (error) {
    throw new Error(`Fetching ${baseUrl} failed: ${error}`);
  }
  if (!response.ok) {
    throw new Error(
      `Fetching ${baseUrl} failed: ${response.status} ${response.statusText}`,
    );
  }
  const latestUrl = new URL(response.url);
  if (!latestUrl.search) latestUrl.search = currentUrl.search;
  if (!latestUrl.hash) latestUrl.hash = currentUrl.hash;
  if (latestUrl.href === baseUrl.href) {
    throw new Error(`No redirect for ${baseUrl}`);
  }

  // parse latest version from redirect url
  const latestVersion = parseCdnVersion(latestUrl.href);
  if (latestVersion == null) {
    throw new Error(`No version in latest URL ${latestUrl}`);
  }

  // check if latest version is an exact version
  if (
    latestVersion.major == null ||
    latestVersion.minor == null ||
    latestVersion.patch == null
  ) {
    throw new Error(
      `Latest version ${latestVersion.match} is not an exact version`,
    );
  }

  // abort if latest version is lower or equal to current version
  if (
    (latestVersion.major < currentVersion.major) ||
    (latestVersion.major === currentVersion.major &&
      currentVersion.minor != null &&
      latestVersion.minor < currentVersion.minor) ||
    (latestVersion.major === currentVersion.major &&
      latestVersion.minor === currentVersion.minor &&
      currentVersion.patch != null &&
      latestVersion.patch < currentVersion.patch)
  ) {
    throw new Error(
      `Latest version ${latestVersion.match} is lower than current version ${currentVersion.match}`,
    );
  }

  // compare versions to get release type
  let release: typeof RELEASE_TYPES[number];
  if (currentVersion.major !== latestVersion.major) release = "major";
  else if (currentVersion.minor !== latestVersion.minor) {
    if (currentVersion.major === 0) {
      release = "major";
    } else {
      release = "minor";
    }
  } else if (currentVersion.patch !== latestVersion.patch) {
    if (currentVersion.major === 0 && currentVersion.minor === 0) {
      release = "major";
    } else if (currentVersion.major === 0) {
      release = "minor";
    } else {
      release = "patch";
    }
  } else {
    return null;
  }

  // return update info
  return {
    baseUrl: baseUrl.href,
    currentUrl: currentUrl.href,
    latestUrl: latestUrl.href,
    currentVersion,
    latestVersion,
    release,
  };
}

export interface CdnVersion {
  prefix: string;
  major: number | null;
  minor: number | null;
  patch: number | null;
  prerelease: string | null;
  index: { start: number; end: number };
  match: string;
}

export function parseCdnVersion(url: string): CdnVersion | null {
  const match = url.match(versionRegexp);
  if (match == null) return null;
  const prefix = (match.groups!.op ?? "") + (match.groups!.v ?? "");
  const major = parseInt(match.groups!.v1!, 10);
  const minor = parseInt(match.groups!.v2 ?? "", 10);
  const patch = parseInt(match.groups!.v3 ?? "", 10);
  const pre = match.groups!.pre;
  return {
    prefix,
    major: Number.isNaN(major) ? null : major,
    minor: Number.isNaN(minor) ? null : minor,
    patch: Number.isNaN(patch) ? null : patch,
    prerelease: pre ?? null,
    index: {
      start: match.index!,
      end: match.index! + match[0].length,
    },
    match: match[0],
  };
}
