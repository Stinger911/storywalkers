import { For, Show, createSignal, onMount } from "solid-js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  fetchSignInMethodsForEmail,
  updatePassword,
} from "firebase/auth";
import type { FirebaseError } from "firebase/app";
import { auth } from "../lib/firebase";

import { Icon } from "../components/ui/icon";
import { type MeProfile } from "../lib/auth";
import { apiFetch } from "../lib/api";
import { useI18n } from "../lib/i18n";
import {
  getNextOnboardingStep,
  isOnboardingIncomplete,
  onboardingPath,
} from "./onboarding/onboardingState";
import { Illustration } from "./start/StartLayout";
import { syncDraftToMe } from "./start/startSync";
import { StartButton, StartError, StartInput, StartOption, StartPage } from "./start/StartUi";

function friendlyAuthError(
  err: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const e = err as Partial<FirebaseError> & { code?: string; message?: string };

  switch (e.code) {
    case "auth/unauthorized-domain":
      return t("login.errors.unauthorizedDomain");
    case "auth/account-exists-with-different-credential":
      return t("login.errors.accountExists");
    case "auth/popup-closed-by-user":
      return t("login.errors.popupClosed");
    case "auth/invalid-email":
      return t("login.errors.invalidEmail");
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return t("login.errors.wrongPassword");
    case "auth/too-many-requests":
      return t("login.errors.tooManyRequests");
    case "auth/missing-email":
      return t("login.errors.missingEmail");
    case "auth/missing-password":
      return t("login.errors.missingPassword");
    case "auth/email-already-in-use":
      return t("login.errors.emailAlreadyInUse");
    case "auth/weak-password":
      return t("login.errors.weakPassword");
    default:
      return t("login.errors.generic");
  }
}

type AuthMethod = "email" | "register" | "telegram";
type EmailSubMode = "password" | "link";

