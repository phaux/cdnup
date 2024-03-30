import { walk } from "https://deno.land/std@0.220.1/fs/walk.ts";
import { info } from "https://deno.land/std@0.220.1/log/info.ts";
import { AsyncIterableX } from "https://esm.sh/ix@5.0.0/asynciterable/asynciterablex";
import { flatMap } from "https://esm.sh/ix@5.0.0/asynciterable/operators/flatmap";
import { tap } from "https://esm.sh/ix@5.0.0/asynciterable/operators/tap";
import {
  LinesAndColumns,
  SourceLocation,
} from "https://esm.sh/lines-and-columns@2.0.4";
import { CdnUpdate, checkCdnUpdate, RELEASE_TYPES } from "./checkCdnUpdate.ts";

const urlRegexp = /\bhttps?:\/\/[\w\d.-]+\/[\w\d!#%&*?@^<=>/[\]:.~+-]+/dgi;

export interface UpdateEntry {
  update: CdnUpdate;
  filePath: string;
  startIndex: number;
  endIndex: number;
  start: SourceLocation;
  end: SourceLocation;
}

export async function* listDirUpdates(
  rootPath: string,
  maxRelease: (typeof RELEASE_TYPES)[number],
): AsyncGenerator<UpdateEntry, void, undefined> {
  const walker = walk(rootPath, {
    includeDirs: false,
    exts: ["html", "css", "js", "jsx", "ts", "tsx", "json"],
  });
  yield* AsyncIterableX.from(walker)
    .pipe(tap((entry) => info(`Checking file ${entry.path}`)))
    .pipe(flatMap((entry) => listFileUpdates(entry.path, maxRelease)));
}

export async function* listFileUpdates(
  filePath: string,
  maxRelease: (typeof RELEASE_TYPES)[number],
): AsyncGenerator<UpdateEntry, void, undefined> {
  const fileText = await Deno.readTextFile(filePath);
  const lines = new LinesAndColumns(fileText);
  const urlMatches = fileText.matchAll(urlRegexp);

  yield* AsyncIterableX.from(urlMatches)
    .pipe(flatMap(async function* (urlMatch) {
      const [url] = urlMatch;
      info(`Checking url ${url}`);
      const update = await checkCdnUpdate(url, maxRelease);
      if (update) {
        const [startIndex, endIndex] = urlMatch.indices![0]!;
        const start = lines.locationForIndex(startIndex)!;
        const end = lines.locationForIndex(endIndex)!;
        yield { filePath, startIndex, endIndex, start, end, update };
      }
    }));
}
