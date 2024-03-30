import { sortBy } from "https://deno.land/std@0.221.0/collections/sort_by.ts";
import { info } from "https://deno.land/std@0.221.0/log/info.ts";
import { format } from "https://deno.land/std@0.221.0/semver/format.ts";
import MagicString from "https://esm.sh/magic-string@0.30.8";
import { UpdateEntry } from "./listUpdates.ts";

export async function writeUpdates(updates: UpdateEntry[], options: {
  write: boolean;
  interactive: boolean;
}) {
  const sortedUpdates = Map.groupBy(
    sortBy(
      updates,
      (update) => `${update.filePath}:${update.start.line}`,
    ),
    (update) => update.filePath,
  );

  info(
    `Found ${updates.length} updates in ${sortedUpdates.size} files.`,
  );

  for (const [filePath, fileUpdates] of sortedUpdates.entries()) {
    if (!fileUpdates?.length) continue;

    const fileText = new MagicString(
      options.write ? await Deno.readTextFile(filePath) : "",
    );

    for (const update of fileUpdates) {
      const message =
        `${update.filePath}:${update.start.line}\t${update.update.baseUrl}\t${
          format(update.update.version)
        } -> ${format(update.update.latestVersion)} (${update.update.release})`;

      let write;
      if (options.write && options.interactive) {
        write = confirm(message);
      } else {
        console.log(message);
        write = options.write;
      }

      if (write) {
        fileText.update(
          update.startIndex,
          update.endIndex,
          update.update.latestUrl,
        );
      }
    }

    if (options.write) {
      await Deno.writeTextFile(filePath, fileText.toString());
    }
  }
}
