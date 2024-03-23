import { format } from "https://deno.land/std@0.218.2/semver/format.ts";
import { lessOrEqual } from "https://deno.land/std@0.218.2/semver/less_or_equal.ts";
import { parse } from "https://deno.land/std@0.218.2/semver/parse.ts";
import { error } from "https://deno.land/std@0.219.1/log/error.ts";
import { info, warn } from "https://deno.land/std@0.219.1/log/mod.ts";
import memoize from "https://esm.sh/memoizee@0.4.15";
import tryCatch from "https://esm.sh/ramda@0.29.1/src/tryCatch";
import { match } from "https://esm.sh/ts-pattern@5.0.8";

export const RELEASE_TYPES = ["patch", "minor", "major"] as const;

const versionRegexp =
  /@(?<range>(?:\^|~|<=?|==?)?v?(?<version>(?:\d+|[*x])(?:\.(?:\d+|[*x])){0,2}(?:-[\w\d_.+-]+)?))(?=\W|$)/di;

export const checkUpdate = memoize(
  async function checkUpdate(
    url: string,
    maxRelease: (typeof RELEASE_TYPES)[number],
  ) {
    // parse current version from url
    const versionMatch = url.match(versionRegexp);
    if (versionMatch?.groups?.version == null) return null;
    const version = tryCatch(
      parse,
      (error) => void warn(`Parsing version for ${url} failed: ${error}`),
    )(versionMatch.groups.version);
    if (version == null) return null;

    // get base url which should redirect to latest version
    const baseVersion = match(maxRelease)
      .with("major", () => "")
      .with("minor", () => `@${version.major}`)
      .with("patch", () => `@${version.major}.${version.minor}`)
      .exhaustive();
    const baseUrl = url.substring(0, versionMatch.indices![0]![0]) +
      baseVersion +
      url.substring(versionMatch.indices![0]![1]);

    // fetch base url and get latest version
    const response = await fetch(baseUrl, { method: "HEAD" });
    if (!response.ok) {
      error(
        `Fetching ${baseUrl} failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }
    const latestUrl = new URL(response.url, baseUrl).href;
    if (latestUrl === baseUrl) {
      warn(`No redirect for ${baseUrl}`);
      return null;
    }
    if (latestUrl === url) return null;
    const latestVersionMatch = latestUrl.match(versionRegexp);
    if (latestVersionMatch?.groups?.version == null) {
      warn(`No version in ${latestUrl}`);
      return null;
    }
    const latestVersion = tryCatch(
      parse,
      (error) =>
        void warn(`Parsing latest version for ${latestUrl} failed: ${error}`),
    )(latestVersionMatch.groups.version);
    if (latestVersion == null) return null;

    // compare versions and get release type
    if (lessOrEqual(latestVersion, version)) return null;
    let release;
    if (version.major !== latestVersion.major) release = "major";
    else if (version.minor !== latestVersion.minor) {
      if (version.major === 0) release = "major";
      else release = "minor";
    } else if (version.patch !== latestVersion.patch) {
      if (version.major === 0 && version.minor === 0) release = "major";
      else if (version.major === 0) release = "minor";
      else release = "patch";
    }
    if (release == null) return null;

    // log and return update info
    info(
      `Found update for ${baseUrl}: ${format(version)} -> ${
        format(latestVersion)
      } (${release})`,
    );
    return { baseUrl, url, latestUrl, version, latestVersion, release };
  },
  { promise: true },
);
