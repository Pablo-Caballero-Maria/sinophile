import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exercisesQuery, exercisesUnavailable } from "./data/remote";
import { cedictQuery } from "./dictionary";
import { strokesQuery } from "./strokes";
import { STROKES_CDN } from "./strokes-cdn";
import { translate } from "./translate";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("data loaded with TanStack Query and checked with zod", () => {
  it("indexes CC-CEDICT and rejects a file of another shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ entries: [["你好", "ni3 hao3", "hello; hi"]] })));
    const items = await new QueryClient().fetchQuery(cedictQuery);
    expect(items[0]!.entry).toMatchObject({ hanzi: "你好", source: "cedict" });
    expect(items[0]!.glosses).toEqual(["hello", "hi"]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ entries: [["你好", 3]] })));
    await expect(new QueryClient().fetchQuery(cedictQuery)).rejects.toThrow();
  });

  it("loads the exercises, and says why there are none when it can't", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 503)));
    await expect(new QueryClient().fetchQuery({ ...exercisesQuery, retry: false })).rejects.toThrow(
      "HTTP 503",
    );
    expect(exercisesUnavailable(new Error("HTTP 503")).issues[0]!.message).toMatch(/No se pudieron cargar/);
  });

  it("takes strokes from this site, or else from the CDN, and checks them", async () => {
    const strokes = {
      strokes: ["M 0 0 L 1 1"],
      medians: [
        [
          [0, 0],
          [1, 1],
        ],
      ],
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json(strokes));
    vi.stubGlobal("fetch", fetchMock);
    expect(await new QueryClient().fetchQuery(strokesQuery("好"))).toEqual(strokes);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      `/strokes/${encodeURIComponent("好")}.json`,
      `${STROKES_CDN}/${encodeURIComponent("好")}.json`,
    ]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ strokes: [], medians: [] })));
    await expect(new QueryClient().fetchQuery({ ...strokesQuery("坏"), retry: false })).rejects.toThrow();
  });

  it("translates with Google, or MyMemory when Google's answer isn't usable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json([[["你好", "hola"]], null, "es"])));
    expect(await translate("hola", "es", "zh")).toBe("你好");

    const fallback = vi
      .fn()
      .mockResolvedValueOnce(json({ unexpected: true }))
      .mockResolvedValueOnce(json({ responseStatus: 200, responseData: { translatedText: "你好" } }));
    vi.stubGlobal("fetch", fallback);
    expect(await translate("hola", "es", "zh")).toBe("你好");
    expect(String(fallback.mock.calls[1]![0])).toContain("api.mymemory.translated.net");
  });
});
