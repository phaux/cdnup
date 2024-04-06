import { walk } from "https://deno.land/std@0.221.0/fs/walk.ts";
import { error } from "https://deno.land/std@0.221.0/log/error.ts";
import { info } from "https://deno.land/std@0.221.0/log/info.ts";
import { AsyncIterableX } from "https://esm.sh/ix@5.0.0/asynciterable/asynciterablex";
import { flatMap } from "https://esm.sh/ix@5.0.0/asynciterable/operators/flatmap";
import { tap } from "https://esm.sh/ix@5.0.0/asynciterable/operators/tap";
import {
  LinesAndColumns,
  SourceLocation,
} from "https://esm.sh/lines-and-columns@2.0.4";
import { CdnUpdate, checkCdnUpdate, RELEASE_TYPES } from "./checkCdnUpdate.ts";

const urlRegexp = /\bhttps?:\/\/[\w\d.-]+\/[\w\d!#%&*?@^<=>/[\]:.~+-]+/dgi;
export const defaultExtensions = [
  "html",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "json",
];
export const defaultIgnorePatterns = [/^node_modules$/, /^\.git$/];

export interface UpdateEntry {
  update: CdnUpdate;
  filePath: string;
  startIndex: number;
  endIndex: number;
  start: SourceLocation;
}

export interface ListUpdatesOptions {
  maxUpdate?: (typeof RELEASE_TYPES)[number] | undefined;
  extensions?: string[] | undefined;
  ignorePatterns?: RegExp[] | undefined;
}

export async function* listUpdates(
  paths: string[],
  options?: ListUpdatesOptions,
) {
  yield* AsyncIterableX.from(paths)
    .pipe(flatMap(async function* (path) {
      const stat = await Deno.stat(path);
      if (stat.isDirectory) {
        yield* listDirUpdates(path, options);
      } else if (stat.isFile) {
        yield* listFileUpdates(path, options?.maxUpdate);
      } else {
        error(`Skipping ${path}`);
      }
    }));
}

export async function* listDirUpdates(
  rootPath: string,
  options?: ListUpdatesOptions,
): AsyncGenerator<UpdateEntry, void, undefined> {
  const walker = walk(rootPath, {
    includeDirs: false,
    exts: [...defaultExtensions, ...options?.extensions ?? []],
    skip: [...defaultIgnorePatterns, ...options?.ignorePatterns ?? []],
  });
  yield* AsyncIterableX.from(walker)
    .pipe(tap((entry) => info(`Checking file ${entry.path}`)))
    .pipe(flatMap((entry) => listFileUpdates(entry.path, options?.maxUpdate)));
}

export async function* listFileUpdates(
  filePath: string,
  maxUpdate: (typeof RELEASE_TYPES)[number] = "major",
): AsyncGenerator<UpdateEntry, void, undefined> {
  const fileText = await Deno.readTextFile(filePath);
  const lines = new LinesAndColumns(fileText);
  const urlMatches = fileText.matchAll(urlRegexp);

  yield* AsyncIterableX.from(urlMatches)
    .pipe(flatMap(async function* (urlMatch) {
      const [url] = urlMatch;
      info(`Checking url ${url}`);
      const update = await checkCdnUpdate(url, maxUpdate);
      if (update) {
        const [startIndex, endIndex] = urlMatch.indices![0]!;
        const start = lines.locationForIndex(startIndex)!;
        yield { filePath, startIndex, endIndex, start, update };
      }
    }));
}
