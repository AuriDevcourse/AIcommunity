import { ArrowLeft, Shield, FileText, Accessibility } from 'lucide-react';

// AI Workshop is a small community dashboard. Operator + contact for the
// compliance trio (privacy / terms / accessibility). Edit these in one place.
const CONTACT = 'baciauskas.aurimas@gmail.com';
const OPERATOR = 'the AI Workshop community (Aurimas Baciauskas), Copenhagen, Denmark';
const EFFECTIVE = '5 June 2026';

const PAGES = {
  privacy: { title: 'Privacy Policy', icon: Shield },
  terms: { title: 'Terms of Use', icon: FileText },
  accessibility: { title: 'Accessibility Statement', icon: Accessibility },
};

export const LEGAL_KEYS = Object.keys(PAGES);

function H({ children }) {
  return <h2 className="text-lg font-semibold tracking-tight mt-8 mb-2">{children}</h2>;
}
function P({ children }) {
  return <p className="text-sm leading-relaxed text-muted mt-2">{children}</p>;
}
function LI({ children }) {
  return <li className="text-sm leading-relaxed text-muted">{children}</li>;
}

export default function LegalPage({ slug, onBack }) {
  const meta = PAGES[slug] || PAGES.privacy;
  const Icon = meta.icon;
  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft size={15} strokeWidth={2.2} /> Back
      </button>

      <div className="mt-5 flex items-center gap-2.5">
        <span className="grid place-items-center w-9 h-9 rounded-lg bg-accent text-foreground flex-shrink-0">
          <Icon size={18} strokeWidth={2} />
        </span>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{meta.title}</h1>
      </div>
      <p className="mt-2 text-xs text-muted num">Effective {EFFECTIVE}</p>

      <div className="mt-4">
        {slug === 'privacy' && <Privacy />}
        {slug === 'terms' && <Terms />}
        {slug === 'accessibility' && <AccessibilityStatement />}
      </div>

      <div className="mt-10 pt-5 border-t border-border">
        <P>Questions? Contact <a className="text-foreground underline underline-offset-2" href={`mailto:${CONTACT}`}>{CONTACT}</a>.</P>
      </div>
    </div>
  );
}

function Privacy() {
  return (
    <>
      <P>This dashboard is run by {OPERATOR}. Because we are based in the EU, we handle your data under the GDPR. This policy explains what we collect, why, who we share it with, and your rights.</P>

      <H>What we collect</H>
      <ul className="mt-2 space-y-1.5 list-disc pl-5">
        <LI><strong>Account data</strong> (if you sign in): your name, email address, and profile photo, via Google sign-in or email and password.</LI>
        <LI><strong>Content you create</strong>: forum posts and replies, poll votes, ideas, and any images you upload, including session photos that may show identifiable people.</LI>
        <LI><strong>A display name</strong> you type, stored only in your own browser if you take part without an account.</LI>
        <LI><strong>Technical data</strong>: your IP address, used briefly to rate-limit and prevent abuse, plus basic server logs.</LI>
      </ul>

      <H>Public session recaps</H>
      <P>Each past session has a recap page with a shareable link (for example, to post on social media). These pages are <strong>public</strong>: anyone with the link can see them without signing in. A recap may show the session photos and the first names of people who attended. We publish only what an organiser has added for that session. If you would rather not appear on a public recap, email us and we will remove your name or any photo of you.</P>

      <H>Why we use it (legal basis)</H>
      <ul className="mt-2 space-y-1.5 list-disc pl-5">
        <LI>To run the community features you choose to use (performance of our community arrangement, and our legitimate interest in operating the dashboard).</LI>
        <LI>To keep the service secure and prevent spam or abuse (legitimate interest).</LI>
      </ul>
      <P>We do not sell your data, show ads, or use it for marketing.</P>

      <H>Who receives your data (sub-processors)</H>
      <ul className="mt-2 space-y-1.5 list-disc pl-5">
        <LI><strong>Supabase</strong>: authentication (name, email).</LI>
        <LI><strong>Vercel</strong>: hosting.</LI>
        <LI><strong>Upstash</strong>: stores forum posts, polls, ideas, and session labels.</LI>
        <LI><strong>Vercel Blob</strong>: stores uploaded session photos.</LI>
        <LI><strong>ImgBB</strong>: hosts images shared in the forum and the image-to-link tool.</LI>
        <LI><strong>Google</strong>: Google sign-in (OAuth).</LI>
        <LI><strong>OpenRouter and Google (Gemini)</strong>: the Post Maker tool sends the text you enter to a large language model to draft a post. Do not paste anything you would not want processed by a third party.</LI>
      </ul>

      <H>How long we keep it</H>
      <P>Account and content data is kept while the community is active and removed on request. The display name some people type is stored only in your browser until you clear it.</P>

      <H>Your rights</H>
      <P>Under the GDPR you can ask us to access, correct, delete, or export your data, and you can object to or withdraw consent for a given use. If a photo of you was uploaded and you want it removed, email us and we will take it down. To exercise any right, contact us at the address below. You also have the right to complain to the Danish Data Protection Agency (Datatilsynet).</P>

      <H>Cookies</H>
      <P>We use only essential cookies needed to keep you signed in. We do not use advertising or analytics trackers.</P>

      <H>Changes</H>
      <P>If this policy changes in a meaningful way, we will update the effective date above.</P>
    </>
  );
}

