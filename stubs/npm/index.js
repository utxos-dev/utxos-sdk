// Minimal stub: @cardano-sdk packages declare a dependency on "npm"
// but do not require it at runtime. Returning an empty object avoids
// pulling the real npm CLI (and its vulnerable transitive deps).
module.exports = {};
