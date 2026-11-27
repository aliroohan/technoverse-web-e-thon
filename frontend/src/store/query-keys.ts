export const queryKeys = {
  health: (verbose?: boolean) => ['health', { verbose }] as const,
} as const