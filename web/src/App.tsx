import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type AuthResult, type Me, type ProviderConfig } from "./api";
import { DeckApp } from "./deck";
import { LoveWait } from "./love";
import { showToast } from "./toast";

type DocName = "terms" | "privacy" | "cookies";
type Gender = "woman" | "man" | "nonbinary";
type Screen =
  | { name: "start" }
  | { name: "email" }
  | { name: "phone" }
  | { name: "code"; phone: string; devCode?: string }
  | { name: "onboarding" }
  | { name: "home" }
  | { name: "trouble" }
  | { name: "legal"; doc: DocName };

type Session = { token: string; user: Me };

const SESSION_KEY = "minglex.session";

const countries = [
  ["US", "+1"],
  ["CA", "+1"],
  ["UK", "+44"],
  ["NG", "+234"],
  ["GH", "+233"],
  ["KE", "+254"],
  ["ZA", "+27"],
  ["IN", "+91"],
  ["AU", "+61"],
  ["DE", "+49"],
  ["FR", "+33"],
  ["BR", "+55"],
] as const;

function loadSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function messageFrom(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Try again.";
}

function devIdentity(provider: "google" | "apple") {
  const key = `minglex.dev.${provider}`;
  const existing = localStorage.getItem(key);
  if (existing) {
    return JSON.parse(existing) as { subject: string; email: string; name: string };
  }
  const subject = crypto.randomUUID();
  const identity = {
    subject,
    email: `${provider}.${subject.slice(0, 8)}@dev.minglex.app`,
    name: "",
  };
  localStorage.setItem(key, JSON.stringify(identity));
  return identity;
}

function loadScript(src: string): Promise<void> {
  const found = document.querySelector(`script[src="${src}"]`);
  if (found) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Script failed to load"));
    document.head.appendChild(script);
  });
}

async function googleAccessToken(clientId: string): Promise<string> {
  await loadScript("https://accounts.google.com/gsi/client");
  const google = window.google;
  if (!google) throw new Error("Google sign-in failed to load");
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else reject(new Error(response.error ?? "Google sign-in was cancelled"));
      },
    });
    client.requestAccessToken();
  });
}

async function appleIdentityToken(clientId: string): Promise<{ identityToken: string; name?: string }> {
  await loadScript("https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js");
  const apple = window.AppleID;
  if (!apple) throw new Error("Apple sign-in failed to load");
  apple.auth.init({
    clientId,
    scope: "name email",
    redirectURI: window.location.origin,
    usePopup: true,
  });
  const result = await apple.auth.signIn();
  const first = result.user?.name?.firstName ?? "";
  const last = result.user?.name?.lastName ?? "";
  const name = `${first} ${last}`.trim();
  return { identityToken: result.authorization.id_token, name: name || undefined };
}

const existingSession = loadSession();

