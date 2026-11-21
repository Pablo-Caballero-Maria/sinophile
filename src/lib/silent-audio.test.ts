/** Silent mode mutes everything the app can play: speech and UI sounds. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settingsStore } from "./settings/store";
import { DEFAULT_SETTINGS } from "./settings/model";
import { playSound } from "./sound";
import { speak } from "./speech";

afterEach(() => {
  vi.unstubAllGlobals();
  settingsStore.load(DEFAULT_SETTINGS);
});

describe("speech", () => {
  const synth = {
    cancel: vi.fn(),
    getVoices: () => [],
    speak: vi.fn((u: { onend: () => void }) => u.onend()),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", { speechSynthesis: synth });
    vi.stubGlobal("speechSynthesis", synth);
    vi.stubGlobal("SpeechSynthesisUtterance", class {});
  });

  it("speaks normally", async () => {
    await speak("你好");
    expect(synth.speak).toHaveBeenCalledOnce();
  });

  it("says nothing in silent mode, and doesn't cut off anything else", async () => {
    settingsStore.load({ ...DEFAULT_SETTINGS, silentMode: true });
    await speak("你好");
    expect(synth.speak).not.toHaveBeenCalled();
    expect(synth.cancel).not.toHaveBeenCalled();
  });
});

describe("UI sounds", () => {
  // Reaching the constructor is what's being checked; playSound swallows audio errors.
  const audioContext = vi.fn(function () {
    throw new Error("no audio in tests");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", {});
    vi.stubGlobal("AudioContext", audioContext);
  });

  it("plays normally", () => {
    playSound("correct");
    expect(audioContext).toHaveBeenCalledOnce();
  });

  it("plays nothing in silent mode, even with sound effects enabled", () => {
    settingsStore.load({ ...DEFAULT_SETTINGS, sound: true, silentMode: true });
    playSound("correct");
    expect(audioContext).not.toHaveBeenCalled();
  });
});
