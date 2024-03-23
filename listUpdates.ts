import { walk } from "https://deno.land/std@0.219.1/fs/walk.ts";
import { info } from "https://deno.land/std@0.219.1/log/info.ts";
import { AsyncIterableX } from "https://esm.sh/ix@5.0.0/asynciterable/asynciterablex?dev";
import { flatMap } from "https://esm.sh/ix@5.0.0/asynciterable/operators/flatmap?dev";
import { tap } from "https://esm.sh/ix@5.0.0/asynciterable/operators/tap?dev";
import { LinesAndColumns } from "https://esm.sh/lines-and-columns@2.0.4";
import { checkUpdate, RELEASE_TYPES } from "./checkUpdate.ts";

const urlRegexp = /\bhttps?:\/\/[\w\d.-]+\/[\w\d!#%&*?@^<=>/[\]:.~+-]+/dgi;

export async function* updateDir(
  rootPath: string,
  maxRelease: (typeof RELEASE_TYPES)[number],
) {
  const walker = walk(rootPath, {
    includeDirs: false,
    exts: ["html", "css", "js", "jsx", "ts", "tsx", "json"],
  });
  yield* AsyncIterableX.from(
    walker,
  )
    .pipe(tap((entry) => info(`Checking file ${entry.path}`)))
    .pipe(flatMap((entry) => updateFile(entry.path, maxRelease)));
}

async function* updateFile(
  filePath: string,
  maxRelease: (typeof RELEASE_TYPES)[number],
) {
  const fileText = await Deno.readTextFile(filePath);
  const lines = new LinesAndColumns(fileText);
  const urlMatches = fileText.matchAll(urlRegexp);

  yield* AsyncIterableX.from(urlMatches)
    .pipe(flatMap(async function* (urlMatch) {
      const [url] = urlMatch;
      info(`Checking url ${url}`);
      const update = await checkUpdate(url, maxRelease);
      if (update) {
        const [startIndex, endIndex] = urlMatch.indices![0]!;
        const start = lines.locationForIndex(startIndex);
        const end = lines.locationForIndex(endIndex);
        yield { filePath, startIndex, endIndex, start, end, ...update };
      }
    }));
}
