import { parseArgs } from "https://deno.land/std@0.220.1/cli/parse_args.ts";
import { bold, underline } from "https://deno.land/std@0.220.1/fmt/colors.ts";
import { setup } from "https://deno.land/std@0.220.1/log/setup.ts";
import { z } from "https://esm.sh/zod@3.22.4";
import { CdnUpdate, checkCdnUpdate, RELEASE_TYPES } from "./checkCdnUpdate.ts";
import { listDirUpdates, listFileUpdates, UpdateEntry } from "./listUpdates.ts";
import { writeUpdates } from "./writeUpdates.ts";

// deno-fmt-ignore
const helpText = `
${bold(`NAME`)}
  cdnup - Check for outdated imports from CDNs in your project

${bold(`SYNOPSIS`)}
  ${bold(`deno`)} run ${underline(`--allow-read`)} ${underline(`--allow-net`)} [${underline(`--allow-write`)}] \\
    ${bold(`https://deno.land/x/cdnup/mod.ts`)} [${underline(`OPTION`)}]... [${underline(`DIRECTORY`)}]

${bold(`OPTIONS`)}
  ${bold(`-h`)}, ${bold(`--help`)}
    Print this help message and exit.

  ${bold(`-v`)}, ${bold(`--verbose`)}
    Print debug information.

  ${bold(`-w`)}, ${bold(`--write`)}
    Write the latest found versions to the files.

  ${bold(`-i`)}, ${bold(`--interactive`)}
    Run in interactive mode. Ask for confirmation before writing each change.

  ${bold(`-u`)}, ${bold(`--max-update`)} ${underline(`RELEASE`)}
    Try to find updates up to the specified release type.
    This doesn't work for all CDNs.
    Possible values are: ${RELEASE_TYPES.join(", ")}.
    Default: major (just request the latest version).
`;

if (import.meta.main) {
  const options = parseArgs(Deno.args, {
    boolean: ["help", "interactive", "verbose", "write"],
    string: ["filterRelease", "maxUpdate"],
    alias: {
      help: ["h"],
      interactive: ["i"],
      verbose: ["v"],
      write: ["w"],
      maxUpdate: ["max-update", "u"],
    },
  });

  const maxUpdate = z.enum(RELEASE_TYPES).optional().parse(options.maxUpdate);

  setup({
    loggers: {
      default: {
        level: options.verbose ? "INFO" : "ERROR",
        handlers: ["default"],
      },
    },
  });

  if (options.help) {
    console.log(helpText);
  } else {
    const updates = await Array.fromAsync(listDirUpdates(
      String(options._[0] ?? "."),
      maxUpdate ?? "major",
    ));
    await writeUpdates(updates, options);
  }
}

export {
  type CdnUpdate,
  checkCdnUpdate,
  listDirUpdates,
  listFileUpdates,
  type UpdateEntry,
  writeUpdates,
};