export default function App() {
  const [screen, setScreen] = useState<Screen>(() =>
    existingSession?.user.needsOnboarding ? { name: "onboarding" } : existingSession ? { name: "home" } : { name: "start" },
  );
  const [session, setSession] = useState<Session | null>(existingSession);
  const [providers, setProviders] = useState<ProviderConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<ProviderConfig>("/api/auth/providers")
      .then(setProviders)
      .catch(() => setProviders(null));
  }, []);

  function open(next: Screen) {
    setError("");
    setScreen(next);
  }

  function saveSession(result: AuthResult) {
    const next = { token: result.token, user: result.user };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
    open(result.needsOnboarding ? { name: "onboarding" } : { name: "home" });
  }

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError("");
    try {
      return await action();
    } catch (caught) {
      const message = messageFrom(caught);
      setError(message);
      showToast(message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function continueWith(provider: "google" | "apple") {
    await run(async () => {
      const config = providers ?? (await api<ProviderConfig>("/api/auth/providers"));
      setProviders(config);
      if (provider === "google" && config.google && config.googleClientId) {
        const accessToken = await googleAccessToken(config.googleClientId);
        saveSession(await api<AuthResult>("/api/auth/google", {
          method: "POST",
          body: JSON.stringify({ accessToken }),
        }));
        return;
      }
      if (provider === "apple" && config.apple && config.appleClientId) {
        const apple = await appleIdentityToken(config.appleClientId);
        saveSession(await api<AuthResult>("/api/auth/apple", {
          method: "POST",
          body: JSON.stringify(apple),
        }));
        return;
      }
      if (config.devPreview) {
        const identity = devIdentity(provider);
        saveSession(await api<AuthResult>(`/api/auth/dev/${provider}`, {
          method: "POST",
          body: JSON.stringify(identity),
        }));
        return;
      }
      throw new ApiError(503, `${provider === "google" ? "Google" : "Apple"} sign-in is not configured yet`);
    });
  }

  function signOut() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    open({ name: "start" });
  }

  return (
    <main className="screen">
      {busy && <LoveWait />}
      <section className={screen.name === "home" ? "panel deck-mode" : "panel"}>
        {screen.name === "start" && (
          <GetStarted
            busy={busy}
            error={error}
            showPreview={Boolean(providers?.devPreview && (!providers.google || !providers.apple))}
            onEmail={() => open({ name: "email" })}
            onPhone={() => open({ name: "phone" })}
            onGoogle={() => void continueWith("google")}
            onApple={() => void continueWith("apple")}
            onTrouble={() => open({ name: "trouble" })}
            onLegal={(doc) => open({ name: "legal", doc })}
          />
        )}
        {screen.name === "email" && (
          <EmailAuth
            busy={busy}
            error={error}
            onBack={() => open({ name: "start" })}
            onForgot={() => open({ name: "trouble" })}
            onSubmit={(body, mode) =>
              void run(async () => {
                const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
                saveSession(await api<AuthResult>(path, { method: "POST", body: JSON.stringify(body) }));
              })
            }
          />
        )}
        {screen.name === "phone" && (
          <PhoneAuth
            busy={busy}
            error={error}
            onBack={() => open({ name: "start" })}
            onSubmit={(phone) =>
              void run(async () => {
                const result = await api<{ devCode?: string }>("/api/auth/phone/send", {
                  method: "POST",
                  body: JSON.stringify({ phone }),
                });
                open({ name: "code", phone, devCode: result.devCode });
              })
            }
          />
        )}
        {screen.name === "code" && (
          <CodeAuth
            busy={busy}
            error={error}
            phone={screen.phone}
            devCode={screen.devCode}
            onBack={() => open({ name: "phone" })}
            onSubmit={(code) =>
              void run(async () => {
                saveSession(await api<AuthResult>("/api/auth/phone/verify", {
                  method: "POST",
                  body: JSON.stringify({ phone: screen.phone, code }),
                }));
              })
            }
          />
        )}
        {screen.name === "onboarding" && session && (
          <Onboarding
            busy={busy}
            error={error}
            onSubmit={(body) =>
              void run(async () => {
                const result = await api<{ user: Me }>("/api/me", {
                  method: "PATCH",
                  body: JSON.stringify(body),
                }, session.token);
                saveSession({ token: session.token, user: result.user, needsOnboarding: result.user.needsOnboarding });
              })
            }
          />
        )}
        {screen.name === "home" && session && <DeckApp token={session.token} onSignOut={signOut} />}
        {screen.name === "trouble" && (
          <Trouble
            busy={busy}
            error={error}
            onBack={() => open({ name: "start" })}
            onRequest={(email) =>
              run(async () => api<{ devCode?: string }>("/api/auth/password/forgot", {
                method: "POST",
                body: JSON.stringify({ email }),
              }))
            }
            onReset={(body) =>
              void run(async () => {
                saveSession(await api<AuthResult>("/api/auth/password/reset", {
                  method: "POST",
                  body: JSON.stringify(body),
                }));
              })
            }
          />
        )}
        {screen.name === "legal" && <Legal doc={screen.doc} onBack={() => open({ name: "start" })} />}
      </section>
    </main>
  );
}

function Mark() {
  return (
    <div className="mark" aria-hidden="true">
      <svg width="42" height="48" viewBox="0 0 42 48">
        <path
          fill="#1F6F54"
          d="M21 46C8 34 2 26 2 16 2 8 8 2 16 2c4 0 6 2 5 5-1 4 2 5 5 5 6 0 14 4 14 14 0 12-10 20-19 20z"
        />
      </svg>
    </div>
  );
}

function GetStarted(props: {
  busy: boolean;
  error: string;
  showPreview: boolean;
  onEmail: () => void;
  onPhone: () => void;
  onGoogle: () => void;
  onApple: () => void;
  onTrouble: () => void;
  onLegal: (doc: DocName) => void;
}) {
  return (
    <>
      <Mark />
      <h1>Get Started</h1>
      <p className="legal">
        By tapping Log in or Continue, you agree to the mingleX{" "}
        <button type="button" onClick={() => props.onLegal("terms")}>Terms</button>. Learn how we process your data in the{" "}
        <button type="button" onClick={() => props.onLegal("privacy")}>Privacy Policy</button> and{" "}
        <button type="button" onClick={() => props.onLegal("cookies")}>Cookie Policy</button>.
      </p>
      <div className="stack">
        {props.error && <p className="error">{props.error}</p>}
        <button className="auth-btn outline" type="button" disabled={props.busy} onClick={props.onEmail}>
          <MailIcon /> Log in with email
        </button>
        <button className="auth-btn google" type="button" disabled={props.busy} onClick={props.onGoogle}>
          <GoogleIcon /> Continue with Google
        </button>
        <button className="auth-btn apple" type="button" disabled={props.busy} onClick={props.onApple}>
          <AppleIcon /> Continue with Apple
        </button>
        <button className="auth-btn outline" type="button" disabled={props.busy} onClick={props.onPhone}>
          <PhoneIcon /> Log in with phone number
        </button>
      </div>
      <button className="trouble" type="button" onClick={props.onTrouble}>Trouble logging in?</button>
      <div className="grow" />
      {props.showPreview && (
        <p className="preview-note">Google and Apple use a local preview until their client IDs are added. The same account is used every time on this browser.</p>
      )}
      <div className="app-links">
        <h2>Get the app!</h2>
        <div className="badges">
          <div className="badge"><small>Download on the</small><strong>App Store</strong></div>
          <div className="badge"><small>Get it on</small><strong>Google Play</strong></div>
        </div>
      </div>
    </>
  );
}

