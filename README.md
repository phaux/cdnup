# `cdnup`

Check for outdated imports from CDNs in your project.

It searches for all the URLs in the project which contain `@<version>`.
It then fetches every URL and expects a redirect to the latest version.

## Synopsis

```sh
deno run https://deno.land/x/cdnup/main.ts [OPTION]... [PATH]...
```

## Description

Checks every file in `PATH` for outdated imports from CDNs.
If `PATH` is a directory, it will be walked recursively.
When not specified, the current directory is checked recursively.

## Options

- `-w`, `--write`: Write the latest found versions to the files.
- `-i`, `--interactive`: Run in interactive mode. Ask for confirmation before writing each change.
- `-e EXT`, `--ext EXT`: Additional file extensions to check when recursively walking directories.
- `--ignore PATTERN`: Additional file names to ignore when recursively walking directories.
- `--max-update RELEASE`: Try to find updates up to the specified release type.

## Example

```sh
deno run --allow-read --allow-net https://deno.land/x/cdnup/main.ts
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
