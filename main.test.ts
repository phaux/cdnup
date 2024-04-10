import { assertEquals } from "https://deno.land/std@0.221.0/assert/assert_equals.ts";
import { copy } from "https://deno.land/std@0.221.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.221.0/path/join.ts";
import { assertSnapshot } from "https://deno.land/std@0.221.0/testing/snapshot.ts";
import { createFakeFetch, createStaticUrlHandler } from "./createFakeFetch.ts";
import { runCdnUp } from "./main.ts";

type DirContent = string[] | { [name: string]: DirContent };

async function getDirContent(path: string): Promise<DirContent> {
  const entries: Record<string, DirContent> = {};
  for await (const entry of Deno.readDir(path)) {
    if (entry.isDirectory) {
      entries[entry.name] = await getDirContent(join(path, entry.name));
    } else {
      entries[entry.name] = await Deno.readTextFile(join(path, entry.name))
        .then((content) => content.trimEnd().split(/\r?\n/));
    }
  }
  return entries;
}

const fixturesDir = join(import.meta.dirname!, "fixtures");

async function testFixture(
  args: string[],
  ...redirects: Parameters<typeof createStaticUrlHandler>
) {
  const currentDir = Deno.cwd();
  const tempDir = await Deno.makeTempDir();
  try {
    Deno.chdir(tempDir);
    await copy(fixturesDir, tempDir, { overwrite: true });
    const fetch = createFakeFetch(createStaticUrlHandler(...redirects));
    const errors = new Set();
    const result = await runCdnUp(args, {
      fetch,
      onError: (filePath, url, error) => {
        errors.add({ filePath, url, error: error.message });
      },
    });
    const content = await getDirContent(tempDir);
    return { result, content, errors };
  } finally {
    Deno.chdir(currentDir);
    await Deno.remove(tempDir, { recursive: true });
  }
}

const redirects = {
  "https://libs.example.com/react": () =>
    Response.redirect("https://libs.example.com/react@19.1.1"),
  "https://libs.example.com/react@19.1.1": () => Response.json({}),

  "https://libs.example.com/preact": () =>
    Response.redirect("https://libs.example.com/preact@10.10.10"),
  "https://libs.example.com/preact@10.10.10": () => Response.json({}),

  "https://libs.example.com/lib/mod.js": () =>
    Response.redirect("https://libs.example.com/lib@3.2.1/mod.js"),
  "https://libs.example.com/lib@3.2.1/mod.js": () => Response.json({}),

  "https://libs.example.com/jquery/dist/jquery.min.js": () =>
    Response.redirect(
      "https://libs.example.com/jquery@3.6.0/dist/jquery.min.js",
    ),
  "https://libs.example.com/jquery@3.6.0/dist/jquery.min.js": () =>
    Response.json({}),

  "https://libs.example.com/bootstrap/dist/bootstrap.min.css": () =>
    Response.redirect(
      "https://libs.example.com/bootstrap@5.0.0/bootstrap.min.css",
    ),
  "https://libs.example.com/bootstrap@5.0.0/bootstrap.min.css": () =>
    Response.json({}),

  "https://deno.land/x/example/mod.ts": () =>
    Response.redirect("https://deno.land/x/example@v2.0.0/mod.ts"),
  "https://deno.land/x/example@v2.0.0/mod.ts": () => Response.json({}),
};

const sourceContent = await getDirContent(fixturesDir);

Deno.test("finds updates", async (t) => {
  const { content, result, errors } = await testFixture([], redirects);
  assertEquals(content, sourceContent);
  await assertSnapshot(t, { result, errors });
});

Deno.test("writes updates", async (t) => {
  const output = await testFixture(["-w"], redirects);
  assertEquals(await testFixture(["--write"], redirects), output);
  await assertSnapshot(t, output);
});

Deno.test("finds updates in single dir", async (t) => {
  const { content, result, errors } = await testFixture(["src"], redirects);
  assertEquals(content, sourceContent);
  await assertSnapshot(t, { result, errors });
});

Deno.test("writes updates in single dir", async (t) => {
  const output = await testFixture(["-w", "static"], redirects);
  assertEquals(await testFixture(["--write", "static"], redirects), output);
  assertEquals(await testFixture(["static", "-w"], redirects), output);
  assertEquals(await testFixture(["static", "--write"], redirects), output);
  await assertSnapshot(t, output);
});

Deno.test("find updates in single file", async (t) => {
  {
    const { content, result, errors } = await testFixture(
      ["static/page.html"],
      redirects,
    );
    assertEquals(content, sourceContent);
    await assertSnapshot(t, { result, errors });
  }
  {
    const { content, result, errors } = await testFixture(
      ["help.txt"],
      redirects,
    );
    assertEquals(content, sourceContent);
    await assertSnapshot(t, { result, errors });
  }
});

Deno.test("writes updates in single file", async (t) => {
  const output = await testFixture(["-w", "src/foo.js"], redirects);
  assertEquals(await testFixture(["--write", "src/foo.js"], redirects), output);
  assertEquals(await testFixture(["src/foo.js", "-w"], redirects), output);
  assertEquals(await testFixture(["src/foo.js", "--write"], redirects), output);
  await assertSnapshot(t, output);
});

Deno.test("finds updates in multiple dirs", async (t) => {
  const { content, result, errors } = await testFixture(
    ["src", "static"],
    redirects,
  );
  assertEquals(content, sourceContent);
  await assertSnapshot(t, { result, errors });
});

Deno.test("writes updates in multiple dirs", async (t) => {
  await assertSnapshot(
    t,
    await testFixture(["-w", "src", "static"], redirects),
  );
});

Deno.test("finds updates in multiple files", async (t) => {
  const { content, result, errors } = await testFixture([
    "src/foo.js",
    "static/page.html",
  ], redirects);
  assertEquals(content, sourceContent);
  await assertSnapshot(t, { result, errors });
});

Deno.test("writes updates in multiple files", async (t) => {
  await assertSnapshot(
    t,
    await testFixture(["-w", "src/foo.js", "static/page.html"], redirects),
  );
});

Deno.test("writes updates with additional extensions specified", async (t) => {
  const output = await testFixture(["-w", "--ext", "md,txt"], redirects);
  assertEquals(
    await testFixture(["-w", "--ext", ".md,.txt"], redirects),
    output,
  );
  assertEquals(
    await testFixture(["-w", "--ext", "md", "--ext", "txt"], redirects),
    output,
  );
  assertEquals(
    await testFixture(["-w", "--ext", ".md", "--ext", ".txt"], redirects),
    output,
  );
  assertEquals(
    await testFixture(["-w", "-e", "md,txt"], redirects),
    output,
  );
  assertEquals(
    await testFixture(["-w", "-e", ".md,.txt"], redirects),
    output,
  );
  assertEquals(
    await testFixture(["-w", "-e", "md", "-e", "txt"], redirects),
    output,
  );
  assertEquals(
    await testFixture(["-w", "-e", ".md", "-e", ".txt"], redirects),
    output,
  );
  await assertSnapshot(t, output);
});

Deno.test("writes updates with skip patterns specified", async (t) => {
  {
    const output = await testFixture([
      "-w",
      "--skip",
      "**/*.js",
      "--skip",
      "**/*.ts",
    ], redirects);
    await assertSnapshot(t, output);
  }
  {
    const output = await testFixture(
      ["-w", "-s", "**/static"],
      redirects,
    );
    assertEquals(
      await testFixture(["-w", "-s", "**/static/**"], redirects),
      output,
    );
    await assertSnapshot(t, output);
  }
});
