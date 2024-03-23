import { groupBy } from "https://deno.land/std@0.202.0/collections/group_by.ts";
import { parse } from "https://deno.land/std@0.203.0/flags/mod.ts";
import { sortBy } from "https://deno.land/std@0.205.0/collections/sort_by.ts";
import { format } from "https://deno.land/std@0.218.2/semver/format.ts";
import { bold, underline } from "https://deno.land/std@0.219.1/fmt/colors.ts";
import { info } from "https://deno.land/std@0.219.1/log/info.ts";
import { setup } from "https://deno.land/std@0.219.1/log/setup.ts";
import MagicString from "https://esm.sh/magic-string@0.30.8";
import { z } from "https://esm.sh/zod@3.22.4";
import { RELEASE_TYPES } from "./checkUpdate.ts";
import { updateDir } from "./listUpdates.ts";

// fmt-ignore
const helpText = `
${bold(`NAME`)}
  cdnup - Check for outdated imports from CDNs in your project

${bold(`SYNOPSIS`)}
  ${bold(`deno`)} run ${underline(`--allow-read`)} ${
  underline(`--allow-net`)
} [${underline(`--allow-write`)}] \\
    ${bold(`https://deno.land/x/cdnup/mod.ts`)} [${underline(`OPTION`)}]... [${
  underline(`DIRECTORY`)
}]

${bold(`OPTIONS`)}
  ${bold(`-h`)}, ${bold(`--help`)}
    Print this help message and exit.
  
  ${bold(`-i`)}, ${bold(`--interactive`)}
    Run in interactive mode. Ask for confirmation before updating each import.

  ${bold(`-v`)}, ${bold(`--verbose`)}
    Print debug information.

  ${bold(`-w`)}, ${bold(`--write`)}
    Write the latest found versions to the files.

  ${bold(`-u`)}, ${bold(`--max-update`)} ${underline(`RELEASE`)}
    Try to find updates up to the specified release type.
    This doesn't work for all CDNs.
    Possible values are: ${RELEASE_TYPES.join(", ")}.
    Default: major (just request the latest version).
`;

if (import.meta.main) {
  const options = z.object({
    _: z.array(z.string()),
    help: z.boolean().optional(),
    interactive: z.boolean().optional(),
    verbose: z.boolean().optional(),
    write: z.boolean().optional(),
    maxUpdate: z.enum(RELEASE_TYPES).optional(),
  }).parse(parse(Deno.args, {
    boolean: ["help", "interactive", "verbose", "write"],
    string: ["filterRelease", "maxUpdate"],
    alias: {
      help: ["h"],
      interactive: ["i"],
      verbose: ["v"],
      write: ["w"],
      maxUpdate: ["max-update", "u"],
    },
  }));

  setup({
    loggers: {
      default: {
        level: options.verbose ? "INFO" : "ERROR",
        handlers: ["default"],
      },
    },
  });

  info(`Options: ${JSON.stringify(options)}`);

  if (options.help) {
    console.log(helpText);
  } else {
    const updates = await Array.fromAsync(updateDir(
      options._[0] ?? ".",
      options.maxUpdate ?? "major",
    ));

    const sortedUpdates = groupBy(
      sortBy(
        updates,
        (update) => `${update.filePath}:${update.start?.line}`,
      ),
      (update) => update.filePath,
    );

    info(
      `Found ${updates.length} updates in ${Object.keys(sortedUpdates)} files.`,
    );

    for (const [filePath, fileUpdates] of Object.entries(sortedUpdates)) {
      if (!fileUpdates?.length) continue;

      const fileText = new MagicString(
        options.write ? await Deno.readTextFile(filePath) : "",
      );

      for (const update of fileUpdates) {
        const message =
          `${update.filePath}:${update.start?.line}\t${update.baseUrl}\t${
            format(update.version)
          } -> ${format(update.latestVersion)} (${update.release})`;

        let write;
        if (options.interactive) {
          write = confirm(message);
        } else {
          console.log(message);
          write = options.write;
        }

        if (write) {
          fileText.update(update.startIndex, update.endIndex, update.latestUrl);
        }
      }

      if (options.write) {
        await Deno.writeTextFile(filePath, fileText.toString());
      }
    }
  }
}
