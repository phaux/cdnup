import { walk, WalkOptions } from "https://deno.land/std@0.221.0/fs/walk.ts";
import { info } from "https://deno.land/std@0.221.0/log/info.ts";
import { AsyncIterableX } from "https://esm.sh/ix@5.0.0/asynciterable/asynciterablex";
import { flatMap } from "https://esm.sh/ix@5.0.0/asynciterable/operators/flatmap";
import {
  LinesAndColumns,
  SourceLocation,
} from "https://esm.sh/lines-and-columns@2.0.4";
import {
  CdnUpdate,
  checkCdnUpdate,
  checkCdnUpdateMemoized,
  CheckUpdateOptions,
} from "./checkCdnUpdate.ts";
import { versionRegexp } from "./checkCdnUpdate.ts";

const urlRegexp =
  /\bhttps?:\/\/[\w\d.-]+\/[\w\d!#%&*?@^<=>/[\]:.~+-]*[\w\d!#&*?@^=/[\]:~+-]/dgi;

export interface ListFileUpdatesOptions extends CheckUpdateOptions {
  blockDomains?: RegExp[] | undefined;
  memoize?: boolean | undefined;
  onError?:
    | ((filePath: string, url: string | undefined, error: Error) => void)
    | undefined;
}

export interface ListDirUpdatesOptions
  extends ListFileUpdatesOptions, WalkOptions {}

export interface Update {
  filePath: string;
  index: { start: number; end: number };
  location: SourceLocation;
  update: CdnUpdate;
}

export async function* listUpdates(
  paths: string[],
  options?: ListDirUpdatesOptions,
): AsyncGenerator<Update, void, undefined> {
  yield* AsyncIterableX.from(paths)
    .pipe(flatMap(async function* (path) {
      try {
        const stat = await Deno.stat(path);
        if (stat.isDirectory) {
          info(`Listing updates in directory ${path}`);
          yield* listDirUpdates(path, options);
        } else if (stat.isFile) {
          info(`Listing updates in file ${path}`);
          yield* listFileUpdates(path, options);
        } else {
          throw new Error(`Entry path ${path} is not a file or directory`);
        }
      } catch (err) {
        if (options?.onError) options.onError(path, undefined, err);
        else {
          throw new Error(
            `Listing updates in ${path} failed: ${err.message}`,
          );
        }
      }
    }));
}

export async function* listDirUpdates(
  dirPath: string,
  options?: ListDirUpdatesOptions,
): AsyncGenerator<Update, void, undefined> {
  const walker = walk(dirPath, {
    includeDirs: false,
    ...options,
  });
  yield* AsyncIterableX.from(walker)
    .pipe(flatMap(async function* (entry) {
      info(`Listing updates in file ${entry.path}`);
      try {
        yield* listFileUpdates(entry.path, options);
      } catch (err) {
        if (options?.onError) options.onError(entry.path, undefined, err);
        else {
          throw new Error(
            `Listing updates in file ${entry.path} failed: ${err.message}`,
          );
        }
      }
    }));
}

export async function* listFileUpdates(
  filePath: string,
  options?: ListFileUpdatesOptions,
): AsyncGenerator<Update, void, undefined> {
  const fileText = await Deno.readTextFile(filePath);
  const lines = new LinesAndColumns(fileText);
  const urlMatches = fileText.matchAll(urlRegexp);

  yield* AsyncIterableX.from(urlMatches)
    .pipe(flatMap(async function* (urlMatch) {
      const [url] = urlMatch;

      if (!url.match(versionRegexp)) return;

      try {
        const domain = new URL(url).hostname;
        if (options?.blockDomains?.some((re) => re.test(domain))) {
          return;
        }
      } catch {
        return;
      }

      info(`Checking URL ${url}`);
      let update;
      try {
        update =
          await (options?.memoize ? checkCdnUpdateMemoized : checkCdnUpdate)(
            url,
            options,
          );
      } catch (err) {
        if (options?.onError) options.onError(filePath, url, err);
        else {
          throw new Error(
            `Checking URL ${url} in ${filePath} failed: ${err.message}`,
          );
        }
      }

      if (update) {
        const [start, end] = urlMatch.indices![0]!;
        const location = lines.locationForIndex(start)!;
        yield { filePath, index: { start, end }, location, update };
      }
    }));
}
