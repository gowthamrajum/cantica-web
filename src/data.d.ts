// Bundled data is loaded via dynamic import() so it ships as a hashed JS chunk
// (not a fetchable .json response). Typed `unknown` so tsc never infers a giant
// literal type from the multi-MB files — the loaders cast to the real shape.
declare module '*.json' {
  const value: unknown
  export default value
}
