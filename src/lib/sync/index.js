// Provider selection. Re-exports the small set of helpers callers
// outside this folder need.
export { createLocalProvider } from './localProvider.js'
export { createDriveProvider } from './driveProvider.js'
export {
  emptyEnvelope,
  mergeEnvelopes,
  normalizeEnvelope,
  canonicalizeEnvelope,
  envelopeContentSerial,
} from './merge.js'
export { default as useGoogleAuth } from './useGoogleAuth.js'
export { isConfigured as isGoogleConfigured } from './googleAuth.js'
