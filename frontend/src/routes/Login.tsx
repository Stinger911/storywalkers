import { Show, createSignal } from "solid-js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  fetchSignInMethodsForEmail,
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

function friendlyAuthError(err: unknown): string {
  const e = err as Partial<FirebaseError> & { code?: string; message?: string };

  switch (e.code) {
    case "auth/unauthorized-domain":
      return "Google login недоступен для этого домена. Добавь текущий домен (например, localhost или твой прод-домен) в Firebase Console → Authentication → Settings → Authorized domains.";

    case "auth/account-exists-with-different-credential":
      return "Аккаунт с этим email уже существует, но использует другой способ входа. Войди тем способом, который ты использовал ранее (например, Email/Password или Email link), а затем привяжи Google в настройках профиля.";

    case "auth/popup-closed-by-user":
      return "Окно входа было закрыто. Попробуй ещё раз.";

    case "auth/invalid-email":
      return "Некорректный email.";

    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Неверный email или пароль.";

    case "auth/too-many-requests":
      return "Слишком много попыток. Подожди немного и попробуй снова.";

    case "auth/missing-email":
      return "Укажи email.";

    default:
      return e.message
        ? `Ошибка входа: ${e.message}`
        : "Не удалось выполнить вход. Попробуй ещё раз.";
  }
}

export function Login() {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const [info, setInfo] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

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
      setInfo("Успешный вход.");
      await redirectIfLoggedIn();
    } catch (e) {
      setError(friendlyAuthError(e));
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
      await createUserWithEmailAndPassword(auth, email().trim(), password());
      setInfo("Аккаунт создан и выполнен вход.");
      await redirectIfLoggedIn();
    } catch (e) {
      setError(friendlyAuthError(e));
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
      setInfo("Успешный вход через Google.");
      await redirectIfLoggedIn();
    } catch (e) {
      setError(friendlyAuthError(e));
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
        setInfo(
          "Мы отправим ссылку для входа. Если раньше ты входил паролем или Google — это тоже нормально.",
        );
      }

      await sendSignInLinkToEmail(auth, e, actionCodeSettings());
      // надо сохранить email локально, чтобы подтвердить вход после перехода по ссылке
      window.localStorage.setItem("emailForSignIn", e);
      setInfo(
        "Ссылка для входа отправлена на email. Открой письмо и перейди по ссылке.",
      );
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  // redirect to dashboard if already logged in
  async function redirectIfLoggedIn() {
    const response = await apiFetch("/api/me");
    if (response.ok) {
      const data = (await response.json()) as MeProfile;
      if (!data) {
        setError("Не удалось получить профиль пользователя после входа.");
        return;
      }
      if (!data.role) {
        setError("Неверная роль пользователя.");
        return;
      }
      if (data.role === "staff") {
        window.location.href = "/admin/home";
      } else {
        window.location.href = "/student/home";
      }
    } else {
      setError("Не удалось получить профиль пользователя после входа.");
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
        setError(
          "Введите email, на который пришла ссылка (мы не нашли сохранённый email в браузере).",
        );
        return;
      }

      await signInWithEmailLink(auth, e, window.location.href);
      window.localStorage.removeItem("emailForSignIn");

      // Чтобы не оставлять query-параметры от email-link в адресе:
      window.history.replaceState({}, document.title, "/login");
      setInfo("Успешный вход по ссылке.");
      await redirectIfLoggedIn();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  // запуск авто-завершения email-link логина при заходе по ссылке
  // (без onMount, чтобы избежать лишних импортов; Solid выполнит один раз при инициализации компонента)
  void redirectIfLoggedIn();
  void tryCompleteEmailLinkSignIn();

  return (
    <div class="min-h-screen grid place-items-center p-6">
      <Card class="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Email/Password, Email link или Google
          </CardDescription>
        </CardHeader>

        <CardContent class="grid gap-4">
          <Show when={info()}>
            <div class="rounded-md border p-3 text-sm">{info()}</div>
          </Show>

          <Show when={error()}>
            <div class="rounded-md border p-3 text-sm">{error()}</div>
          </Show>

          <TextField class="grid gap-2">
            <TextFieldLabel for="email">Email</TextFieldLabel>
            <TextFieldInput
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email()}
              onInput={(e: { currentTarget: { value: any } }) =>
                setEmail(e.currentTarget.value)
              }
              autocomplete="email"
            />
          </TextField>

          <TextField class="grid gap-2">
            <TextFieldLabel for="password">Password</TextFieldLabel>
            <TextFieldInput
              id="password"
              type="password"
              placeholder="••••••••"
              value={password()}
              onInput={(e: { currentTarget: { value: any } }) =>
                setPassword(e.currentTarget.value)
              }
              autocomplete="current-password"
            />
          </TextField>

          <div class="grid gap-2">
            <Button disabled={busy()} onClick={onEmailPasswordLogin}>
              Sign in with password
            </Button>

            <Button
              disabled={busy()}
              variant="outline"
              onClick={onEmailPasswordRegister}
            >
              Create account (email/password)
            </Button>
          </div>

          <div class="grid gap-2">
            <Button
              disabled={busy()}
              variant="outline"
              onClick={onSendEmailLink}
            >
              Send sign-in link (passwordless)
            </Button>
          </div>

          <div class="relative my-2">
            <div class="absolute inset-0 flex items-center">
              <span class="w-full border-t" />
            </div>
            <div class="relative flex justify-center text-xs uppercase">
              <span class="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button disabled={busy()} onClick={onGoogleLogin}>
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
