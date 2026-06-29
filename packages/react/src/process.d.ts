// Minimal ambient declaration so `process.env.NODE_ENV` compiles without @types/node.
// Major bundlers (Vite, webpack, esbuild, Rollup with @rollup/plugin-replace) replace
// `process.env.NODE_ENV` with a string literal at build time, enabling full DCE.
declare var process: { env: { NODE_ENV?: string } };
