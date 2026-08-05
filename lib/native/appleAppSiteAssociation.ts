/** Apple App Site Association payload for Universal Links. */
export const APPLE_APP_SITE_ASSOCIATION = {
  applinks: {
    apps: [] as string[],
    details: [
      {
        appID: "TEAMID.co.buxme.app",
        paths: [
          "*",
          "/auth/*",
          "/oauth/plaid",
          "/oauth/plaid/*",
          "/settings",
          "/settings/*",
          "/invite/*",
          "/household/*",
          "/reset-password",
          "/login",
          "/signup",
        ],
      },
    ],
  },
  webcredentials: {
    apps: ["TEAMID.co.buxme.app"],
  },
} as const;
