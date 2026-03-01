import { Link } from 'react-router-dom';
import { ArrowLeft, ScrollText } from 'lucide-react';

export default function Terms() {
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
            <ScrollText className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Terms of Service</h1>
            <p className="text-sm text-zinc-500 mt-1">Last updated: February 10, 2026</p>
          </div>
        </div>

        <div className="prose prose-invert prose-zinc max-w-none space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Agreement to Terms</h2>
            <p>
              By accessing or using LikelyClaw ("the Platform"), you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, do not use the Platform. These terms constitute a legally 
              binding agreement between you and LikelyClaw.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              LikelyClaw is a managed AI employee platform that allows users to create, configure, and 
              deploy AI agents in isolated Docker containers. These agents can connect to messaging platforms 
              (WhatsApp, Telegram), install skills from a marketplace, and perform automated tasks using 
              user-provided AI model API keys.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Account Registration</h2>
            <ul className="list-disc list-inside space-y-2 text-zinc-400">
              <li>You must provide accurate and complete registration information.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must be at least 18 years old to create an account.</li>
              <li>One person or entity may not maintain more than one account.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Subscription Plans & Billing</h2>
            <ul className="list-disc list-inside space-y-2 text-zinc-400">
              <li>Paid plans are billed monthly through Razorpay.</li>
              <li>Prices are listed in Indian Rupees (INR) and are inclusive of applicable taxes unless stated otherwise.</li>
              <li>Subscriptions auto-renew at the end of each billing cycle unless cancelled.</li>
              <li>You can cancel your subscription at any time. Access continues until the end of your current billing period.</li>
              <li>Refunds are handled on a case-by-case basis. Contact support for refund requests.</li>
              <li>We reserve the right to change pricing with 30 days advance notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. API Keys & Third-Party Services</h2>
            <ul className="list-disc list-inside space-y-2 text-zinc-400">
              <li>You must provide your own API keys for AI model providers (OpenAI, Anthropic, Google AI, etc.).</li>
              <li>You are responsible for all costs incurred through your API keys.</li>
              <li>We encrypt your API keys using AES-256 encryption and never access them in plain text.</li>
              <li>You must comply with the terms of service of all third-party providers whose keys you use.</li>
              <li>We are not responsible for charges, rate limits, or policy violations on your third-party accounts.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Acceptable Use</h2>
            <p className="mb-3">You agree not to use the Platform to:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400">
              <li>Violate any applicable laws or regulations.</li>
              <li>Send spam, unsolicited messages, or engage in harassment through connected channels.</li>
              <li>Generate, store, or distribute illegal, harmful, or abusive content.</li>
              <li>Attempt to gain unauthorized access to other users' containers or data.</li>
              <li>Interfere with or disrupt the Platform's infrastructure or other users' services.</li>
              <li>Use the Platform for cryptocurrency mining or other resource-abusive activities.</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code of the Platform.</li>
              <li>Resell or redistribute access to the Platform without authorization.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Resource Limits</h2>
            <p>
              Each subscription plan includes specific resource allocations (RAM, SSD storage, number of employees). 
              You agree to operate within the limits of your plan. We reserve the right to throttle or suspend 
              containers that exceed their allocated resources or negatively impact platform performance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Data & Content</h2>
            <ul className="list-disc list-inside space-y-2 text-zinc-400">
              <li>You retain ownership of all data and content you create or upload to the Platform.</li>
              <li>You grant us a limited license to host, store, and process your data solely to provide the service.</li>
              <li>You are responsible for maintaining backups of your important data.</li>
              <li>We may delete your data 30 days after account termination.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted service. The Platform 
              may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control. 
              We will make reasonable efforts to notify users of planned maintenance in advance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, LikelyClaw shall not be liable for any indirect, 
              incidental, special, consequential, or punitive damages, including but not limited to loss of 
              profits, data, or business opportunities, arising from your use of the Platform. Our total 
              liability shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Disclaimer of Warranties</h2>
            <p>
              The Platform is provided "as is" and "as available" without warranties of any kind, whether 
              express or implied. We do not warrant that the AI agents will produce accurate, complete, or 
              reliable outputs. You are responsible for reviewing and verifying all AI-generated content 
              and actions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Account Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account if you violate these Terms. 
              Upon termination, your AI employee containers will be stopped and your data will be 
              scheduled for deletion. You may also delete your account at any time through the settings page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">13. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. We will notify you of material changes by posting 
              the updated terms on this page and updating the "Last updated" date. Continued use of the 
              Platform after changes constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">14. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of India. Any disputes 
              arising from these terms shall be subject to the exclusive jurisdiction of the courts in 
              Hyderabad, India.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">15. Contact</h2>
            <p>For questions about these Terms, contact us at:</p>
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
