import { useAuth } from "./auth";

export function useMe() {
  const auth = useAuth();
  return {
    me: auth.me,
    loading: auth.loading,
    refresh: auth.refreshMe,
  };
}