function Terms() {
  return (
    <>
      <P>By using the AI Workshop dashboard you agree to these terms. The service is run by {OPERATOR}.</P>

      <H>Using the service</H>
      <P>The dashboard is provided for members of the AI Workshop community. Browsing is open to everyone; posting, voting, and uploading require you to sign in.</P>

      <H>Acceptable use</H>
      <ul className="mt-2 space-y-1.5 list-disc pl-5">
        <LI>Be respectful. Do not post unlawful, hateful, or infringing content.</LI>
        <LI>Only upload photos you have the right to share. Do not upload images of other people without their agreement.</LI>
        <LI>Do not attempt to abuse, overload, or circumvent the rate limits or security of the service.</LI>
      </ul>

      <H>Your content</H>
      <P>You keep ownership of what you post. By posting, you grant the community permission to store and display your content within the dashboard. You are responsible for what you contribute. We may remove content, or suspend access, that breaks these terms.</P>

      <H>AI features</H>
      <P>The Post Maker tool generates text with a large language model. Output can be inaccurate or unexpected. Review and edit anything it produces before you publish it elsewhere.</P>

      <H>As-is, and liability</H>
      <P>The dashboard is a volunteer-run community tool provided "as is", without warranties of any kind. To the extent permitted by law, we are not liable for any loss arising from its use. Nothing here limits rights that mandatory Danish or EU consumer law gives you.</P>

      <H>Changes and termination</H>
      <P>We may change these terms or stop offering the service at any time. Continued use after a change means you accept the updated terms.</P>

      <H>Governing law</H>
      <P>These terms are governed by the laws of Denmark.</P>
    </>
  );
}

function AccessibilityStatement() {
  return (
    <>
      <P>We want the AI Workshop dashboard to be usable by everyone, and we aim to meet the <strong>WCAG 2.2 Level AA</strong> standard, in line with the European Accessibility Act.</P>

      <H>What we do</H>
      <ul className="mt-2 space-y-1.5 list-disc pl-5">
        <LI>Semantic HTML, real buttons and links, and a logical heading order.</LI>
        <LI>Full keyboard operation with visible focus states.</LI>
        <LI>Labels on icon-only buttons so screen readers can announce them.</LI>
        <LI>Colour contrast checked against the AA threshold.</LI>
        <LI>Reduced-motion support for users who prefer less animation.</LI>
      </ul>

      <H>Known limitations</H>
      <P>Reordering photos in the session editor uses pointer drag-and-drop, which is not available by keyboard or on touch. A "Make featured" button provides an equivalent way to set the cover photo. We are working to widen coverage over time.</P>

      <H>Feedback</H>
      <P>If you hit an accessibility barrier, please tell us at the contact address below and we will do our best to fix it.</P>

      <P className="mt-2">This statement was last reviewed on {EFFECTIVE}.</P>
    </>
  );
}

// Footer with the compliance trio + project line. onNavigate(slug) routes to a page.
export function Footer({ onNavigate }) {
  const links = [
    ['privacy', 'Privacy'],
    ['terms', 'Terms'],
    ['accessibility', 'Accessibility'],
  ];
  return (
    <footer className="border-t border-border mt-10">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-muted">AI Workshop · a community for building with AI</p>
        <nav className="flex items-center gap-4">
          {links.map(([slug, label]) => (
            <button
              key={slug}
              onClick={() => onNavigate(slug)}
              className="tap-target text-xs text-muted hover:text-foreground transition-colors"
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </footer>
  );
}
