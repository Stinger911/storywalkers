import { Show, createSignal } from "solid-js";
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

    case "auth/user-not-found":
    case "auth/wrong-password":
      return t("login.errors.wrongPassword");

    case "auth/too-many-requests":
      return t("login.errors.tooManyRequests");

    case "auth/missing-email":
      return t("login.errors.missingEmail");

    case "auth/email-already-in-use":
      return t("login.errors.emailAlreadyInUse");

    case "auth/weak-password":
      return t("login.errors.weakPassword");

    default:
      return e.message
        ? t("login.errors.genericWithMessage", { message: e.message })
        : t("login.errors.generic");
  }
}

export function Login() {
  const { t, locale, setLocale } = useI18n();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const [info, setInfo] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const pendingPasswordStorageKey = "pendingPasswordForSignIn";

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
        window.location.href = "/student/home";
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

  // запуск авто-завершения email-link логина при заходе по ссылке
  // (без onMount, чтобы избежать лишних импортов; Solid выполнит один раз при инициализации компонента)
  void redirectIfLoggedIn(true);
  void tryCompleteEmailLinkSignIn();

  return (
    <div class="min-h-screen grid place-items-center p-6">
      <Card class="w-full max-w-md">
        <CardHeader>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{t("login.title")}</CardTitle>
              <CardDescription>{t("login.subtitle")}</CardDescription>
            </div>
            <div class="min-w-[140px]">
              <Select
                value={{ value: locale(), label: locale() === "ru" ? "Русский" : "English" }}
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
                  <SelectItem item={props.item}>
                    {(props.item.rawValue as unknown as { label: string }).label}
                  </SelectItem>
                )}
              >
                <SelectLabel for="login-language">{t("common.language")}</SelectLabel>
                <SelectHiddenSelect id="login-language" />
                <SelectTrigger aria-label={t("common.language")}>
                  <SelectValue<string>>
                    {(state) =>
                      (
                        (state?.selectedOption() || {}) as unknown as {
                          label: string;
                        }
                      ).label ?? t("common.language")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent class="grid gap-4">
          <Show when={info()}>
            <div class="rounded-md border p-3 text-sm">{info()}</div>
          </Show>

          <Show when={error()}>
            <div class="rounded-md border p-3 text-sm">{error()}</div>
          </Show>

          <TextField class="grid gap-2">
            <TextFieldLabel for="email">{t("login.emailLabel")}</TextFieldLabel>
            <TextFieldInput
              id="email"
              type="email"
              placeholder={t("login.emailPlaceholder")}
              value={email()}
              onInput={(e: { currentTarget: { value: any } }) =>
                setEmail(e.currentTarget.value)
              }
              autocomplete="email"
            />
          </TextField>

          <TextField class="grid gap-2">
            <TextFieldLabel for="password">{t("login.passwordLabel")}</TextFieldLabel>
            <TextFieldInput
              id="password"
              type="password"
              placeholder={t("login.passwordPlaceholder")}
              value={password()}
              onInput={(e: { currentTarget: { value: any } }) =>
                setPassword(e.currentTarget.value)
              }
              autocomplete="current-password"
            />
          </TextField>

          <div class="flex justify-end">
            <button
              type="button"
              class="text-sm text-primary underline-offset-4 hover:underline disabled:opacity-50"
              disabled={busy()}
              onClick={onPasswordReset}
            >
              {t("login.forgotPassword")}
            </button>
          </div>

          <div class="grid gap-2">
            <Button disabled={busy()} onClick={onEmailPasswordLogin}>
              {t("login.signInPassword")}
            </Button>

            <Button
              disabled={busy()}
              variant="outline"
              onClick={onEmailPasswordRegister}
            >
              {t("login.createAccount")}
            </Button>
          </div>

          <div class="grid gap-2">
            <Button
              disabled={busy()}
              variant="outline"
              onClick={onSendEmailLink}
            >
              {t("login.sendLink")}
            </Button>
          </div>

          <div class="relative my-2">
            <div class="absolute inset-0 flex items-center">
              <span class="w-full border-t" />
            </div>
            <div class="relative flex justify-center text-xs uppercase">
              <span class="bg-background px-2 text-muted-foreground">
                {t("login.or")}
              </span>
            </div>
          </div>

          <Button disabled={busy()} onClick={onGoogleLogin}>
            {t("login.continueGoogle")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
