// PD-SAAS-FORK: Nova fork — no upstream GitHub star widget.
export const useGitHubStars = (_owner: string, _repo: string) => {
  return {
    starCount: null as number | null,
    formattedCount: null as string | null,
    isDismissed: true,
    dismiss: () => {},
  };
};
