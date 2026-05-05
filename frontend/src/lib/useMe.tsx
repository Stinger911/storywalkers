import { createContext, useContext, type JSX } from "solid-js";

import { useAuth, type MeProfile } from "./auth";

type MeContextValue = {
  me: () => MeProfile | null;
  loading: () => boolean;
  refresh: () => Promise<void>;
};

const MeContext = createContext<MeContextValue>();

export function MeProvider(props: {
  me: () => MeProfile | null;
  loading: () => boolean;
  refresh: () => Promise<void>;
  children: JSX.Element;
}) {
  return (
    <MeContext.Provider
      value={{
        me: props.me,
        loading: props.loading,
        refresh: props.refresh,
      }}
    >
      {props.children}
    </MeContext.Provider>
  );
}

export function useMe() {
  const context = useContext(MeContext);
  if (context) {
    return context;
  }
  const auth = useAuth();
  return {
    me: auth.me,
    loading: auth.loading,
    refresh: auth.refreshMe,
  };
}
