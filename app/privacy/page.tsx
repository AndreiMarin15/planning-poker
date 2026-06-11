export default function PrivacyPolicy() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-zinc-300">
      <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-zinc-500 text-sm mb-10">Last updated: June 2025</p>

      <section className="space-y-8 text-sm leading-relaxed">
        <div>
          <h2 className="text-white font-semibold mb-2">1. What we collect</h2>
          <p>When you connect your Jira account, we request OAuth access to read and write Jira issues on your behalf. We store a temporary session token (server-side, in memory) to make API requests during your session. No data is persisted to a database or shared with third parties.</p>
        </div>

        <div>
          <h2 className="text-white font-semibold mb-2">2. How we use it</h2>
          <p>Your Jira access token is used solely to:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-400">
            <li>Fetch issue details (summary, description) when you enter a ticket key</li>
            <li>Search issues in your Jira project</li>
            <li>Write story point estimates back to Jira after a vote</li>
            <li>Import issues from your active sprint into the planning queue</li>
          </ul>
        </div>

        <div>
          <h2 className="text-white font-semibold mb-2">3. Data retention</h2>
          <p>Session tokens are stored in server memory only and are cleared when the server restarts or when you click Disconnect. We do not write your Jira data to any persistent storage.</p>
        </div>

        <div>
          <h2 className="text-white font-semibold mb-2">4. Third parties</h2>
          <p>We do not sell, share, or transfer your data to any third parties. API calls are made directly to Atlassian's servers using your OAuth token.</p>
        </div>

        <div>
          <h2 className="text-white font-semibold mb-2">5. Revoking access</h2>
          <p>You can disconnect at any time by clicking the Jira indicator in the app header. You can also revoke access from your Atlassian account settings at <a href="https://id.atlassian.com/manage-profile/apps" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">id.atlassian.com/manage-profile/apps</a>.</p>
        </div>

        <div>
          <h2 className="text-white font-semibold mb-2">6. Contact</h2>
          <p>Questions? Reach out at <a href="mailto:andreimarin1622@gmail.com" className="text-blue-400 hover:underline">andreimarin1622@gmail.com</a>.</p>
        </div>
      </section>
    </main>
  )
}
