// PD-SAAS-FORK: Chromium launch options for headless export in Docker / Linux servers

export type PlaywrightLaunchOptions = {
  headless: boolean;
  args: string[];
};

/** Safe defaults when the process runs as root in a container (small /dev/shm, no setuid sandbox). */
export function playwrightLaunchOptions(): PlaywrightLaunchOptions {
  return {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  };
}
