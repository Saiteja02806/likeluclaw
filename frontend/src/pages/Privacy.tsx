import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-300">
      {/* Header */}
      <header className="border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.svg?v=3" alt="LikelyClaw" className="h-7 w-auto" />
            <span className="text-[15px] font-semibold tracking-tight text-white">
              LikelyClaw
            </span>
          </Link>
          <Link to="/" className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Privacy Policy</h1>
            <p className="text-sm text-zinc-500 mt-1">Last updated: February 14, 2026</p>
          </div>
        </div>

        <div className="prose prose-invert prose-zinc max-w-none space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              LikelyClaw ("we", "our", or "us") operates the LikelyClaw platform at likelyclaw.com. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information 
              when you use our AI employee platform and related services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400">
              <li><strong className="text-zinc-200">Account Information:</strong> Name, email address, and password when you create an account.</li>
              <li><strong className="text-zinc-200">API Keys:</strong> Third-party API keys (e.g., OpenAI, Anthropic) you provide to power your AI employees. These are AES-256 encrypted at rest and never stored in plain text.</li>
              <li><strong className="text-zinc-200">Usage Data:</strong> Activity logs, employee configurations, skill installations, and platform interactions.</li>
              <li><strong className="text-zinc-200">Payment Information:</strong> Billing details processed securely through Razorpay. We do not store your credit card numbers.</li>
              <li><strong className="text-zinc-200">Communication Data:</strong> Messages sent through connected channels (WhatsApp, Telegram) are processed by your AI employee within your isolated container.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-zinc-400">
              <li>To provision and manage your AI employee containers.</li>
              <li>To process your subscription payments.</li>
              <li>To provide customer support and respond to inquiries.</li>
              <li>To improve our platform, features, and user experience.</li>
              <li>To send important service-related communications.</li>
              <li>To detect and prevent fraud, abuse, or security incidents.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Isolation & Security</h2>
            <p className="mb-3">We take your data security seriously:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400">
              <li>Each AI employee runs in a <strong className="text-zinc-200">dedicated, isolated Docker container</strong>. No data is shared between users.</li>
              <li>All API keys and sensitive credentials are <strong className="text-zinc-200">AES-256 encrypted</strong> at rest.</li>
              <li>Communication between your browser and our servers is encrypted via <strong className="text-zinc-200">TLS/HTTPS</strong>.</li>
              <li>We use industry-standard security practices including firewalls, access controls, and regular audits.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Third-Party Services</h2>
            <p className="mb-3">We integrate with the following third-party services:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400">
              <li><strong className="text-zinc-200">Supabase:</strong> Authentication and database services.</li>
              <li><strong className="text-zinc-200">Razorpay:</strong> Payment processing.</li>
              <li><strong className="text-zinc-200">Google APIs:</strong> Gmail and Calendar integrations (only when you explicitly connect your account). See Section 5a below for details.</li>
              <li><strong className="text-zinc-200">OpenAI / Anthropic / Google AI:</strong> AI model providers (using your own API keys).</li>
              <li><strong className="text-zinc-200">WhatsApp / Telegram:</strong> Messaging channel integrations.</li>
            </ul>
            <p className="mt-3">Each third-party service has its own privacy policy. We encourage you to review them.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5a. Google API Services — User Data Policy</h2>
            <p className="mb-3">
              LikelyClaw's use and transfer to any other app of information received from Google APIs will adhere to the{' '}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                Google API Services User Data Policy
              </a>, including the Limited Use requirements.
            </p>

            <h3 className="text-lg font-medium text-white mt-5 mb-2">Google Scopes We Request</h3>
            <p className="mb-3">When you choose to connect your Google account, we request only the permissions necessary for the features you enable:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400">
              <li><strong className="text-zinc-200">Gmail — Read (gmail.readonly):</strong> Allows your AI employee to read incoming emails so it can summarize, categorize, or alert you about important messages.</li>
              <li><strong className="text-zinc-200">Gmail — Send (gmail.send):</strong> Allows your AI employee to send emails or draft replies on your behalf when you instruct it to.</li>
              <li><strong className="text-zinc-200">Gmail — Modify (gmail.modify):</strong> Allows your AI employee to manage labels, mark messages as read/unread, and organize your inbox as instructed.</li>
              <li><strong className="text-zinc-200">Calendar — Read/Write (calendar.events):</strong> Allows your AI employee to view your calendar events and create, update, or delete events when instructed.</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-5 mb-2">How We Use Google Data</h3>
            <ul className="list-disc list-inside space-y-2 text-zinc-400">
              <li>Google user data is accessed <strong className="text-zinc-200">only when your AI employee needs it</strong> to perform a task you requested (e.g., "check my email", "schedule a meeting").</li>
              <li>Data is processed <strong className="text-zinc-200">within your isolated container</strong> and is not shared with other users or third parties.</li>
              <li>We do <strong className="text-zinc-200">not</strong> use Google user data for advertising, market research, or to train AI models.</li>
              <li>We do <strong className="text-zinc-200">not</strong> sell, lease, or trade Google user data to any third party.</li>
              <li>Google OAuth tokens are <strong className="text-zinc-200">AES-256 encrypted</strong> at rest and are only decrypted when making authorized API calls on your behalf.</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-5 mb-2">Limited Use Disclosure</h3>
            <p className="text-zinc-400">
              LikelyClaw's use of information received from Google APIs adheres to Google's Limited Use requirements. Specifically, we limit our use of Google user data to providing or improving user-facing features that are prominent in our application's user interface. We do not transfer Google user data to third parties unless necessary to provide or improve these features, to comply with applicable laws, or as part of a merger/acquisition with prior user consent. We do not use Google user data for serving advertisements. No human reads Google user data except where necessary with user consent for security, legal compliance, or support purposes.
            </p>

            <h3 className="text-lg font-medium text-white mt-5 mb-2">Revoking Access</h3>
            <p className="text-zinc-400">
              You can disconnect your Google account at any time from the Integrations page in your dashboard. You can also revoke access directly from your{' '}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                Google Account Permissions
              </a>{' '}page. When you disconnect, we immediately delete your stored OAuth tokens.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide services. 
              When you delete your account, we will delete your personal data and destroy your AI employee 
              containers within 30 days, except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400">
              <li>Access and receive a copy of your personal data.</li>
              <li>Correct inaccurate personal data.</li>
              <li>Request deletion of your personal data.</li>
              <li>Object to or restrict processing of your data.</li>
              <li>Data portability — receive your data in a structured format.</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact us at the email below.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. We do not use 
              advertising or tracking cookies. Our authentication provider (Supabase) may set 
              cookies necessary for secure login functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Children's Privacy</h2>
            <p>
              LikelyClaw is not intended for children under 18 years of age. We do not knowingly 
              collect personal information from children. If we learn we have collected data from 
              a child under 18, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material 
              changes by posting the updated policy on this page and updating the "Last updated" date. 
              Your continued use of the platform after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or your personal data, contact us at:
            </p>
            <p className="mt-2 text-amber-400 font-medium">support@likelyclaw.com</p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">&copy; {new Date().getFullYear()} LikelyClaw. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs text-zinc-600">
            <Link to="/privacy" className="hover:text-zinc-300 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-zinc-300 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
