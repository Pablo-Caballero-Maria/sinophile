import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../settings/model";
import { Saver, type SaveStatus } from "./saver";
import {
  credentialsError,
  normalizeUsername,
  signInFormSchema,
  signUpFormSchema,
  usernameError,
} from "./types";

describe("credentials", () => {
  it("normalises usernames and explains invalid ones in Spanish", () => {
    expect(normalizeUsername("  Pablo ")).toBe("pablo");
    expect(credentialsError("pablo", "12345678")).toBeNull();
    expect(credentialsError("pa", "12345678")).toMatch(/entre 3 y 30/);
    expect(credentialsError("pablo caballero", "12345678")).toMatch(/solo puede tener/);
    expect(credentialsError("pablo", "1234")).toMatch(/al menos 8/);
  });
});

describe("settings", () => {
  it("keeps known, well-typed values and falls back to the defaults", () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    const s = sanitizeSettings({
      dailyGoal: 100,
      theme: "dark",
      sound: "yes",
      ttsRate: 9,
      sessionLength: 20,
      sync: { token: "secret" },
    });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, dailyGoal: 100, theme: "dark", sessionLength: 20 });
    expect(s).not.toHaveProperty("sync");
  });

  it("keeps silent mode, which is off by default", () => {
    expect(DEFAULT_SETTINGS.silentMode).toBe(false);
    expect(sanitizeSettings({ silentMode: true }).silentMode).toBe(true);
    expect(sanitizeSettings({ silentMode: "yes" }).silentMode).toBe(false);
  });
});

describe("Saver (background uploads)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (
    send: (value: number[], keepalive: boolean) => Promise<unknown>,
    shouldRetry = () => true,
  ) => {
    const statuses: SaveStatus[] = [];
    const saver = new Saver<number[]>({
      send,
      combine: (a, b) => [...a, ...b],
      delayMs: 1000,
      retryMs: 5000,
      shouldRetry,
      onStatus: (s) => statuses.push(s),
    });
    return { saver, statuses };
  };

  it("batches a burst of changes into one upload", async () => {
    const send = vi.fn(async () => {});
    const { saver, statuses } = setup(send);
    saver.push([1]);
    await vi.advanceTimersByTimeAsync(500);
    saver.push([2]); // does not postpone the upload
    await vi.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith([1, 2], false);
    expect(saver.status).toBe("idle");
    expect(statuses).toEqual(["pending", "pending", "saving", "idle"]);
  });

  it("puts a failed upload back in the queue and retries it with newer changes", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const { saver } = setup(send);
    saver.push([1]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(saver.status).toBe("error");
    saver.push([2]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(send).toHaveBeenLastCalledWith([1, 2], false);
    expect(saver.status).toBe("idle");
    expect(saver.busy).toBe(false);
  });

  it("drops uploads that cannot succeed when retrying is not allowed", async () => {
    const send = vi.fn().mockRejectedValue(new Error("too large"));
    const { saver } = setup(send, () => false);
    saver.push([1]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledOnce();
    expect(saver.status).toBe("error");
    expect(saver.busy).toBe(false);
  });

  it("sends everything with keepalive when the page is hidden, including running uploads", async () => {
    let finish: () => void = () => {};
    const send = vi.fn((_value: number[], keepalive: boolean) =>
      keepalive ? Promise.resolve() : new Promise<void>((r) => (finish = r)),
    );
    const { saver } = setup(send);
    saver.push([1]);
    void saver.flush(); // slow request in flight
    saver.push([2]);
    saver.flushOnExit();
    expect(send.mock.calls).toEqual([
      [[1], false],
      [[1], true],
      [[2], true],
    ]);
    finish();
    await vi.runAllTimersAsync();
    expect(saver.status).toBe("idle");
  });

  it("clear() forgets queued changes", async () => {
    const send = vi.fn(async () => {});
    const { saver } = setup(send);
    saver.push([1]);
    saver.clear();
    await vi.advanceTimersByTimeAsync(5000);
    expect(send).not.toHaveBeenCalled();
    expect(saver.status).toBe("idle");
  });
});

describe("account forms (zod)", () => {
  it("signing in only needs both fields, and normalises the username", () => {
    expect(signInFormSchema.parse({ username: " Pablo ", password: "x", repeat: "" })).toEqual({
      username: "pablo",
      password: "x",
    });
    const empty = signInFormSchema.safeParse({ username: "  ", password: "", repeat: "" });
    expect(empty.error!.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ["username", "Escribe tu nombre de usuario."],
      ["password", "Escribe tu contraseña."],
    ]);
  });

  it("creating an account checks the rules and the repeated password", () => {
    expect(signUpFormSchema.parse({ username: "Pablo", password: "12345678", repeat: "12345678" })).toEqual({
      username: "pablo",
      password: "12345678",
    });
    const issues = (form: object) =>
      signUpFormSchema.safeParse(form).error!.issues.map((issue) => [issue.path[0], issue.message]);
    expect(issues({ username: "pa", password: "12345678", repeat: "12345678" })).toEqual([
      ["username", "El nombre de usuario debe tener entre 3 y 30 caracteres."],
    ]);
    expect(issues({ username: "pablo", password: "12345678", repeat: "87654321" })).toEqual([
      ["repeat", "Las contraseñas no coinciden."],
    ]);
  });

  it("usernameError gives the first problem, or null", () => {
    expect(usernameError("Pablo_C")).toBeNull();
    expect(usernameError("")).toMatch(/entre 3 y 30/);
    expect(usernameError("pablo!")).toMatch(/solo puede tener/);
  });
});
