const DISCORD_URL = "https://discord.gg/gz97ABFVAj";

export function Contact() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Contact</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">About Chronicle</h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            Chronicle was created by players who wanted a more straightforward
            way to review raids and discuss improvements.
          </p>
          <p>
            Most existing tools focus on raw numbers or rankings. We wanted
            something that made logs easier to read, added missing context, and
            supported better leadership conversations—without adding complexity
            or pressure during gameplay.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Get in Touch</h2>
        <div className="space-y-4 text-muted-foreground">
          <div>
            <h3 className="font-medium text-foreground mb-2">Discord</h3>
            <p>
              For most questions, feedback, and troubleshooting, please reach
              out through Discord.
            </p>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Join the Chronicle Discord
            </a>
          </div>
          <p className="text-sm">
            Discord is the fastest way to get help, share feedback, and stay up
            to date as Chronicle evolves. We actively monitor Discord and
            appreciate thoughtful input from the community.
          </p>
        </div>
      </section>
    </div>
  );
}
