import { Show, createSignal, onMount } from "solid-js";
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

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../components/ui/text-field";
import { Button } from "../components/ui/button";
import { Icon } from "../components/ui/icon";
import { type MeProfile } from "../lib/auth";
import { apiFetch } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import {
  Select,
  SelectContent,
  SelectHiddenSelect,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  getNextOnboardingStep,
  isOnboardingIncomplete,
  onboardingPath,
} from "./onboarding/onboardingState";

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
  const { theme, toggleTheme } = useTheme();
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

  const chipClass = (active: boolean) =>
    `flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-2 text-xs font-bold transition-all duration-200 disabled:opacity-50 ${
      active
        ? "bg-primary text-white shadow-sm"
        : "border border-[rgba(194,199,208,0.75)] bg-white text-foreground/70 hover:text-foreground hover:border-primary/30"
    }`;

  const subTabClass = (active: boolean) =>
    `rounded-[calc(var(--radius-md)-0.2rem)] px-3 py-2 text-xs font-extrabold uppercase tracking-[0.1em] transition-all duration-200 ${
      active
        ? "bg-white text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`;

  const btnClass =
    "h-14 rounded-[var(--radius-lg)] bg-[linear-gradient(135deg,#2f5f8d_0%,#4a78a7_100%)] text-base font-bold text-white shadow-card transition-transform duration-300 hover:scale-[1.01] hover:opacity-100 active:scale-[0.98]";

  return (
    <div
      class="min-h-screen bg-background text-foreground [font-family:Manrope,'Space_Grotesk',system-ui,sans-serif]"
      style={{
        "--background": "220 44% 98%",
        "--foreground": "210 35% 11%",
        "--muted": "214 48% 95%",
        "--muted-foreground": "217 9% 33%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "210 35% 11%",
        "--border": "220 20% 82%",
        "--input": "215 45% 89%",
        "--card": "0 0% 100%",
        "--card-foreground": "210 35% 11%",
        "--primary": "209 50% 37%",
        "--primary-foreground": "0 0% 100%",
        "--secondary": "212 100% 37%",
        "--secondary-foreground": "0 0% 100%",
        "--accent": "214 48% 95%",
        "--accent-foreground": "210 35% 11%",
        "--ring": "209 50% 37%",
        "--radius": "0.5rem",
        "--radius-lg": "2rem",
        "--radius-md": "1rem",
        "--shadow-card": "0 20px 40px rgba(18, 29, 38, 0.05)",
      }}
    >
      <main class="relative flex min-h-screen flex-col overflow-hidden">
        <div class="absolute inset-0">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBLKZMi4N-1JtTpWI-Rc70zm5mveJUmrvfbPL3hULyGJGS2T0uAl2M6BAGd6uNZHdNbY5yWMBhXUrHGhbcqv9LH73kVw4EmcplwNCAM92WsX6C-cqYtWEunoZ9v3kTz1gbO4yf7xb7vDKZwmzq7aFotO6PGMyqYDwwvoQyo7EhjYT9lalsnlSeirNtd8IMiBkBCoMK5Sf8_xPH58JB6qRLbzuklgE27tvFTymSd0Mavg4pBqvp2ZOMz5NB5Vx7mdM6jNF2oW2thQmdX"
            alt=""
            class="h-full w-full object-cover opacity-[0.12] grayscale-[18%]"
          />
        </div>

        <div class="relative z-0 flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
          <Card class="w-full max-w-[30rem] rounded-[2rem] border border-white/60 bg-white/95 shadow-card backdrop-blur-sm">

            {/* ── HEADER ── */}
            <CardHeader class="space-y-0 px-7 pb-0 pt-8 text-center sm:px-10 sm:pt-10">
              <div class="space-y-4">

                {/* Access gate label */}
                <div class="flex items-center justify-center gap-2">
                  <Icon name="compass" class="text-base text-secondary" />
                  <span class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                    {t("login.accessGateLabel")}
                  </span>
                </div>

                {/* Title */}
                <CardTitle class="text-[1.75rem] font-extrabold tracking-[-0.04em] text-foreground">
                  {method() === "register"
                    ? t("login.platformTitleRegister")
                    : t("login.platformTitle")}
                </CardTitle>

                {/* Method chips */}
                <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy()}
                    onClick={() => setMethod("email")}
                    class={chipClass(method() === "email")}
                  >
                    <Icon name="mail" class="text-sm" />
                    {t("login.methodEmail")}
                  </button>

                  <button
                    type="button"
                    disabled={busy()}
                    onClick={() => setMethod("register")}
                    class={chipClass(method() === "register")}
                  >
                    <Icon name="person_add" class="text-sm" />
                    {t("login.methodRegister")}
                  </button>

                  <button
                    type="button"
                    disabled={busy()}
                    onClick={() => setMethod("telegram")}
                    class={chipClass(method() === "telegram")}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      class="size-[1em] shrink-0"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    {t("login.methodTelegram")}
                  </button>

                  <button
                    type="button"
                    disabled={busy()}
                    onClick={onGoogleLogin}
                    class={chipClass(false)}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" class="size-[1em] shrink-0">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {t("login.methodGoogle")}
                  </button>
                </div>
              </div>
            </CardHeader>

            {/* ── CONTENT ── */}
            <CardContent class="grid gap-5 px-7 pb-6 pt-6 sm:px-10">

              <Show when={info()}>
                <div class="rounded-[var(--radius-md)] bg-secondary/10 px-4 py-3 text-sm leading-6 text-secondary">
                  {info()}
                </div>
              </Show>

              <Show when={error()}>
                <div class="rounded-[var(--radius-md)] bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">
                  {error()}
                </div>
              </Show>

              {/* Email / Register form */}
              <Show when={method() !== "telegram"}>
                <div class="grid gap-5">

                  {/* Sub-tabs: email mode only */}
                  <Show when={method() === "email"}>
                    <div class="grid grid-cols-2 gap-1 rounded-[var(--radius-md)] bg-[rgba(223,233,247,0.7)] p-1">
                      <button
                        type="button"
                        onClick={() => setEmailSubMode("password")}
                        class={subTabClass(emailSubMode() === "password")}
                      >
                        {t("login.subTabPassword")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailSubMode("link")}
                        class={subTabClass(emailSubMode() === "link")}
                      >
                        {t("login.subTabLink")}
                      </button>
                    </div>
                  </Show>

                  {/* Email field */}
                  <TextField class="gap-2.5">
                    <TextFieldLabel
                      for="email"
                      class="pl-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {t("login.emailLabel")}
                    </TextFieldLabel>
                    <div class="relative">
                      <Icon
                        name="mail"
                        class="absolute left-4 top-1/2 -translate-y-1/2 text-base text-muted-foreground/60"
                      />
                      <TextFieldInput
                        id="email"
                        type="email"
                        placeholder={t("login.emailPlaceholder")}
                        value={email()}
                        onInput={(e: { currentTarget: { value: string } }) =>
                          setEmail(e.currentTarget.value)
                        }
                        autocomplete="email"
                        class="h-14 rounded-[var(--radius-md)] border-0 bg-[hsl(var(--input))] pl-11 pr-4 text-base shadow-none transition-all duration-300 placeholder:text-[#99a4b3] focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
                      />
                    </div>
                  </TextField>

                  {/* Password field: register mode OR email+password sub-mode */}
                  <Show when={method() === "register" || emailSubMode() === "password"}>
                    <TextField class="gap-2.5">
                      <div class="flex items-center justify-between gap-3 px-1">
                        <TextFieldLabel
                          for="password"
                          class="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
                        >
                          {t("login.passwordLabel")}
                        </TextFieldLabel>
                        <Show when={method() === "email"}>
                          <button
                            type="button"
                            class="text-xs font-semibold text-secondary transition-colors duration-300 hover:underline disabled:opacity-50"
                            disabled={busy()}
                            onClick={onPasswordReset}
                          >
                            {t("login.forgotPassword")}
                          </button>
                        </Show>
                      </div>
                      <div class="relative">
                        <Icon
                          name="lock"
                          class="absolute left-4 top-1/2 -translate-y-1/2 text-base text-muted-foreground/60"
                        />
                        <TextFieldInput
                          id="password"
                          type={showPassword() ? "text" : "password"}
                          placeholder={t("login.passwordPlaceholder")}
                          value={password()}
                          onInput={(e: { currentTarget: { value: string } }) =>
                            setPassword(e.currentTarget.value)
                          }
                          autocomplete={
                            method() === "register" ? "new-password" : "current-password"
                          }
                          class="h-14 rounded-[var(--radius-md)] border-0 bg-[hsl(var(--input))] pl-11 pr-12 text-base shadow-none transition-all duration-300 placeholder:text-[#99a4b3] focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          class="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-foreground"
                          tabindex="-1"
                        >
                          <Icon
                            name={showPassword() ? "visibility_off" : "visibility"}
                            class="text-base"
                          />
                        </button>
                      </div>
                    </TextField>
                  </Show>

                  {/* Submit button */}
                  <Show
                    when={method() === "register"}
                    fallback={
                      <Show
                        when={emailSubMode() === "link"}
                        fallback={
                          <Button
                            disabled={busy()}
                            onClick={onEmailPasswordLogin}
                            class={btnClass}
                          >
                            {t("login.signInPassword")} ✓
                          </Button>
                        }
                      >
                        <Button
                          disabled={busy()}
                          onClick={onSendEmailLink}
                          class={btnClass}
                        >
                          {t("login.sendLink")} →
                        </Button>
                      </Show>
                    }
                  >
                    <Button
                      disabled={busy()}
                      onClick={onEmailPasswordRegister}
                      class={btnClass}
                    >
                      {t("login.createAccount")} →
                    </Button>
                  </Show>
                </div>
              </Show>

              {/* Telegram stub */}
              <Show when={method() === "telegram"}>
                <div class="flex flex-col items-center gap-4 py-6 text-center">
                  <div class="rounded-full bg-[#229ED9]/10 p-4">
                    <svg
                      viewBox="0 0 24 24"
                      class="size-8 text-[#229ED9]"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                  </div>
                  <div>
                    <p class="font-bold text-foreground">{t("login.telegramTitle")}</p>
                    <p class="mt-1.5 text-sm text-muted-foreground">{t("login.telegramSoon")}</p>
                  </div>
                </div>
              </Show>
            </CardContent>

            {/* ── CARD FOOTER ── */}
            <div class="grid grid-cols-3 items-center px-7 pb-7 pt-0 sm:px-10">
              <span class="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground/60">
                <Icon name="lock" class="text-xs" />
                {t("login.sslLabel")}
              </span>

              <div class="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={theme() === "dark" ? t("common.themeLight") : t("common.themeDark")}
                  class="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] bg-[rgba(223,233,247,0.6)] text-muted-foreground/80 transition-colors hover:bg-[rgba(217,227,241,0.9)] hover:text-foreground"
                >
                  <Icon name={theme() === "dark" ? "sun" : "moon"} class="text-xs" />
                </button>
                <Select
                  value={{
                    value: locale(),
                    label: locale() === "ru" ? "Русский" : "English",
                  }}
                  onChange={(value) => {
                    const next = value?.value === "ru" ? "ru" : "en";
                    setLocale(next);
                  }}
                  options={[
                    { value: "en", label: "English" },
                    { value: "ru", label: "Русский" },
                  ]}
                  optionValue={(option) =>
                    (option as unknown as { value: string; label: string }).value
                  }
                  optionTextValue={(option) =>
                    (option as unknown as { value: string; label: string }).label
                  }
                  itemComponent={(props) => (
                    <SelectItem
                      item={props.item}
                      class="rounded-[var(--radius-md)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                    >
                      {(props.item.rawValue as unknown as { label: string }).label}
                    </SelectItem>
                  )}
                >
                  <SelectLabel for="login-language" class="sr-only">
                    {t("common.language")}
                  </SelectLabel>
                  <SelectHiddenSelect id="login-language" />
                  <SelectTrigger
                    aria-label={t("common.language")}
                    class="h-7 rounded-[var(--radius-md)] border-0 bg-[rgba(223,233,247,0.6)] px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80 shadow-none transition-colors duration-300 hover:bg-[rgba(217,227,241,0.9)] focus:ring-0"
                  >
                    <div class="flex min-w-0 items-center gap-1">
                      <Icon name="language" class="text-xs text-muted-foreground/60" />
                      <SelectValue<string>>
                        {(state) =>
                          (
                            (state?.selectedOption() || {}) as unknown as {
                              label: string;
                            }
                          ).label ?? t("common.language")
                        }
                      </SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent class="rounded-[var(--radius-md)] border border-white/60 bg-white/95 p-1 shadow-card backdrop-blur-xl" />
                </Select>
              </div>

              <span class="text-right text-[10px] font-semibold text-muted-foreground/60">
                {t("login.versionLabel")}
              </span>
            </div>

          </Card>
        </div>
      </main>
    </div>
  );
}
