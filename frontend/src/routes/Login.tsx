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

// Solid UI components (проверь пути в своём проекте)
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../components/ui/text-field";
import { Button } from "../components/ui/button";
import { type MeProfile } from "../lib/auth";
import { apiFetch } from "../lib/api";
import { useI18n } from "../lib/i18n";
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

export function Login() {
  const { t, locale, setLocale } = useI18n();
  const [mode, setMode] = createSignal<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const [info, setInfo] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const pendingPasswordStorageKey = "pendingPasswordForSignIn";
  const loginPageYear = new Date().getFullYear();

  const googleProvider = new GoogleAuthProvider();

  // Passwordless actionCodeSettings
  // Важно: url должен вести на страницу, где этот компонент рендерится
  const actionCodeSettings = () => ({
    url: `${window.location.origin}/login`,
    handleCodeInApp: true,
  });

  // 1) Email/Password login
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

  // (опционально) Email/Password register - оставил, потому что часто нужно.
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
            window.localStorage.setItem(
              pendingPasswordStorageKey,
              userPassword,
            );
            await sendSignInLinkToEmail(auth, userEmail, actionCodeSettings());
            setInfo(t("login.messages.emailLinkSentSetPassword"));
            return;
          }
        } catch {
          // Fall through to standard error mapping below.
        }
      }
      setError(friendlyAuthError(e, t));
    } finally {
      setBusy(false);
    }
  }

  // 2) Google login
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

  // 3) Passwordless: send email link
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

      // UX: подскажем, какие методы уже привязаны к email
      const methods = await fetchSignInMethodsForEmail(auth, e);
      // Если у человека только password, он всё равно может использовать email-link (если включено в консоли)
      // Просто информируем, чтобы он не путался.
      if (methods.length > 0 && !methods.includes("emailLink")) {
        setInfo(t("login.messages.emailLinkHint"));
      }

      await sendSignInLinkToEmail(auth, e, actionCodeSettings());
      // надо сохранить email локально, чтобы подтвердить вход после перехода по ссылке
      window.localStorage.setItem("emailForSignIn", e);
      window.localStorage.removeItem(pendingPasswordStorageKey);
      setInfo(t("login.messages.emailLinkSent"));
    } catch (e) {
      setError(friendlyAuthError(e, t));
    } finally {
      setBusy(false);
    }
  }

  // redirect to dashboard if already logged in
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

  // 4) Passwordless: complete sign-in if opened from email link
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
      const pendingPassword = window.localStorage.getItem(
        pendingPasswordStorageKey,
      );
      if (pendingPassword && auth.currentUser) {
        await updatePassword(auth.currentUser, pendingPassword);
        window.localStorage.removeItem(pendingPasswordStorageKey);
      }

      // Чтобы не оставлять query-параметры от email-link в адресе:
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

  const isSignUpMode = () => mode() === "sign-up";

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
      <header class="sticky top-0 z-10 border-b border-white/40 bg-white/70 backdrop-blur-xl">
        <div class="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <a
            href="/"
            class="text-lg font-extrabold tracking-[-0.03em] text-[#1f3b67] transition-colors duration-300 hover:text-primary"
          >
            StoryWalkers Club
          </a>
          <div class="w-[132px] shrink-0">
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
                  class="rounded-[var(--radius-md)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
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
                class="h-10 rounded-[var(--radius-md)] border-0 bg-[rgba(223,233,247,0.95)] px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground shadow-none transition-colors duration-300 hover:bg-[rgba(217,227,241,0.95)] focus:ring-2 focus:ring-primary/20 focus:ring-offset-0"
              >
                <div class="flex min-w-0 items-center gap-2">
                  <span class="material-symbols-outlined text-base text-foreground/70">
                    language
                  </span>
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
        </div>
      </header>

      <main class="relative flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden">
        <div class="absolute inset-0">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBLKZMi4N-1JtTpWI-Rc70zm5mveJUmrvfbPL3hULyGJGS2T0uAl2M6BAGd6uNZHdNbY5yWMBhXUrHGhbcqv9LH73kVw4EmcplwNCAM92WsX6C-cqYtWEunoZ9v3kTz1gbO4yf7xb7vDKZwmzq7aFotO6PGMyqYDwwvoQyo7EhjYT9lalsnlSeirNtd8IMiBkBCoMK5Sf8_xPH58JB6qRLbzuklgE27tvFTymSd0Mavg4pBqvp2ZOMz5NB5Vx7mdM6jNF2oW2thQmdX"
            alt=""
            class="h-full w-full object-cover opacity-[0.12] grayscale-[18%]"
          />
          {/* <div class="absolute inset-0 bg-[linear-gradient(135deg,rgba(47,95,141,0.08)_0%,rgba(74,120,167,0.06)_100%)]" />
          <div class="absolute inset-0 bg-[rgba(247,249,255,0.88)]" /> */}
        </div>

        <div class="relative z-0 flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
          <Card class="w-full max-w-[30rem] rounded-[2rem] border border-white/60 bg-white/95 shadow-card backdrop-blur-sm">
            <CardHeader class="space-y-0 px-7 pb-0 pt-8 text-center sm:px-10 sm:pt-10">
              <div class="space-y-5">
                <span class="text-[11px] font-extrabold uppercase tracking-[0.12em] text-secondary">
                  {isSignUpMode() ? "Join StoryWalkers" : "Welcome Back"}
                </span>
                <div class="grid grid-cols-2 gap-2 rounded-[var(--radius-lg)] bg-[rgba(223,233,247,0.7)] p-1">
                  <button
                    type="button"
                    onClick={() => setMode("sign-in")}
                    class={`rounded-[calc(var(--radius-lg)-0.35rem)] px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] transition-all duration-300 ${
                      !isSignUpMode()
                        ? "bg-white text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-pressed={!isSignUpMode()}
                  >
                    {t("login.modeSignIn")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("sign-up")}
                    class={`rounded-[calc(var(--radius-lg)-0.35rem)] px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] transition-all duration-300 ${
                      isSignUpMode()
                        ? "bg-white text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-pressed={isSignUpMode()}
                  >
                    {t("login.modeSignUp")}
                  </button>
                </div>
                <div class="space-y-2">
                  <CardTitle class="text-[2rem] font-extrabold tracking-[-0.04em] text-foreground sm:text-[2.125rem]">
                    {isSignUpMode()
                      ? t("login.signUpTitle")
                      : t("login.signInTitle")}
                  </CardTitle>
                  <CardDescription class="mx-auto max-w-xs text-sm leading-6 text-muted-foreground">
                    {isSignUpMode()
                      ? t("login.signUpSubtitle")
                      : t("login.signInSubtitle")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent class="grid gap-6 px-7 pb-8 pt-8 sm:px-10 sm:pb-10">
              <Show when={info()}>
                <div class="rounded-[var(--radius-md)] bg-secondary/10 px-4 py-3 text-sm leading-6 text-secondary">
                  {info()}
                </div>
              </Show>

              <Show when={error()}>
                <div class="rounded-[var(--radius-md)] bg-error/80 px-4 py-3 text-sm leading-6 text-red-900">
                  {error()}
                </div>
              </Show>

              <div class="grid gap-5">
                <TextField class="gap-2.5">
                  <TextFieldLabel
                    for="email"
                    class="pl-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    {t("login.emailLabel")}
                  </TextFieldLabel>
                  <TextFieldInput
                    id="email"
                    type="email"
                    placeholder={t("login.emailPlaceholder")}
                    value={email()}
                    onInput={(e: { currentTarget: { value: any } }) =>
                      setEmail(e.currentTarget.value)
                    }
                    autocomplete="email"
                    class="h-14 rounded-[var(--radius-md)] border-0 bg-[hsl(var(--input))] px-4 text-base shadow-none transition-all duration-300 placeholder:text-[#99a4b3] focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
                  />
                </TextField>

                <TextField class="gap-2.5">
                  <div class="flex items-center justify-between gap-3 px-1">
                    <TextFieldLabel
                      for="password"
                      class="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {t("login.passwordLabel")}
                    </TextFieldLabel>
                    <Show when={!isSignUpMode()}>
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
                  <TextFieldInput
                    id="password"
                    type="password"
                    placeholder={t("login.passwordPlaceholder")}
                    value={password()}
                    onInput={(e: { currentTarget: { value: any } }) =>
                      setPassword(e.currentTarget.value)
                    }
                    autocomplete={isSignUpMode() ? "new-password" : "current-password"}
                    class="h-14 rounded-[var(--radius-md)] border-0 bg-[hsl(var(--input))] px-4 text-base shadow-none transition-all duration-300 placeholder:text-[#99a4b3] focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
                  />
                </TextField>
              </div>

              <Show
                when={!isSignUpMode()}
                fallback={
                  <Button
                    disabled={busy()}
                    onClick={onEmailPasswordRegister}
                    class="h-14 rounded-[var(--radius-lg)] bg-[linear-gradient(135deg,#2f5f8d_0%,#4a78a7_100%)] text-base font-bold text-white shadow-card transition-transform duration-300 hover:scale-[1.01] hover:opacity-100 active:scale-[0.98]"
                  >
                    {t("login.createAccount")}
                  </Button>
                }
              >
                <Button
                  disabled={busy()}
                  onClick={onEmailPasswordLogin}
                  class="h-14 rounded-[var(--radius-lg)] bg-[linear-gradient(135deg,#2f5f8d_0%,#4a78a7_100%)] text-base font-bold text-white shadow-card transition-transform duration-300 hover:scale-[1.01] hover:opacity-100 active:scale-[0.98]"
                >
                  {t("login.signInPassword")}
                </Button>
              </Show>

              <div class="relative my-1">
                <div class="absolute inset-0 flex items-center">
                  <span class="h-px w-full bg-[rgba(194,199,208,0.3)]" />
                </div>
                <div class="relative flex justify-center">
                  <span class="bg-white px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b93a1]">
                    {t("login.or")}
                  </span>
                </div>
              </div>

              <div class="grid gap-3">
                <Button
                  disabled={busy()}
                  variant="outline"
                  onClick={isSignUpMode() ? onGoogleLogin : onGoogleLogin}
                  class="h-12 rounded-[var(--radius-lg)] border border-[rgba(194,199,208,0.75)] bg-white text-sm font-bold text-foreground shadow-none transition-colors duration-300 hover:bg-[rgba(237,244,255,0.85)]"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {t("login.continueGoogle")}
                </Button>

                <Show
                  when={!isSignUpMode()}
                  fallback={
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setMode("sign-in")}
                      class="h-11 rounded-[var(--radius-lg)] border border-secondary/10 bg-secondary/5 text-sm font-bold text-secondary shadow-none transition-colors duration-300 hover:bg-secondary/10"
                    >
                      {t("login.switchToSignIn")}
                    </Button>
                  }
                >
                  <Button
                    disabled={busy()}
                    variant="secondary"
                    onClick={onSendEmailLink}
                    class="h-11 rounded-[var(--radius-lg)] border-0 bg-[rgba(223,233,247,0.55)] text-sm font-bold text-secondary shadow-none transition-colors duration-300 hover:bg-[rgba(223,233,247,0.85)]"
                  >
                    {t("login.sendLink")}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMode("sign-up")}
                    class="h-11 rounded-[var(--radius-lg)] border border-secondary/20 bg-white text-sm font-bold text-secondary shadow-none transition-colors duration-300 hover:bg-secondary/5"
                  >
                    {t("login.switchToSignUp")}
                  </Button>
                </Show>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer class="bg-[rgba(237,244,255,0.55)] px-4 py-10 sm:px-6 sm:py-12">
        <div class="mx-auto flex max-w-5xl flex-col items-center gap-6">
          <nav class="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            <a
              href="#"
              class="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-300 hover:text-secondary"
            >
              Help Center
            </a>
            <a
              href="#"
              class="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-300 hover:text-secondary"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              class="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-300 hover:text-secondary"
            >
              Terms of Service
            </a>
            <a
              href="#"
              class="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-300 hover:text-secondary"
            >
              Accessibility
            </a>
          </nav>
          <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9ca3af]">
            © {loginPageYear} StoryWalkers Club. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