function EmailAuth(props: {
  busy: boolean;
  error: string;
  onBack: () => void;
  onForgot: () => void;
  onSubmit: (body: Record<string, string>, mode: "login" | "register") => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<Gender>("woman");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "login") {
      props.onSubmit({ email, password }, mode);
      return;
    }
    props.onSubmit({ email, password, name, birthDate, gender }, mode);
  }

  return (
    <form className="stack" onSubmit={submit}>
      <button className="back" type="button" onClick={props.onBack} aria-label="Back">‹</button>
      <h1 className="form-title">{mode === "login" ? "Log in with email" : "Create account"}</h1>
      {props.error && <p className="error">{props.error}</p>}
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {mode === "register" && (
        <>
          <label>First name<input required maxLength={40} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Birthday<input type="date" required value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label>
          <GenderPicker value={gender} onChange={setGender} />
          <p className="preview-note">mingleX is for adults 18 and older.</p>
        </>
      )}
      <button className="submit" type="submit" disabled={props.busy}>{mode === "login" ? "Log in" : "Agree and continue"}</button>
      {mode === "login" && (
        <button className="switch" type="button" onClick={props.onForgot}>Forgot password?</button>
      )}
      <button
        className="switch"
        type="button"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
      </button>
    </form>
  );
}

function PhoneAuth(props: {
  busy: boolean;
  error: string;
  onBack: () => void;
  onSubmit: (phone: string) => void;
}) {
  const [code, setCode] = useState("+1");
  const [national, setNational] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const digits = national.replace(/\D/g, "").replace(/^0+/, "");
    props.onSubmit(`${code}${digits}`);
  }

  return (
    <form className="stack" onSubmit={submit}>
      <button className="back" type="button" onClick={props.onBack} aria-label="Back">‹</button>
      <h1 className="form-title">My number is</h1>
      {props.error && <p className="error">{props.error}</p>}
      <div className="phone-row">
        <select aria-label="Country code" value={code} onChange={(event) => setCode(event.target.value)}>
          {countries.map(([label, prefix]) => (
            <option key={`${label}${prefix}`} value={prefix}>{label} {prefix}</option>
          ))}
        </select>
        <input inputMode="tel" autoComplete="tel-national" required placeholder="Phone number" value={national} onChange={(event) => setNational(event.target.value)} />
      </div>
      <button className="submit" type="submit" disabled={props.busy}>Continue</button>
    </form>
  );
}

function CodeAuth(props: {
  busy: boolean;
  error: string;
  phone: string;
  devCode?: string;
  onBack: () => void;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit(code);
      }}
    >
      <button className="back" type="button" onClick={props.onBack} aria-label="Back">‹</button>
      <h1 className="form-title">Enter your code</h1>
      <p className="home-copy">We sent a 6-digit code to {props.phone}.</p>
      {props.devCode && <p className="dev-code">Development code: {props.devCode}</p>}
      {props.error && <p className="error">{props.error}</p>}
      <input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
      <button className="submit" type="submit" disabled={props.busy}>Continue</button>
    </form>
  );
}

function Onboarding(props: {
  busy: boolean;
  error: string;
  onSubmit: (body: { name: string; birthDate: string; gender: Gender }) => void;
}) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<Gender>("woman");
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit({ name, birthDate, gender });
      }}
    >
      <h1 className="form-title">Welcome</h1>
      {props.error && <p className="error">{props.error}</p>}
      <label>First name<input required maxLength={40} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Birthday<input type="date" required value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label>
      <GenderPicker value={gender} onChange={setGender} />
      <p className="preview-note">mingleX is for adults 18 and older.</p>
      <button className="submit" type="submit" disabled={props.busy}>Continue</button>
    </form>
  );
}

