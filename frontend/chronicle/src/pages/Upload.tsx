import { useState } from "react";
import { Upload as UploadIcon, FileText, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card/Card";

export function Upload() {
  const [combatLog, setCombatLog] = useState<File | null>(null);
  const [raidRoster, setRaidRoster] = useState<File | null>(null);

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void
  ) => {
    const file = e.target.files?.[0] || null;
    setter(file);
  };

  const handleUpload = () => {
    if (!combatLog || !raidRoster) return;
    // TODO: Implement upload logic
    console.log("Uploading:", { combatLog, raidRoster });
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Upload Raid Logs</h1>
        <p className="text-muted-foreground mt-2">
          Upload your combat log and raid roster to analyze your raid performance.
        </p>
      </div>

      {/* File Selection */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold">Combat Log</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Select your WoWCombatLog.txt file
            </p>
            <label className="block">
              <input
                type="file"
                accept=".txt"
                onChange={(e) => handleFileSelect(e, setCombatLog)}
                className="hidden"
              />
              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                {combatLog ? (
                  <div className="space-y-1">
                    <FileText className="h-8 w-8 mx-auto text-primary" />
                    <p className="text-sm font-medium">{combatLog.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(combatLog.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <UploadIcon className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to select file
                    </p>
                  </div>
                )}
              </div>
            </label>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold">Raid Roster</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Select your raid roster export file
            </p>
            <label className="block">
              <input
                type="file"
                accept=".txt,.csv"
                onChange={(e) => handleFileSelect(e, setRaidRoster)}
                className="hidden"
              />
              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                {raidRoster ? (
                  <div className="space-y-1">
                    <FileText className="h-8 w-8 mx-auto text-primary" />
                    <p className="text-sm font-medium">{raidRoster.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(raidRoster.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <UploadIcon className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to select file
                    </p>
                  </div>
                )}
              </div>
            </label>
          </div>
        </Card>
      </div>

      <Button
        onClick={handleUpload}
        disabled={!combatLog || !raidRoster}
        className="w-full md:w-auto"
      >
        <UploadIcon className="h-4 w-4 mr-2" />
        Upload Files
      </Button>

      {/* Requirements */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Requirements</h2>
        </div>

        <div className="space-y-6 text-sm">
          <div>
            <h3 className="font-medium mb-2">Addon Requirements</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>
                <strong>Advanced Combat Logging</strong> must be enabled in-game
                (System → Network → Advanced Combat Logging)
              </li>
              <li>
                <strong>RaidRosterExport</strong> addon for exporting raid roster data
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">Mod Requirements</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Turtle WoW client with combat logging support</li>
              <li>No log parsing mods that modify the combat log format</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">File Locations</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>
                <strong>Combat Log:</strong>{" "}
                <code className="bg-muted px-1 rounded">
                  World of Warcraft/_classic_/Logs/WoWCombatLog.txt
                </code>
              </li>
              <li>
                <strong>Raid Roster:</strong>{" "}
                <code className="bg-muted px-1 rounded">
                  World of Warcraft/_classic_/WTF/Account/[NAME]/SavedVariables/RaidRosterExport.lua
                </code>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">Tips</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Clear your combat log before each raid session for cleaner data</li>
              <li>Export the raid roster at the start of the raid</li>
              <li>Upload logs as soon as possible after the raid ends</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
