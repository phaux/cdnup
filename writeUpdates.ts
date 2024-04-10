import { sortBy } from "https://deno.land/std@0.221.0/collections/sort_by.ts";
import { info } from "https://deno.land/std@0.221.0/log/info.ts";
import MagicString from "https://esm.sh/magic-string@0.30.8";
import { Update } from "./listUpdates.ts";

export async function writeUpdates(
  updates: Iterable<Update>,
  options: {
    write: boolean;
    interactive: boolean;
  },
) {
  const updatesArray = Array.from(updates);
  const sortedUpdates = Map.groupBy(
    sortBy(
      updatesArray,
      (update) =>
        `${update.filePath}:${update.index.start.toFixed(0).padStart(9, "0")}`,
    ),
    (update) => update.filePath,
  );

  info(
    `Found ${updatesArray.length} updates in ${sortedUpdates.size} files.`,
  );

  for (const [filePath, fileUpdates] of sortedUpdates.entries()) {
    if (!fileUpdates?.length) continue;

    const fileText = new MagicString(
      options.write ? await Deno.readTextFile(filePath) : "",
    );

    for (const update of fileUpdates) {
      const message = `${update.filePath}:${update.location.line}\t` +
        `${update.update.baseUrl}\t` +
        `${update.update.currentVersion.major}.${update.update.currentVersion.minor}.${update.update.currentVersion.patch} -> ` +
        `${update.update.latestVersion.major}.${update.update.latestVersion.minor}.${update.update.latestVersion.patch} ` +
        `(${update.update.release})`;

      let write;
      if (options.write && options.interactive) {
        write = confirm(message);
      } else {
        console.log(message);
        write = options.write;
      }

      if (write) {
        fileText.update(
          update.index.start,
          update.index.end,
          update.update.latestUrl,
        );
      }
    }

    if (options.write) {
      await Deno.writeTextFile(filePath, fileText.toString());
    }
  }
}
