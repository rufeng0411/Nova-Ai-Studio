import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PUBLIC_HTML_MAX_BYTES,
  fetchPublicHttpResource,
  normalizePublicHttpUrl,
  resolvePublicHttpTarget,
  type PublicDnsResolver,
  type PublicHttpLookup,
} from "../../src/tool/builtin/web/publicHttpUrlPolicy.js";

const PUBLIC_V4 = "93.184.216.34";

const publicResolver: PublicDnsResolver = async () => [
  { address: PUBLIC_V4, family: 4 },
];

function invokeLookup(
  lookup: PublicHttpLookup,
  hostname: string,
): Promise<Array<{ address: string; family: 4 | 6 }>> {
  return new Promise((resolve, reject) => {
    lookup(hostname, { all: true }, (error, addresses) => {
      if (error) {
        reject(error);
        return;
      }
      assert.ok(Array.isArray(addresses));
      resolve(addresses.map((entry) => {
        assert.ok(entry.family === 4 || entry.family === 6);
        return {
          address: entry.address,
          family: entry.family,
        };
      }));
    });
  });
}

function streamingBody(totalBytes: number, chunkBytes = 1_024): ReadableStream<Uint8Array> {
  let emitted = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (emitted >= totalBytes) {
        controller.close();
        return;
      }
      const size = Math.min(chunkBytes, totalBytes - emitted);
      controller.enqueue(new Uint8Array(size));
      emitted += size;
    },
  });
}

test("public URL policy upgrades HTTP and permits public HTTPS targets", async () => {
  assert.equal(
    normalizePublicHttpUrl("http://www.example.com/products").toString(),
    "https://www.example.com/products",
  );

  const ipv4 = await resolvePublicHttpTarget(
    "https://example.com/products",
    publicResolver,
  );
  assert.deepEqual(ipv4.addresses, [{ address: PUBLIC_V4, family: 4 }]);

  const ipv6 = await resolvePublicHttpTarget(
    "https://[2606:4700:4700::1111]/",
    publicResolver,
  );
  assert.deepEqual(ipv6.addresses, [
    { address: "2606:4700:4700::1111", family: 6 },
  ]);
});

test("public URL policy rejects credentials, ports, local names, metadata, and reserved IPs", () => {
  const rejected = [
    "https://user:secret@example.com/private",
    "https://example.com:8443/private",
    "https://localhost/private",
    "https://intranet/private",
    "https://metadata.google.internal/computeMetadata/v1/",
    "https://169.254.169.254/latest/meta-data/",
    "https://168.63.129.16/machine",
    "https://127.0.0.1/private",
    "https://10.0.0.1/private",
    "https://192.0.2.10/documentation",
    "https://[::1]/private",
    "https://[::ffff:10.0.0.1]/private",
    "https://[64:ff9b::10.0.0.1]/private",
    "https://[fe80::1]/private",
    "https://[fd00::1]/private",
  ];

  for (const value of rejected) {
    assert.throws(
      () => normalizePublicHttpUrl(value),
      Error,
      `expected ${value} to be rejected`,
    );
  }
});

test("DNS validation rejects any answer set containing a non-public address", async () => {
  const mixedResolver: PublicDnsResolver = async () => [
    { address: PUBLIC_V4, family: 4 },
    { address: "10.0.0.9", family: 4 },
  ];

  await assert.rejects(
    resolvePublicHttpTarget("https://example.com/", mixedResolver),
    /non-public/i,
  );
});

test("controlled lookup pins the prevalidated DNS answer against rebinding", async () => {
  let resolverCalls = 0;
  const rebindingResolver: PublicDnsResolver = async () => {
    resolverCalls += 1;
    return resolverCalls === 1
      ? [{ address: PUBLIC_V4, family: 4 }]
      : [{ address: "127.0.0.1", family: 4 }];
  };

  const target = await resolvePublicHttpTarget(
    "https://example.com/",
    rebindingResolver,
  );
  const first = await invokeLookup(target.lookup, "example.com");
  const second = await invokeLookup(target.lookup, "example.com");

  assert.deepEqual(first, [{ address: PUBLIC_V4, family: 4 }]);
  assert.deepEqual(second, [{ address: PUBLIC_V4, family: 4 }]);
  assert.equal(resolverCalls, 1);
});

test("manual redirect validation blocks redirects to private IPs and cross-host ports", async () => {
  const privateRedirectFetch: typeof fetch = async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://127.0.0.1/admin" },
    });

  await assert.rejects(
    fetchPublicHttpResource("https://example.com/start", {
      resolver: publicResolver,
      fetchImpl: privateRedirectFetch,
    }),
    /non-public/i,
  );

  const portRedirectFetch: typeof fetch = async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://example.com:8443/admin" },
    });

  await assert.rejects(
    fetchPublicHttpResource("https://example.com/start", {
      resolver: publicResolver,
      fetchImpl: portRedirectFetch,
    }),
    /port/i,
  );
});

