/**
 * Creates a fake {@link fetch} function which calls the provided handler instead of making a real request.
 */
export function createFakeFetch(
  handler: (request: Request) => Promise<Response>,
): typeof fetch {
  return async function fakeFetch(url, init) {
    const request = new Request(url, init);
    const redirectMode = init?.redirect ?? "follow";
    const response = await handler(request);
    if (response.status >= 300 && response.status < 400) {
      if (redirectMode === "error") {
        throw new Error(
          `Received redirect with ${response.status} status code`,
        );
      }
      if (redirectMode === "follow") {
        const nextLocation = response.headers.get("Location") ?? "";
        const nextUrl = new URL(nextLocation, request.url);
        if (nextUrl.href === request.url) {
          throw new Error("Infinite redirect loop");
        }
        return fakeFetch(nextUrl, init);
      }
    }
    return new FakeResponse(request.url, response.body, response);
  };
}

class FakeResponse extends Response {
  constructor(
    readonly url: string,
    ...args: ConstructorParameters<typeof Response>
  ) {
    super(...args);
  }
}

/**
 * Takes a mapping of URLs to {@link Response}s and returns a handler function that returns the matching response for a given URL.
 */
export function createStaticUrlHandler(
  urlToResponseMap: Record<
    string,
    (request: Request) => Response | Promise<Response>
  >,
): (request: Request) => Promise<Response> {
  return async function handler(request: Request) {
    const url = request.url;
    const response = urlToResponseMap[url];
    if (response) {
      return response(request);
    }
    return new Response(null, { status: 404 });
  };
}
