# `cdnup`

Check for outdated imports from CDNs in your project.

It works by requesting every URL without version and expects a redirect to the latest version.

## Synopsis

```sh
deno run --allow-read --allow-net [--allow-write] \
    https://deno.land/x/cdnup/mod.ts [OPTION]... [DIRECTORY]
```

## Options

- `-h`, `--help`

  Print this help message and exit.

- `-i`, `--interactive`

  Run in interactive mode. Ask for confirmation before updating each import.

- `-v`, `--verbose`

  Print debug information.

- `-w`, `--write`

  Write the latest found versions to the files.

- `-u`, `--max-update RELEASE`

  Try to find updates up to the specified release type.
  This doesn't work for all CDNs.
  Possible values are: patch, minor, major.
  Default: major.

## Example

```sh
deno run --allow-read --allow-net https://deno.land/x/cdnup/mod.ts
```

```txt
checkUpdate.ts:0        https://deno.land/std/semver/format.ts  0.218.2 -> 0.220.1 (major)
checkUpdate.ts:1        https://deno.land/std/semver/less_or_equal.ts   0.218.2 -> 0.220.1 (major)
checkUpdate.ts:2        https://deno.land/std/semver/parse.ts   0.218.2 -> 0.220.1 (major)
checkUpdate.ts:3        https://deno.land/std/log/error.ts      0.219.1 -> 0.220.1 (major)
checkUpdate.ts:4        https://deno.land/std/log/mod.ts        0.219.1 -> 0.220.1 (major)
listUpdates.ts:0        https://deno.land/std/fs/walk.ts        0.219.1 -> 0.220.1 (major)
listUpdates.ts:1        https://deno.land/std/log/info.ts       0.219.1 -> 0.220.1 (major)
```
