// Constants for the PostHog SQLTools Driver

export const DRIVER_ID = "posthog-api-driver";
export const DRIVER_NAME = "PostHog (HogQL API)";

// Define any specific driver aliases if needed by SQLTools
// See SQLTools documentation or driver template for more info on aliases
export const DRIVER_ALIASES: Array<{
  id: string;
  name: string;
}> = [
  // Example:
  // { id: 'ph-api', name: 'PostHog API' },
];
