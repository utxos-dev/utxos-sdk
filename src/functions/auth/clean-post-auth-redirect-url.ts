/** Strip OAuth hand-off params so wallet reload does not re-trigger sign-in. */
export function cleanPostAuthRedirectUrl(redirect: string): string {
  try {
    const url = new URL(redirect);
    url.searchParams.delete("provider");
    url.searchParams.delete("directTo");
    url.searchParams.delete("from_provider");

    const refreshToken = url.searchParams.get("refreshToken");
    if (
      !refreshToken ||
      refreshToken === "undefined" ||
      refreshToken === "null"
    ) {
      url.searchParams.delete("refreshToken");
    }

    return url.toString();
  } catch {
    return redirect;
  }
}
