// Dependency-free entry for validating app redirect URIs (deep links / universal
// links). Safe to import from API routes and client bundles: it pulls in no wallet,
// chain or platform adapter code.
export * from "./functions/auth/redirect-uri";
export * from "./functions/auth/safe-auth-redirect";
