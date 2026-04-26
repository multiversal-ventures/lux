import "@testing-library/jest-dom/vitest";
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

// Re-register matchers explicitly: the `@testing-library/jest-dom/vitest`
// side-effect import above registers types, but in this pnpm workspace its
// runtime `expect.extend` call resolves a different `vitest` instance and
// doesn't actually extend the expect used by tests. Re-extending here with
// the local `vitest`'s `expect` guarantees matchers are available at runtime.
expect.extend(matchers);
