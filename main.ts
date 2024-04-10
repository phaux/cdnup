import { parseArgs } from "https://deno.land/std@0.221.0/cli/parse_args.ts";
import { bold, underline } from "https://deno.land/std@0.221.0/fmt/colors.ts";
import { error } from "https://deno.land/std@0.221.0/log/error.ts";
import { setup } from "https://deno.land/std@0.221.0/log/setup.ts";
import { globToRegExp } from "https://deno.land/std@0.221.0/path/glob_to_regexp.ts";
import { z } from "https://esm.sh/zod@3.22.4";
import { RELEASE_TYPES } from "./checkCdnUpdate.ts";
import {
  defaultExtensions,
  defaultIgnorePatterns,
  ListDirUpdatesOptions,
  listUpdates,
} from "./listUpdates.ts";
import { writeUpdates } from "./writeUpdates.ts";

// deno-fmt-ignore
const helpText = `
${bold(`NAME`)}
  cdnup - Check for outdated imports from CDNs in your project

${bold(`SYNOPSIS`)}
  ${bold(`deno`)} run ${bold(`https://deno.land/x/cdnup/main.ts`)} [${underline(`OPTION`)}]... [${underline(`PATH`)}]...

${bold(`DESCRIPTION`)}
  Checks every file in ${underline(`PATH`)} for outdated imports from CDNs.
  If ${underline(`PATH`)} is a directory, it will be walked recursively.
  When not specified, the current directory is checked recursively.

${bold(`OPTIONS`)}
  ${bold(`-h`)}, ${bold(`--help`)}
    Print this help message and exit.

  ${bold(`-v`)}, ${bold(`--verbose`)}
    Print debug information.

  ${bold(`-w`)}, ${bold(`--write`)}
    Write the latest found versions to the files.

  ${bold(`-i`)}, ${bold(`--interactive`)}
    Run in interactive mode. Ask for confirmation before writing each change.

  ${bold(`-e`)} ${underline(`EXT`)}, ${bold(`--ext`)} ${underline(`EXT`)}
    Additional file extensions to check when recursively walking directories.
    Can be comma-separated or specified multiple times.
    By default, ${new Intl.ListFormat("en").format(defaultExtensions)} files are checked.
    See: https://deno.land/std@0.221.0/fs/walk.ts?s=WalkOptions#prop_exts

  ${bold(`--ignore`)} ${underline(`PATTERN`)}
    Additional paths to ignore when recursively walking directories.
    Can be specified multiple times.
    Supports glob syntax.
    By default, ${new Intl.ListFormat("en").format(defaultIgnorePatterns.map((pattern) => pattern.source.slice(1, -1)))} paths are ignored.
    See:
    https://deno.land/std@0.221.0/path/glob_to_regexp.ts?s=globToRegExp
    https://deno.land/std@0.221.0/fs/walk.ts?s=WalkOptions#prop_skip

  ${bold(`--max-update`)} ${underline(`RELEASE`)}
    Try to find updates up to the specified release type.
    This doesn't work for all CDNs.
    Possible values are: ${new Intl.ListFormat("en").format(RELEASE_TYPES)}.
    Default: major (just request the same URL but without version).
`;

if (import.meta.main) {
  await runCdnUp(Deno.args);
}

export async function runCdnUp(
  args: string[],
  overrideOptions?: Partial<ListDirUpdatesOptions>,
) {
  const options = parseArgs(args, {
    boolean: ["help", "interactive", "verbose", "write"],
    string: ["extensions", "ignorePatterns", "maxUpdate"],
    collect: ["extensions", "ignorePatterns"],
    alias: {
      help: ["h"],
      interactive: ["i"],
      verbose: ["v"],
      write: ["w"],
      extensions: ["ext", "e"],
      ignorePatterns: ["ignore"],
      maxUpdate: ["max-update", "u"],
    },
  });

  const paths = options._.map(String);
  if (paths.length === 0) paths.push(".");

  const extensions = options.extensions
    .flatMap((ext) => ext.split(","));
  const ignorePatterns = options.ignorePatterns
    .map((pattern) => globToRegExp(pattern));
  const maxUpdate = z.enum(RELEASE_TYPES).optional()
    .parse(options.maxUpdate);

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
    const updates = new Set(
      await Array.fromAsync(listUpdates(
        paths,
        {
          onError: (filePath, url, err) => {
            error(`Failed to update ${url} in ${filePath}: ${err.message}`);
          },
          memoize: true,
          maxUpdate,
          extensions,
          ignorePatterns,
          ...overrideOptions,
        },
      )),
    );
    await writeUpdates(updates, options);
    return { updates };
  }
}
