import { assertSnapshot } from "https://deno.land/std@0.221.0/testing/snapshot.ts";
import { checkCdnUpdate } from "./checkCdnUpdate.ts";
import { createFakeFetch, createStaticUrlHandler } from "./createFakeFetch.ts";

async function tryCatch<T>(
  fn: () => T | Promise<T>,
): Promise<
  | { ok: true; value: Awaited<T> }
  | { ok: false; error: string }
> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

const fetch = createFakeFetch(createStaticUrlHandler({
  "https://libs.example.com/foo": () =>
    Response.redirect(`https://libs.example.com/foo@2.3.4`),
  "https://libs.example.com/foo@2.3.4": () => Response.json({}),

  "https://libs.example.com/foo@1": () =>
    Response.redirect(`https://libs.example.com/foo@1.4.5`),
  "https://libs.example.com/foo@1.4.5": () => Response.json({}),

  "https://libs.example.com/foo@1.2": () =>
    Response.redirect(`https://libs.example.com/foo@1.2.6`),
  "https://libs.example.com/foo@1.2.6": () => Response.json({}),

  "https://libs.example.com/foo@v1": () =>
    Response.redirect(`https://libs.example.com/foo@v1.4.5`),
  "https://libs.example.com/foo@v1.4.5": () => Response.json({}),

  "https://libs.example.com/foo@v1.2": () =>
    Response.redirect(`https://libs.example.com/foo@v1.2.6`),
  "https://libs.example.com/foo@v1.2.6": () => Response.json({}),

  "https://libs.example.com/foo@0": () =>
    Response.redirect(`https://libs.example.com/foo@0.10.20`),
  "https://libs.example.com/foo@0.10.20": () => Response.json({}),

  "https://libs.example.com/foo@0.0": () =>
    Response.redirect(`https://libs.example.com/foo@0.0.100`),
  "https://libs.example.com/foo@0.0.100": () => Response.json({}),

  "https://libs.example.com/foo@0.1": () =>
    Response.redirect(`https://libs.example.com/foo@0.1.1000`),
  "https://libs.example.com/foo@0.1.1000": () => Response.json({}),

  "https://libs.example.com/foo/index.js": () =>
    Response.redirect(`https://libs.example.com/foo@2.3.4/index.js`),
  "https://libs.example.com/foo@2.3.4/index.js": () => Response.json({}),

  "https://libs.example.com/foo?bar=baz": () =>
    Response.redirect(`https://libs.example.com/foo@2.3.4?bar=baz`),
  "https://libs.example.com/foo@2.3.4?bar=baz": () => Response.json({}),

  "https://not-exists.example.com/foo": () => {
    throw new Error("Network error");
  },
  "https://not-exists.example.com/foo@1": () => {
    throw new Error("Network error");
  },
  "https://not-exists.example.com/foo@1.2": () => {
    throw new Error("Network error");
  },

  "https://no-redirect.example.com/foo": () => Response.json({}),
  "https://no-redirect.example.com/foo@1": () => Response.json({}),
  "https://no-redirect.example.com/foo@1.2": () => Response.json({}),

  "https://bad-redirect.example.com/foo": () =>
    Response.redirect("https://bad-redirect.example.com/bar"),
  "https://bad-redirect.example.com/bar": () => Response.json({}),
  "https://bad-redirect.example.com/foo@1": () =>
    Response.redirect("https://bad-redirect.example.com/bar@1.2"),
  "https://bad-redirect.example.com/bar@1.2": () => Response.json({}),
  "https://bad-redirect.example.com/foo@1.2": () =>
    Response.redirect("https://bad-redirect.example.com/bar@x.x.x"),
  "https://bad-redirect.example.com/bar@x.x.x": () => Response.json({}),
}));

const urls = [
  "not even a URL",
  "https://libs.example.com/foo",
  "https://libs.example.com/foo@",
  "https://libs.example.com/foo@v",
  "https://libs.example.com/foo@x.x.x",
  "https://libs.example.com/foo@1",
  "https://libs.example.com/foo@1.x.x",
  "https://libs.example.com/foo@v1",
  "https://libs.example.com/foo@1.2",
  "https://libs.example.com/foo@1.2.*",
  "https://libs.example.com/foo@v1.2",
  "https://libs.example.com/foo@1.2.3",
  "https://libs.example.com/foo@v1.2.3",
  "https://libs.example.com/foo@1.2.3",
  "https://libs.example.com/foo@1.2.3/index.js",
  "https://libs.example.com/foo@1.2.3?bar=baz",
  "https://libs.example.com/foo@1.2.3-beta",
  "https://libs.example.com/foo@2.2.3",
  "https://libs.example.com/foo@2.3.3",
  "https://libs.example.com/foo@2.3.4",
  "https://libs.example.com/foo@2.3",
  "https://libs.example.com/foo@2",
  "https://libs.example.com/foo@2.3.5",
  "https://libs.example.com/foo@2.4.5",
  "https://libs.example.com/foo@3.4.5",
  "https://libs.example.com/foo@0.1.2",
  "https://libs.example.com/foo@0.0.1",
  "https://libs.example.com/unknown@1.2.3",
  "https://not-exists.example.com/foo@1.2.3",
  "https://no-redirect.example.com/foo@1.2.3",
  "https://bad-redirect.example.com/foo@1.2.3",
];

Deno.test("updates to latest version", async (t) => {
  for (const url of urls) {
    await assertSnapshot(
      t,
      await tryCatch(() => checkCdnUpdate(url, { fetch })),
    );
  }
});

Deno.test("updates with max update minor", async (t) => {
  for (const url of urls) {
    await assertSnapshot(
      t,
      await tryCatch(() => checkCdnUpdate(url, { fetch, maxUpdate: "minor" })),
    );
  }
});

Deno.test("updates with max update patch", async (t) => {
  for (const url of urls) {
    await assertSnapshot(
      t,
      await tryCatch(() => checkCdnUpdate(url, { fetch, maxUpdate: "patch" })),
    );
  }
});
