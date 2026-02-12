export function Terms() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>

      <p className="text-muted-foreground mb-6">
        By accessing or using Chronicle ("the Service"), you agree to these
        Terms of Service. If you do not agree, do not use the Service.
      </p>

      {/* TL;DR */}
      <section className="mb-8 p-4 bg-muted/30 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">TL;DR</h2>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Don't upload fake or manipulated logs.</li>
          <li>Don't use Chronicle to harass or attack other players.</li>
          <li>Guild pages are public—uploaders control what's shared.</li>
          <li>We can remove content or ban accounts if rules are broken.</li>
          <li>The service is provided "as is" with no guarantees.</li>
          <li>Keep using Chronicle = you accept these terms.</li>
        </ul>
      </section>

      {/* 1. Description of Service */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Description of Service</h2>
        <p className="text-muted-foreground mb-2">
          Chronicle is a raid log analysis platform for Classic World of
          Warcraft. It processes uploaded log files and presents analytical
          insights for guilds and players.
        </p>
        <p className="text-muted-foreground">
          Chronicle may evolve, change features, or discontinue functionality at
          any time.
        </p>
      </section>

      {/* 2. Account Responsibility */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Account Responsibility</h2>
        <p className="text-muted-foreground mb-2">You are responsible for:</p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-2">
          <li>Maintaining the security of your account</li>
          <li>All activity under your account</li>
          <li>The accuracy of any information you submit</li>
        </ul>
        <p className="text-muted-foreground">
          You may not share accounts or impersonate others.
        </p>
      </section>

      {/* 3. Log Integrity & Authenticity */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">
          3. Log Integrity & Authenticity
        </h2>
        <p className="text-muted-foreground mb-2">
          Chronicle depends on accurate log data. You may not:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
          <li>Upload edited or manipulated log files</li>
          <li>Create fabricated or falsified logs</li>
          <li>Attempt to alter analytical outputs through deceptive means</li>
          <li>Exploit bugs to manipulate rankings or metrics</li>
        </ul>
        <p className="text-muted-foreground mb-2">
          If we determine, in our sole discretion, that log manipulation has
          occurred, we may:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-2">
          <li>Remove the log(s)</li>
          <li>Suspend or permanently ban the account</li>
          <li>Remove associated guild pages</li>
        </ul>
        <p className="text-muted-foreground">
          We are not obligated to provide evidence or explanation for
          enforcement decisions.
        </p>
      </section>

      {/* 4. Acceptable Use */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
        <p className="text-muted-foreground mb-2">You agree not to:</p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
          <li>Use Chronicle for harassment or shaming</li>
          <li>Target, dox, or attack other players</li>
          <li>Use the platform to promote toxicity or guild drama</li>
          <li>Attempt to disrupt or overload the service</li>
          <li>Reverse engineer or scrape the platform</li>
        </ul>
        <p className="text-muted-foreground">
          Chronicle is designed for analytical discussion and leadership
          clarity—not ranking wars or personal attacks.
        </p>
      </section>

      {/* 5. Moderation & Enforcement */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Moderation & Enforcement</h2>
        <p className="text-muted-foreground mb-2">
          Chronicle reserves the right, at its sole discretion, to:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
          <li>Remove content</li>
          <li>Disable uploads</li>
          <li>Suspend accounts</li>
          <li>Permanently ban users</li>
          <li>Restrict guild pages</li>
          <li>Deny access to the service</li>
        </ul>
        <p className="text-muted-foreground mb-2">This may occur for:</p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
          <li>Log manipulation</li>
          <li>Toxic or abusive behavior</li>
          <li>Repeated disruption</li>
          <li>Any conduct we determine harms the platform or its community</li>
        </ul>
        <p className="text-muted-foreground">
          Enforcement decisions are final. We are not required to issue warnings
          before taking action.
        </p>
      </section>

      {/* 6. Public Content */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Public Content</h2>
        <p className="text-muted-foreground mb-2">
          Guild pages are public by design. By uploading logs, you grant
          Chronicle permission to:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-2">
          <li>Process and analyze the data</li>
          <li>Display derived metrics publicly</li>
          <li>Archive raid history</li>
        </ul>
        <p className="text-muted-foreground">
          You represent that you have the right to upload the log data.
        </p>
      </section>

      {/* 7. Service Availability */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Service Availability</h2>
        <p className="text-muted-foreground mb-2">
          Chronicle is provided "as is." We do not guarantee:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-2">
          <li>Continuous uptime</li>
          <li>Error-free analytics</li>
          <li>Permanent storage of logs</li>
          <li>Compatibility with future server updates</li>
        </ul>
        <p className="text-muted-foreground">
          We may modify or discontinue the Service at any time.
        </p>
      </section>

      {/* 8. Intellectual Property */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Intellectual Property</h2>
        <p className="text-muted-foreground mb-2">
          All Chronicle branding, interface design, analytics systems, and
          written content are the property of Chronicle.
        </p>
        <p className="text-muted-foreground mb-2">
          You may not copy, reproduce, or redistribute the platform's design or
          analytical systems without permission.
        </p>
        <p className="text-muted-foreground">
          Uploaded logs remain the property of the uploader, but analytical
          outputs generated by Chronicle belong to Chronicle.
        </p>
      </section>

      {/* 9. Limitation of Liability */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">9. Limitation of Liability</h2>
        <p className="text-muted-foreground mb-2">
          Chronicle is provided without warranties of any kind. To the maximum
          extent permitted by law, Chronicle is not liable for:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-2">
          <li>Data loss</li>
          <li>Analytical inaccuracies</li>
          <li>Account bans</li>
          <li>Guild disputes</li>
          <li>Any indirect or consequential damages</li>
        </ul>
        <p className="text-muted-foreground">Use the service at your own risk.</p>
      </section>

      {/* 10. Changes to Terms */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">10. Changes to Terms</h2>
        <p className="text-muted-foreground mb-2">
          We may update these Terms at any time.
        </p>
        <p className="text-muted-foreground">
          Continued use of Chronicle after updates means you accept the revised
          Terms.
        </p>
      </section>
    </div>
  );
}