export function Login() {
  const { t, locale, setLocale } = useI18n();
  const [method, setMethod] = createSignal<AuthMethod>("email");
  const [emailSubMode, setEmailSubMode] = createSignal<EmailSubMode>("password");
  const [showPassword, setShowPassword] = createSignal(false);
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [info, setInfo] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const pendingPasswordStorageKey = "pendingPasswordForSignIn";

  const googleProvider = new GoogleAuthProvider();

  const actionCodeSettings = () => ({
    url: `${window.location.origin}/login`,
    handleCodeInApp: true,
  });

  async function onEmailPasswordLogin() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email().trim(), password());
      setInfo(t("login.messages.signedIn"));
      await redirectIfLoggedIn();
    } catch (e) {
      setError(friendlyAuthError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function onPasswordReset() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const userEmail = email().trim();
      if (!userEmail) {
        throw Object.assign(new Error("missing email"), {
          code: "auth/missing-email",
        });
      }
      await sendPasswordResetEmail(auth, userEmail);
      setInfo(t("login.messages.passwordResetSent"));
    } catch (e) {
      setError(friendlyAuthError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function onEmailPasswordRegister() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const userEmail = email().trim();
      const userPassword = password();
      await createUserWithEmailAndPassword(auth, userEmail, userPassword);
      setInfo(t("login.messages.accountCreated"));
      await redirectIfLoggedIn();
    } catch (e) {
      const authError = e as Partial<FirebaseError> & { code?: string };
      const userEmail = email().trim();
      const userPassword = password();
      if (authError.code === "auth/email-already-in-use" && userEmail) {
        try {
          const methods = await fetchSignInMethodsForEmail(auth, userEmail);
          if (methods.includes("password")) {
            await signInWithEmailAndPassword(auth, userEmail, userPassword);
            setInfo(t("login.messages.signedIn"));
            await redirectIfLoggedIn();
            return;
          }
          if (methods.includes("emailLink")) {
            window.localStorage.setItem("emailForSignIn", userEmail);
            window.localStorage.setItem(pendingPasswordStorageKey, userPassword);
            await sendSignInLinkToEmail(auth, userEmail, actionCodeSettings());
            setInfo(t("login.messages.emailLinkSentSetPassword"));
            return;
          }
        } catch {
          // fall through
        }
      }
      setError(friendlyAuthError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogleLogin() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setInfo(t("login.messages.googleSuccess"));
      await redirectIfLoggedIn();
    } catch (e) {
      setError(friendlyAuthError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function onSendEmailLink() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const e = email().trim();
      if (!e)
        throw Object.assign(new Error("missing email"), {
          code: "auth/missing-email",
        });
      const methods = await fetchSignInMethodsForEmail(auth, e);
      if (methods.length > 0 && !methods.includes("emailLink")) {
        setInfo(t("login.messages.emailLinkHint"));
      }
      await sendSignInLinkToEmail(auth, e, actionCodeSettings());
      window.localStorage.setItem("emailForSignIn", e);
      window.localStorage.removeItem(pendingPasswordStorageKey);
      setInfo(t("login.messages.emailLinkSent"));
    } catch (e) {
      setError(friendlyAuthError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function redirectIfLoggedIn(silent = false) {
    // Answers collected before registration are saved first, so /api/me below
    // already reflects the goal and the path chosen in the funnel.
    await syncDraftToMe();
    const response = await apiFetch("/api/me");
    if (response.ok) {
      const data = (await response.json()) as MeProfile;
      if (!data) {
        if (!silent) setError(t("login.errors.profileMissing"));
        return;
      }
      if (!data.role) {
        if (!silent) setError(t("login.errors.roleMissing"));
        return;
      }
      if (data.role === "staff") {
        window.location.href = "/admin/home";
      } else {
        window.location.href = isOnboardingIncomplete(data)
          ? onboardingPath(getNextOnboardingStep(data))
          : "/student/home";
      }
    } else if (!silent) {
      setError(t("login.errors.profileMissing"));
    }
  }

  async function tryCompleteEmailLinkSignIn() {
    setError(null);
    setInfo(null);
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    setBusy(true);
    try {
      const storedEmail = window.localStorage.getItem("emailForSignIn");
      const e = storedEmail || email().trim();
      if (!e) {
        setError(t("login.errors.missingEmailForLink"));
        return;
      }
      await signInWithEmailLink(auth, e, window.location.href);
      window.localStorage.removeItem("emailForSignIn");
      const pendingPassword = window.localStorage.getItem(pendingPasswordStorageKey);
      if (pendingPassword && auth.currentUser) {
        await updatePassword(auth.currentUser, pendingPassword);
        window.localStorage.removeItem(pendingPasswordStorageKey);
      }
      window.history.replaceState({}, document.title, "/login");
      setInfo(
        pendingPassword
          ? t("login.messages.linkSignedInPasswordEnabled")
          : t("login.messages.linkSignedIn"),
      );
      await redirectIfLoggedIn();
    } catch (e) {
      setError(friendlyAuthError(e, t));
    } finally {
      setBusy(false);
    }
  }

  onMount(() => {
    void redirectIfLoggedIn(true);
    void tryCompleteEmailLinkSignIn();
  });

  const languages = [
    { value: "en", label: "English" },
    { value: "ru", label: "Русский" },
  ] as const;

  return (
    <StartPage>
      <Illustration step="channel" />

      <h1 class="st-heading">
        {method() === "register"
          ? t("login.platformTitleRegister")
          : t("login.platformTitle")}
      </h1>
      <p class="st-lead text-[var(--st-muted)]">{t("login.accessGateLabel")}</p>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StartOption
          selected={method() === "email"}
          disabled={busy()}
          onClick={() => setMethod("email")}
        >
          {t("login.methodEmail")}
        </StartOption>
        <StartOption
          selected={method() === "register"}
          disabled={busy()}
          onClick={() => setMethod("register")}
        >
          {t("login.methodRegister")}
        </StartOption>
        <StartOption
          selected={method() === "telegram"}
          disabled={busy()}
          onClick={() => setMethod("telegram")}
        >
          {t("login.methodTelegram")}
        </StartOption>
        <button type="button" class="st-option gap-2" disabled={busy()} onClick={onGoogleLogin}>
          <svg aria-hidden="true" viewBox="0 0 24 24" class="size-4 shrink-0">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {t("login.methodGoogle")}
        </button>
      </div>

      <Show when={info()}>
        <div role="status" class="st-notice text-center text-xs leading-5">
          {info()}
        </div>
      </Show>

      <Show when={error()}>
        <StartError>{error()}</StartError>
      </Show>

      {/* Email / Register form */}
      <Show when={method() !== "telegram"}>
        <div class="space-y-4">
          {/* Sub-tabs: email mode only */}
          <Show when={method() === "email"}>
            <div class="flex justify-center gap-2">
              <StartButton
                variant="small"
                aria-pressed={emailSubMode() === "password"}
                onClick={() => setEmailSubMode("password")}
              >
                {t("login.subTabPassword")}
              </StartButton>
              <StartButton
                variant="small"
                aria-pressed={emailSubMode() === "link"}
                onClick={() => setEmailSubMode("link")}
              >
                {t("login.subTabLink")}
              </StartButton>
            </div>
          </Show>

          <div class="space-y-2">
            <label class="st-label" for="email">
              {t("login.emailLabel")}
            </label>
            <StartInput
              id="email"
              type="email"
              placeholder={t("login.emailPlaceholder")}
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              autocomplete="email"
            />
          </div>

          {/* Password field: register mode OR email+password sub-mode */}
          <Show when={method() === "register" || emailSubMode() === "password"}>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <label class="st-label" for="password">
                  {t("login.passwordLabel")}
                </label>
                <Show when={method() === "email"}>
                  <button
                    type="button"
                    class="cursor-pointer text-xs font-semibold text-[var(--st-red)] hover:underline disabled:opacity-50"
                    disabled={busy()}
                    onClick={onPasswordReset}
                  >
                    {t("login.forgotPassword")}
                  </button>
                </Show>
              </div>
              <div class="relative">
                <StartInput
                  id="password"
                  type={showPassword() ? "text" : "password"}
                  class="pr-14"
                  placeholder={t("login.passwordPlaceholder")}
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  autocomplete={method() === "register" ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  class="st-icon-btn absolute right-3 top-1/2 -translate-y-1/2"
                  tabindex="-1"
                >
                  <Icon
                    name={showPassword() ? "visibility_off" : "visibility"}
                    class="text-base"
                  />
                </button>
              </div>
            </div>
          </Show>

          <div class="flex justify-center pt-1">
            <Show
              when={method() === "register"}
              fallback={
                <Show
                  when={emailSubMode() === "link"}
                  fallback={
                    <StartButton disabled={busy()} onClick={onEmailPasswordLogin}>
                      {t("login.signInPassword")}
                    </StartButton>
                  }
                >
                  <StartButton disabled={busy()} onClick={onSendEmailLink}>
                    {t("login.sendLink")}
                  </StartButton>
                </Show>
              }
            >
              <StartButton disabled={busy()} onClick={onEmailPasswordRegister}>
                {t("login.createAccount")}
              </StartButton>
            </Show>
          </div>
        </div>
      </Show>

      {/* Telegram stub */}
      <Show when={method() === "telegram"}>
        <div class="space-y-2 py-6 text-center">
          <p class="text-sm font-bold">{t("login.telegramTitle")}</p>
          <p class="st-lead text-[var(--st-muted)]">{t("login.telegramSoon")}</p>
        </div>
      </Show>

      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--st-line)] pt-4 text-[0.65rem] text-[var(--st-muted)]">
        <span>{t("login.sslLabel")}</span>
        <div class="flex gap-2" role="group" aria-label={t("common.language")}>
          <For each={languages}>
            {(language) => (
              <StartButton
                variant="small"
                aria-pressed={locale() === language.value}
                onClick={() => setLocale(language.value)}
              >
                {language.label}
              </StartButton>
            )}
          </For>
        </div>
        <span>{t("login.versionLabel")}</span>
      </div>
    </StartPage>
  );
}
