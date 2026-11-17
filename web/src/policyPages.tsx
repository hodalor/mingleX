import type { ReactNode } from "react";

type PolicyPage = {
  path: string;
  title: string;
  body: ReactNode;
};

const privacy: PolicyPage = {
  path: "/privacy",
  title: "Privacy Policy",
  body: (
    <>
      <p>Last updated: 16 November 2026</p>
      <p>
        mingleX (“we”, “us”) is a dating service for adults 18 and older. This policy explains what we collect,
        why we collect it, and the choices you have.
      </p>
      <h2>Information we collect</h2>
      <p>
        Account details you provide (name, email, phone, birth date, gender), profile content (photos, videos,
        bio, interests, location when you allow it), and activity needed to run the product (likes, matches,
        messages, reports, and device tokens for notifications).
      </p>
      <p>
        When you sign in with Google, Apple, or phone SMS, those providers confirm who you are. We store the
        identifier they return and, when they share it, your email or phone number.
      </p>
      <h2>How we use information</h2>
      <p>
        We use your data to create and secure your account, show you nearby people, power likes and messages,
        process payments (for example Paystack), send account or match alerts, and keep the community safe
        (moderation, bans, and fraud checks).
      </p>
      <h2>Sharing</h2>
      <p>
        Other members see the profile you publish. We use service providers that process data for us (hosting,
        database, authentication, storage, email/SMS, and payments). We do not sell your personal information.
      </p>
      <h2>Retention and deletion</h2>
      <p>
        You can delete your account anytime from Settings → Delete my account in the app or website, or follow
        the steps at <a href="/delete">/delete</a>. After you delete, you can no longer sign in and you leave
        discovery. Staff may keep a limited deleted-account record for safety, legal, and audit reasons.
      </p>
      <h2>Contact</h2>
      <p>
        Privacy questions: <a href="mailto:princehodalor@gmail.com">princehodalor@gmail.com</a>
      </p>
    </>
  ),
};

const terms: PolicyPage = {
  path: "/tandc",
  title: "Terms and Conditions",
  body: (
    <>
      <p>Last updated: 16 November 2026</p>
      <p>
        By creating a mingleX account or using the app or website, you agree to these Terms. If you do not agree,
        do not use mingleX.
      </p>
      <h2>Eligibility</h2>
      <p>You must be at least 18 years old. Accounts for anyone under 18 are not allowed and will be removed.</p>
      <h2>Your account</h2>
      <p>
        Keep your login details safe. You are responsible for activity on your account. Provide accurate profile
        information and only upload media you have the right to use.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not harass, threaten, scam, impersonate others, spam, or share illegal or non-consensual sexual content.
        Sexual content involving minors is strictly forbidden. We may suspend or ban accounts that break these rules.
      </p>
      <h2>Paid features</h2>
      <p>
        Some features may require payment (for example mingleX Plus via Paystack). Prices and availability can
        change. Taxes may apply. Refunds follow the payment provider’s rules and applicable law.
      </p>
      <h2>Ending your account</h2>
      <p>
        You may delete your account at any time. See <a href="/delete">How to delete your account</a>. We may
        suspend or terminate accounts that violate these Terms or create safety risk.
      </p>
      <h2>Disclaimers</h2>
      <p>
        mingleX is provided as available. We do not guarantee matches, messages, or uninterrupted service. To the
        fullest extent allowed by law, we are not liable for disputes between members or indirect damages.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about these Terms: <a href="mailto:princehodalor@gmail.com">princehodalor@gmail.com</a>
      </p>
    </>
  ),
};

const deleteGuide: PolicyPage = {
  path: "/delete",
  title: "Delete your mingleX account",
  body: (
    <>
      <p>
        You can permanently leave mingleX yourself. After deletion you cannot sign in, you leave discovery, and
        your profile is no longer shown to other members. Staff may retain a limited record for safety and audit.
      </p>
      <h2>On the website</h2>
      <ol>
        <li>Sign in at the mingleX website.</li>
        <li>Open Settings, or tap the ··· menu → Delete my account.</li>
        <li>Confirm deletion. You will be signed out immediately.</li>
      </ol>
      <h2>On Android</h2>
      <ol>
        <li>Open the mingleX app and sign in.</li>
        <li>Go to Settings, or open the ··· menu → Delete my account.</li>
        <li>Confirm deletion. You will be signed out immediately.</li>
      </ol>
      <h2>Need help?</h2>
      <p>
        If you cannot access your account, email{" "}
        <a href="mailto:princehodalor@gmail.com">princehodalor@gmail.com</a> from the address on the account and
        ask us to delete it. We will verify ownership before removing access.
      </p>
      <p>
        Related: <a href="/privacy">Privacy Policy</a> · <a href="/tandc">Terms and Conditions</a>
      </p>
    </>
  ),
};

const pages = [privacy, terms, deleteGuide];

export function matchPolicyPath(pathname: string): PolicyPage | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return pages.find((page) => page.path === clean) ?? null;
}

export function PolicyShell(props: { page: PolicyPage }) {
  return (
    <main className="screen">
      <article className="panel policy-page">
        <a className="policy-home" href="/">← mingleX</a>
        <h1>{props.page.title}</h1>
        <div className="policy-body">{props.page.body}</div>
      </article>
    </main>
  );
}
