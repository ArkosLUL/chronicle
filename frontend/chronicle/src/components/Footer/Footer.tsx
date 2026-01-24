export function Footer() {
  const gitTag = document
    .querySelector("meta[property=GitTag]")
    ?.getAttribute("content");

  const gitCommit = document
    .querySelector("meta[property=GitCommit]")
    ?.getAttribute("content");

  const buildTime = document
    .querySelector("meta[property=BuildTime]")
    ?.getAttribute("content");

  return (
    <footer className="border-t p-4 text-center text-sm text-muted-foreground">
      <div className="flex flex-col items-center gap-1">
        <p>© {new Date().getFullYear()} Chronicle. All rights reserved.</p>
        <p className="text-xs">
          {gitTag} ({gitCommit}) • Built {buildTime}
        </p>
      </div>
    </footer>
  );
}
