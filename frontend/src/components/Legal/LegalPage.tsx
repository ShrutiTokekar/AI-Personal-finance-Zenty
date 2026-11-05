import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LogoMark } from '../ui';

/* ------------------------------------------------------------------ */
/* Details to confirm before relying on these documents.               */
/* ------------------------------------------------------------------ */
const COMPANY = 'Zenty';
const SITE = 'www.zentyai.com';
const CONTACT = 'privacy@zentyai.com';
const SUPPORT = 'support@zentyai.com';
const LAST_UPDATED = 'November 3, 2026';

type Doc = 'privacy' | 'terms';

const H2 = ({ id, children }: { id: string; children: ReactNode }) => (
  <h2 id={id} className="scroll-mt-24 pt-10 font-display text-2xl font-semibold tracking-tight text-ink first:pt-0">{children}</h2>
);
const P = ({ children }: { children: ReactNode }) => <p className="mt-4 leading-relaxed text-gray-700">{children}</p>;
const UL = ({ children }: { children: ReactNode }) => <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed text-gray-700 marker:text-primary-500">{children}</ul>;
const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className="font-medium text-primary-700 underline decoration-primary-300 underline-offset-2 hover:text-primary-900"
    {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>{children}</a>
);

function Privacy() {
  const toc = [
    ['summary', 'The short version'], ['collect', 'Information we collect'], ['use', 'How we use it'],
    ['share', 'Who we share it with'], ['plaid', 'Bank connections (Plaid)'], ['cookies', 'Cookies and local storage'],
    ['security', 'How we protect it'], ['retention', 'How long we keep it'], ['rights', 'Your choices and rights'],
    ['children', 'Children'], ['international', 'International users'], ['changes', 'Changes to this policy'], ['contact', 'Contact us'],
  ];
  return (
    <>
      <Toc items={toc} />
      <H2 id="summary">The short version</H2>
      <UL>
        <li>We collect what we need to run {COMPANY}: your account details and the financial information you add or choose to connect.</li>
        <li><strong>We never sell your personal information, and we don't show ads.</strong></li>
        <li>Your bank login is entered only with Plaid, never with us. We don't see or store your bank username or password.</li>
        <li>Only you can see your financial data. You can download or permanently delete it at any time from Settings.</li>
      </UL>

      <H2 id="collect">Information we collect</H2>
      <P><strong>Information you give us</strong></P>
      <UL>
        <li><strong>Account details:</strong> your name, email address, password and, if you choose to add one, a mobile phone number. We store passwords only as a one-way Argon2id hash, never in readable form.</li>
        <li><strong>Financial information you enter:</strong> transactions, budgets, savings goals, stock holdings, subscriptions, and your settings and preferences.</li>
        <li><strong>Messages to the assistant:</strong> what you type into the Zenty Assistant or quick-add bar, which we process to carry out your request (for example, logging an expense).</li>
        <li><strong>Support messages:</strong> anything you send us when you contact us.</li>
      </UL>
      <P><strong>Information from services you connect</strong></P>
      <UL>
        <li><strong>Google:</strong> if you sign in with Google, we receive your name, email address and a Google account identifier. We don't receive your Google password or access your other Google data.</li>
        <li><strong>Your bank, through Plaid:</strong> if you link an account, we receive account names, account type, the last four digits of the account number, balances and transaction history. See <A href="#plaid">Bank connections</A>.</li>
      </UL>
      <P><strong>Information collected automatically</strong></P>
      <UL>
        <li><strong>Sign-in and security data:</strong> your browser and device type (from your browser's user-agent) for each signed-in session and for a log of security activity (such as sign-ins and password changes) that you can see in Settings, and your IP address, which we use briefly to limit repeated sign-in attempts and protect against abuse. We don't store IP addresses in the security log.</li>
        <li><strong>Service logs:</strong> our hosting provider keeps technical logs (such as request times and errors) to operate and secure the service.</li>
      </UL>
      <P>We don't use advertising or third-party analytics trackers.</P>

      <H2 id="use">How we use your information</H2>
      <UL>
        <li>To provide {COMPANY}: show your dashboard, Zen Score, budgets, goals, subscriptions, insights and the assistant's answers.</li>
        <li>To keep your account secure: verify your email, send sign-in codes, detect suspicious activity and prevent fraud.</li>
        <li>To send you service messages: welcome and verification emails, password resets, security codes by text message, and stock alerts if you turn them on.</li>
        <li>To fix problems, maintain and improve the service.</li>
        <li>To comply with the law and enforce our <A href="/terms">Terms of Service</A>.</li>
      </UL>
      <P>We don't use your financial data for advertising, and we don't sell it or share it for others' marketing.</P>

      <H2 id="share">Who we share it with</H2>
      <P>We share information only with service providers that help us run {COMPANY}, and only what each needs to do its job:</P>
      <UL>
        <li><strong>Vercel</strong> hosts our website and servers.</li>
        <li><strong>Neon</strong> hosts our encrypted database.</li>
        <li><strong>Plaid</strong> connects your bank accounts, if you choose to link them.</li>
        <li><strong>Resend</strong> delivers our emails.</li>
        <li><strong>Twilio</strong> delivers text-message security codes, only if that feature is switched on.</li>
        <li><strong>Google</strong> provides "Sign in with Google", if you use it.</li>
      </UL>
      <P>To show stock prices, we request market data for the ticker symbols in your portfolio. Those requests contain the symbols only, never your name or account details.</P>
      <P>We may also disclose information if required by law, to protect the rights, safety or property of our users or others, or as part of a merger, acquisition or sale of assets, in which case this policy will continue to apply to your information.</P>

      <H2 id="plaid">Bank connections (Plaid)</H2>
      <P>
        {COMPANY} uses Plaid Inc. ("Plaid") to connect to your financial institutions. When you link an account, you enter your bank credentials
        directly in Plaid's secure window; we never see or store them. By linking an account, you authorize {COMPANY} and Plaid to access and
        transfer your account and transaction information from your bank, and you acknowledge Plaid's handling of your data under the{' '}
        <A href="https://plaid.com/legal/#end-user-privacy-policy">Plaid End User Privacy Policy</A>.
      </P>
      <P>
        Plaid gives our server an access key for your connection. We encrypt it before storing it, and it's never sent to your browser.
        You can disconnect a bank at any time from the Accounts page, which revokes our access with Plaid.
      </P>

      <H2 id="cookies">Cookies and local storage</H2>
      <P>We use only cookies that are strictly necessary for {COMPANY} to work:</P>
      <UL>
        <li><strong>zenty_session</strong> keeps you signed in. It can't be read by page scripts, and your session ends after 15 minutes without activity, after 12 hours at most, or when you sign out.</li>
        <li><strong>zenty_csrf</strong> protects your account from cross-site request attacks.</li>
      </UL>
      <P>We also save two small items in your browser's local storage: whether privacy mode (which hides amounts) is on, and the time of your last activity, so all your open Zenty tabs sign out together. We don't use advertising or tracking cookies.</P>

      <H2 id="security">How we protect your information</H2>
      <UL>
        <li>All traffic is encrypted with HTTPS.</li>
        <li>Passwords are hashed with Argon2id; bank access keys are encrypted before storage.</li>
        <li>Sign-in is protected by rate limits, account lockout after repeated failures, and optional two-step sign-in with an authenticator app (with email codes and one-time backup codes as fallbacks). You're signed out automatically after 15 minutes of inactivity, and we email you about new sign-ins and security changes.</li>
        <li>Phone numbers and authenticator-app secrets are encrypted in our database; backup codes are stored only as one-way hashes.</li>
        <li>Every record is tied to your account, and our systems check that you own it before showing or changing it.</li>
      </UL>
      <P>No method of transmission or storage is completely secure, but we work hard to protect your information and will notify you if a breach affects you, as required by law.</P>

      <H2 id="retention">How long we keep it</H2>
      <UL>
        <li>We keep your account and financial data for as long as your account is open.</li>
        <li>When you delete your account in Settings, we delete your data from our live systems right away and revoke any bank connections. Copies may remain in encrypted backups for a limited time before they are overwritten.</li>
        <li>Records used to limit sign-in attempts are removed within about two days. Expired sign-in sessions are cleaned up automatically. Security activity records are kept for 180 days.</li>
        <li>We may keep limited information longer if the law requires it.</li>
      </UL>

      <H2 id="rights">Your choices and rights</H2>
      <UL>
        <li><strong>Access and download:</strong> use <em>Settings → Privacy &amp; data → Download my data</em> to get a copy of your information.</li>
        <li><strong>Correct:</strong> update your profile, phone number and other details in Settings, and edit or delete any transaction.</li>
        <li><strong>Delete:</strong> use <em>Settings → Delete account</em> to permanently delete your account and data.</li>
        <li><strong>Disconnect banks:</strong> remove any linked bank from the Accounts page at any time.</li>
        <li><strong>Emails and texts:</strong> turn off stock alerts in Settings. Security messages (like verification and sign-in codes) are part of the service.</li>
      </UL>
      <P>
        Depending on where you live (for example, under the GDPR in the EU/UK or the CCPA in California), you may have additional rights, such as
        objecting to or restricting certain processing. To exercise any right, email <A href={`mailto:${CONTACT}`}>{CONTACT}</A>. We'll respond within the time
        required by law and won't treat you differently for exercising your rights. We do not sell or share personal information as those terms are defined
        under California law.
      </P>

      <H2 id="children">Children</H2>
      <P>{COMPANY} is not intended for anyone under 18, and we don't knowingly collect information from children. If you believe a child has given us information, contact us and we'll delete it.</P>

      <H2 id="international">International users</H2>
      <P>Our service providers may process your information in the United States and other countries. Where required, we rely on appropriate safeguards for these transfers.</P>

      <H2 id="changes">Changes to this policy</H2>
      <P>We may update this policy from time to time. If we make significant changes, we'll let you know by email or in the app before they take effect. The date at the top shows when it was last updated.</P>

      <H2 id="contact">Contact us</H2>
      <P>Questions about your privacy? Email <A href={`mailto:${CONTACT}`}>{CONTACT}</A>.</P>
    </>
  );
}

function Terms() {
  const toc = [
    ['agreement', 'Agreement'], ['eligibility', 'Who can use Zenty'], ['account', 'Your account'], ['service', 'What Zenty is (and isn\'t)'],
    ['bank', 'Bank connections'], ['messages', 'Emails and text messages'], ['acceptable', 'Acceptable use'], ['content', 'Your content'],
    ['third', 'Third-party services'], ['changes-service', 'Changes and availability'], ['termination', 'Ending your account'],
    ['disclaimers', 'Disclaimers'], ['liability', 'Limitation of liability'], ['indemnity', 'Indemnity'], ['law', 'Governing law and disputes'],
    ['changes-terms', 'Changes to these terms'], ['contact', 'Contact'],
  ];
  return (
    <>
      <Toc items={toc} />
      <H2 id="agreement">Agreement</H2>
      <P>
        These Terms of Service ("Terms") are an agreement between you and {COMPANY} ("we", "us") about your use of {SITE} and our related
        services (the "Service"). By creating an account or using the Service, you agree to these Terms and to our <A href="/privacy">Privacy Policy</A>.
        If you don't agree, please don't use the Service.
      </P>

      <H2 id="eligibility">Who can use Zenty</H2>
      <P>You must be at least 18 years old and able to form a binding contract to use the Service. You may only use the Service for your own personal, non-commercial purposes.</P>

      <H2 id="account">Your account</H2>
      <UL>
        <li>Give us accurate information and keep it up to date, including your email address and, if provided, your mobile number.</li>
        <li>Keep your password, sign-in codes and backup codes private, and don't share your account. You're responsible for activity under your account.</li>
        <li>Tell us right away at <A href={`mailto:${SUPPORT}`}>{SUPPORT}</A> if you think someone has accessed your account without permission.</li>
      </UL>

      <H2 id="service">What Zenty is (and isn't)</H2>
      <P>{COMPANY} is a personal finance tool that helps you track spending, budgets, savings goals, subscriptions and investments.</P>
      <UL>
        <li><strong>Not a bank.</strong> We don't hold your money, move funds or provide banking, payment or brokerage services.</li>
        <li><strong>Not financial advice.</strong> The Zen Score, safe-to-spend amount, predictions, budget and goal plans, assistant replies and other insights are general information based on the data you provide. They aren't financial, investment, tax or legal advice. Consider your own situation, and consult a qualified professional before making financial decisions.</li>
        <li><strong>Data may be incomplete or delayed.</strong> Bank data depends on your institution and Plaid, and stock prices may be delayed. Always check important figures with your bank or broker.</li>
      </UL>

      <H2 id="bank">Bank connections</H2>
      <P>
        If you link a financial account, you authorize us and our provider Plaid to access your account information on your behalf, and you agree to
        Plaid's terms, including the <A href="https://plaid.com/legal/#end-user-privacy-policy">Plaid End User Privacy Policy</A>. You must be authorized to
        access any account you connect. You can disconnect at any time from the Accounts page.
      </P>

      <H2 id="messages">Emails and text messages</H2>
      <P>
        By providing your email address (and, if you choose, a mobile number), you agree that we may send you service messages, including account verification, sign-in
        codes and security notices, and stock alerts if you turn them on. If text messages are used, they are only for verification and sign-in codes. Message
        frequency varies; message and data rates may apply. You can turn off optional emails in Settings. Security messages are needed to use the Service.
      </P>

      <H2 id="acceptable">Acceptable use</H2>
      <P>You agree not to:</P>
      <UL>
        <li>break the law, or use the Service for fraud or to process someone else's financial information without their permission;</li>
        <li>try to access other users' data or accounts, or probe, scan or test the Service's security without our written permission;</li>
        <li>interfere with or overload the Service, including through automated scraping, bots or excessive requests;</li>
        <li>reverse engineer the Service, except where the law allows it; or</li>
        <li>upload malicious code or misuse the assistant, sign-up or messaging features.</li>
      </UL>

      <H2 id="content">Your content</H2>
      <P>
        The information you add to {COMPANY} stays yours. You give us permission to store and process it only to provide and improve the Service for you,
        as described in our Privacy Policy. You can download or delete it at any time. The Service itself, including our software, design, logo and
        name, belongs to us and is protected by law.
      </P>

      <H2 id="third">Third-party services</H2>
      <P>The Service relies on third parties such as Plaid, Google, Resend, Twilio and market-data providers. Their services are governed by their own terms, and we're not responsible for their availability or accuracy.</P>

      <H2 id="changes-service">Changes and availability</H2>
      <P>We may add, change or remove features. We aim to keep the Service available but can't promise it will always be uninterrupted or error-free, and we may pause it for maintenance or security reasons.</P>

      <H2 id="termination">Ending your account</H2>
      <P>
        You can delete your account at any time from Settings. We may suspend or close your account if you break these Terms, if required by law, or to
        protect the Service or other users. Sections that by their nature should survive (such as disclaimers, limits on liability and governing law) continue
        to apply after your account ends.
      </P>

      <H2 id="disclaimers">Disclaimers</H2>
      <P>
        To the fullest extent permitted by law, the Service is provided "as is" and "as available", without warranties of any kind, whether express or implied,
        including warranties of merchantability, fitness for a particular purpose, accuracy and non-infringement.
      </P>

      <H2 id="liability">Limitation of liability</H2>
      <P>
        To the fullest extent permitted by law, {COMPANY} won't be liable for any indirect, incidental, special, consequential or punitive damages, or for any loss
        of profits, data or savings, or for financial decisions you make based on the Service. Our total liability for any claim relating to the Service is limited
        to the greater of the amount you paid us in the 12 months before the claim, or US$100. Some places don't allow these limits, so they may not apply to you.
      </P>

      <H2 id="indemnity">Indemnity</H2>
      <P>You agree to cover reasonable losses and costs (including legal fees) arising from your misuse of the Service or breach of these Terms, to the extent permitted by law.</P>

      <H2 id="law">Governing law and disputes</H2>
      <P>
        These Terms are governed by the laws of the jurisdiction where {COMPANY}'s operator is established, without regard to conflict-of-law rules, and
        any disputes will be handled in its courts, unless the law where you live gives you the right to bring claims locally. Before filing a claim,
        please contact us at <A href={`mailto:${SUPPORT}`}>{SUPPORT}</A> so we can try to resolve it informally.
      </P>

      <H2 id="changes-terms">Changes to these terms</H2>
      <P>We may update these Terms. If changes are significant, we'll notify you by email or in the app before they take effect. Continuing to use the Service after that means you accept the updated Terms.</P>

      <H2 id="contact">Contact</H2>
      <P>Questions about these Terms? Email <A href={`mailto:${SUPPORT}`}>{SUPPORT}</A>.</P>
    </>
  );
}

function Toc({ items }: { items: string[][] }) {
  return (
    <nav aria-label="On this page" className="mb-10 rounded-2xl border border-line bg-white p-5">
      <p className="eyebrow">On this page</p>
      <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {items.map(([id, label], i) => (
          <li key={id}><a href={`#${id}`} className="text-gray-600 hover:text-primary-700"><span className="num mr-2 text-gray-400">{i + 1}.</span>{label}</a></li>
        ))}
      </ol>
    </nav>
  );
}

export default function LegalPage({ doc, onBack, onSwitch }: { doc: Doc; onBack: () => void; onSwitch: (d: Doc) => void }) {
  const title = doc === 'privacy' ? 'Privacy Policy' : 'Terms of Service';
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <span className="font-display text-xl font-semibold text-ink">Zenty</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12">
        <p className="eyebrow text-primary-600">Legal</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{title}</h1>
        <p className="mt-3 text-gray-500">Last updated {LAST_UPDATED}</p>
        <div className="mt-6 flex gap-2 text-sm">
          {(['privacy', 'terms'] as Doc[]).map((d) => (
            <button key={d} onClick={() => onSwitch(d)} aria-current={d === doc ? 'page' : undefined}
              className={`rounded-full px-4 py-1.5 font-semibold transition ${d === doc ? 'bg-ink text-white' : 'border border-line bg-white text-gray-600 hover:text-ink'}`}>
              {d === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
            </button>
          ))}
        </div>
        <article className="mt-10">{doc === 'privacy' ? <Privacy /> : <Terms />}</article>
      </main>
      <footer className="border-t border-line">
        <p className="mx-auto max-w-3xl px-5 py-8 text-sm text-gray-500">© {new Date().getFullYear()} {COMPANY}. {COMPANY} is not a bank and does not give financial advice.</p>
      </footer>
    </div>
  );
}