function GenderPicker(props: { value: Gender; onChange: (gender: Gender) => void }) {
  const options: { value: Gender; label: string }[] = [
    { value: "woman", label: "Woman" },
    { value: "man", label: "Man" },
    { value: "nonbinary", label: "Nonbinary" },
  ];
  return (
    <div>
      <p style={{ margin: "0 0 8px", fontWeight: 700 }}>I am</p>
      <div className="choices">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={props.value === option.value ? "choice selected" : "choice"}
            onClick={() => props.onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Trouble(props: {
  busy: boolean;
  error: string;
  onBack: () => void;
  onRequest: (email: string) => Promise<{ devCode?: string } | void>;
  onReset: (body: { email: string; code: string; password: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [devCode, setDevCode] = useState("");
  const [sent, setSent] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    const result = await props.onRequest(email);
    if (result) {
      setSent(true);
      setDevCode(result.devCode ?? "");
    }
  }

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        props.onReset({ email, code, password });
      }}
    >
      <button className="back" type="button" onClick={props.onBack} aria-label="Back">‹</button>
      <h1 className="form-title">Reset password</h1>
      <p className="home-copy">Enter the email on the account. We send a 6-digit code there. It expires in 10 minutes. Google, Apple, and phone sign-in still open the same profile.</p>
      {props.error && <p className="error">{props.error}</p>}
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <button className="auth-btn outline" type="button" disabled={props.busy} onClick={(event) => void requestCode(event)}>Send code</button>
      {sent && !devCode && <p className="home-copy">If that email is on mingleX, the code is in the inbox. It expires in 10 minutes.</p>}
      {devCode && <p className="dev-code">Development code: {devCode}</p>}
      <label>Code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <button className="submit" type="submit" disabled={props.busy || !sent}>Save password and sign in</button>
    </form>
  );
}

const legalText: Record<DocName, { title: string; paragraphs: string[] }> = {
  terms: {
    title: "Terms",
    paragraphs: [
      "mingleX is a dating service for adults 18 and older. If you are under 18, do not create an account.",
      "You are responsible for the photos and messages you send. Harassment, impersonation, and sexual content involving minors are not allowed.",
      "We can suspend an account that breaks these rules.",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    paragraphs: [
      "We store the profile details you give us, your likes, matches, and messages so the product can work.",
      "Google, Apple, and your phone carrier only confirm who you are. We keep the identifier they return and, when they share it, your email or phone number.",
      "You can ask an admin to ban or remove an account that should not be on mingleX.",
    ],
  },
  cookies: {
    title: "Cookie Policy",
    paragraphs: [
      "The website keeps your login session in session storage on this browser. That is how you stay signed in after a refresh.",
      "A local preview sign-in also stores a random id on this device so Google or Apple preview returns the same account.",
      "We do not use advertising cookies.",
    ],
  },
};

function Legal(props: { doc: DocName; onBack: () => void }) {
  const doc = legalText[props.doc];
  return (
    <div className="legal-copy">
      <button className="back" type="button" onClick={props.onBack} aria-label="Back">‹</button>
      <h1>{doc.title}</h1>
      {doc.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    </div>
  );
}

function MailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Zm1.8.3 7.2 5.1 7.2-5.1H4.8ZM19.5 8.2l-7.1 5a.8.8 0 0 1-.8 0l-7.1-5V17.5c0 .3.2.5.5.5h13c.3 0 .5-.2.5-.5V8.2Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8.2 3.5c.4-.4 1-.5 1.5-.2l2.2 1.3c.5.3.8.9.6 1.4l-.8 2.2a1.2 1.2 0 0 1-1.1.8c-.3 1.4.2 3 1.5 4.3 1.3 1.3 2.9 1.8 4.3 1.5.5-.1 1 .1 1.2.6l1.1 2.1c.3.5.2 1.1-.2 1.5l-1.6 1.4c-.5.4-1.2.6-1.8.4C10.4 20 4 13.6 3.2 8.7c-.2-.6 0-1.3.4-1.8l1.6-1.4.1-.1 2.9-2Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true">
      <path fill="currentColor" d="M14.7 11.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 2.9 2.3 1.1 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.4-.9-2.5-3.9ZM12.6 4.8c.6-.8 1.1-1.9.9-3-1 .1-2.1.6-2.8 1.4-.6.7-1.2 1.8-.9 2.9 1.1.1 2.1-.5 2.8-1.3Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
      <path fill="#fff" d="M12 22c2.7 0 5-0.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#fff" d="M6.4 13.9A6 6 0 0 1 6.1 12c0-.7.1-1.3.3-1.9V7.5H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.5l3.3-2.6Z" />
      <path fill="#fff" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6.1 12 6.1Z" />
    </svg>
  );
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }) => void;
        signIn: () => Promise<{
          authorization: { id_token: string };
          user?: { name?: { firstName?: string; lastName?: string } };
        }>;
      };
    };
  }
}