test("manual redirect policy permits only same-host or www aliases", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "example.com") {
      return new Response(null, {
        status: 302,
        headers: { location: "https://www.example.com/final" },
      });
    }
    return new Response("ok", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };

  const allowed = await fetchPublicHttpResource("https://example.com/start", {
    resolver: publicResolver,
    fetchImpl,
  });
  assert.equal(allowed.url, "https://www.example.com/final");

  const crossHostFetch: typeof fetch = async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://cdn.example.net/final" },
    });
  await assert.rejects(
    fetchPublicHttpResource("https://example.com/start", {
      resolver: publicResolver,
      fetchImpl: crossHostFetch,
    }),
    /cross-host/i,
  );
});

test("manual redirect policy stops after five hops", async () => {
  let requests = 0;
  const fetchImpl: typeof fetch = async (input) => {
    requests += 1;
    const url = new URL(String(input));
    const hop = Number.parseInt(url.searchParams.get("hop") ?? "0", 10);
    return new Response(null, {
      status: 302,
      headers: {
        location: `https://example.com/path?hop=${hop + 1}`,
      },
    });
  };

  await assert.rejects(
    fetchPublicHttpResource("https://example.com/path?hop=0", {
      resolver: publicResolver,
      fetchImpl,
    }),
    /redirect/i,
  );
  assert.equal(requests, 6);
});

test("non-finite redirect options cannot disable the five-hop ceiling", async () => {
  let requests = 0;
  const fetchImpl: typeof fetch = async (input) => {
    requests += 1;
    const url = new URL(String(input));
    const hop = Number.parseInt(url.searchParams.get("hop") ?? "0", 10);
    if (hop > 6) {
      return new Response("done", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    return new Response(null, {
      status: 302,
      headers: {
        location: `https://example.com/path?hop=${hop + 1}`,
      },
    });
  };

  await assert.rejects(
    fetchPublicHttpResource("https://example.com/path?hop=0", {
      resolver: publicResolver,
      fetchImpl,
      maxRedirects: Number.NaN,
    }),
    /redirect/i,
  );
  assert.equal(requests, 6);
});

test("HTML response rejects oversized Content-Length before reading", async () => {
  let bodyRead = false;
  const fetchImpl: typeof fetch = async () =>
    ({
      status: 200,
      statusText: "OK",
      headers: new Headers({
        "content-type": "text/html",
        "content-length": String(DEFAULT_PUBLIC_HTML_MAX_BYTES + 1),
      }),
      body: {
        getReader() {
          bodyRead = true;
          throw new Error("body should not be read");
        },
      },
    }) as unknown as Response;

  await assert.rejects(
    fetchPublicHttpResource("https://example.com/", {
      resolver: publicResolver,
      fetchImpl,
      expectedKind: "html",
    }),
    /content-length/i,
  );
  assert.equal(bodyRead, false);
});

test("non-finite byte options cannot disable the HTML hard ceiling", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(null, {
      status: 200,
      headers: {
        "content-type": "text/html",
        "content-length": String(DEFAULT_PUBLIC_HTML_MAX_BYTES + 1),
      },
    });

  await assert.rejects(
    fetchPublicHttpResource("https://example.com/oversized", {
      resolver: publicResolver,
      fetchImpl,
      expectedKind: "html",
      maxHtmlBytes: Number.NaN,
    }),
    /too large|exceeds/i,
  );
});

test("HTML response enforces the actual streamed-byte limit", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(streamingBody(DEFAULT_PUBLIC_HTML_MAX_BYTES + 1, 256 * 1_024), {
      status: 200,
      headers: { "content-type": "text/html" },
    });

  await assert.rejects(
    fetchPublicHttpResource("https://example.com/", {
      resolver: publicResolver,
      fetchImpl,
      expectedKind: "html",
    }),
    /streamed body/i,
  );
});

test("gzip and Content-Length deception cannot bypass the actual byte cap", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(streamingBody(2_048, 512), {
      status: 200,
      headers: {
        "content-type": "text/html",
        "content-encoding": "gzip",
        "content-length": "128",
      },
    });

  await assert.rejects(
    fetchPublicHttpResource("https://example.com/", {
      resolver: publicResolver,
      fetchImpl,
      expectedKind: "html",
      maxHtmlBytes: 1_024,
    }),
    /streamed body/i,
  );
});
