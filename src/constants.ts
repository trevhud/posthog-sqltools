// Constants for the PostHog SQLTools Driver (adapted for plugin system)

// DRIVER_ALIASES is used by the plugin system in extension.ts and ls/plugin.ts
// It must conform to the IDriverAlias interface from @sqltools/types
export const DRIVER_ALIASES: Array<{
  displayName: string;
  name: string; // deprecated in IDriverAlias, but often good to provide same as displayName
  value: string; // This is the unique driver identifier
}> = [
  {
    displayName: "PostHog", // Primary display name
    name: "PostHog", // For compatibility with deprecated 'name' field
    value: "posthog-api-driver", // The unique identifier, matches package.json contributes.sqltools.drivers.id
  },
];

// For convenience, also export the main driver ID and name if they are used elsewhere directly,
// though the plugin system primarily uses DRIVER_ALIASES.
export const POSTHOG_DRIVER_ID = DRIVER_ALIASES[0].value;
export const POSTHOG_DRIVER_NAME = DRIVER_ALIASES[0].displayName; // Use displayName here
