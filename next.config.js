/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // A stray lockfile in the home directory makes Turbopack infer the wrong
  // workspace root — pin it here.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default config;
