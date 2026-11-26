// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createStore, useStore } from "./store";

describe("createStore (zustand)", () => {
  it("tells the change handlers about local changes, not about loads", () => {
    const store = createStore({ xp: 0 });
    const onChange = vi.fn();
    const listener = vi.fn();
    store.onChange(onChange);
    store.subscribe(listener);

    store.set((state) => ({ xp: state.xp + 10 }));
    expect(store.get()).toEqual({ xp: 10 });
    expect(onChange).toHaveBeenCalledWith({ xp: 10 }, { xp: 0 });

    store.load({ xp: 99 });
    expect(store.get()).toEqual({ xp: 99 });
    expect(onChange).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("ignores a change that returns the same state", () => {
    const store = createStore({ xp: 0 });
    const onChange = vi.fn();
    store.onChange(onChange);
    store.set((state) => state);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("re-renders a component only when its selected part changes", () => {
    const store = createStore({ xp: 0, theme: "light" });
    let renders = 0;
    function Theme() {
      renders++;
      return <p>{useStore(store, (state) => state.theme)}</p>;
    }
    render(<Theme />);
    act(() => store.set((state) => ({ ...state, xp: 5 })));
    expect(renders).toBe(1);
    act(() => store.set((state) => ({ ...state, theme: "dark" })));
    expect(screen.getByText("dark")).toBeInTheDocument();
    expect(renders).toBe(2);
  });
});
