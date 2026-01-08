import { useState } from "react";
import { Link } from "react-router-dom";
import { Upload as UploadIcon, FileText, Info, LogIn, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card/Card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert/Alert";
import { useAuth } from "@/hooks/useAuth";

export function Upload() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [combatLog, setCombatLog] = useState<File | null>(null);
  const [rawCombatLog, setRawCombatLog] = useState<File | null>(null);

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void
  ) => {
    const file = e.target.files?.[0] || null;
    setter(file);
  };

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!combatLog || !rawCombatLog) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append("combat_log_1", combatLog);
    formData.append("combat_log_2", rawCombatLog);

    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        // TODO: Handle success (redirect to raid log page?)
        console.log("Upload successful");
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          setError(data.message || "Upload failed");
        } catch {
          setError("Upload failed");
        }
      }
    });

    xhr.addEventListener("error", () => {
      setUploading(false);
      setError("Upload failed - network error");
    });

    xhr.open("POST", "/api/v1/raidlogs/upload");
    xhr.send(formData);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Upload Raid Logs</h1>
        <p className="text-muted-foreground mt-2">
          Upload your combat log and raid roster to analyze your raid performance.
        </p>
      </div>

      {/* Auth Check */}
      {!authLoading && !isAuthenticated ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div>
              <h2 className="font-semibold text-lg">Authentication Required</h2>
              <p className="text-muted-foreground mt-1">
                You must be logged in to upload raid logs.
              </p>
            </div>
            <Link to="/login?from=/upload">
              <Button>
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Upload Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

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
              <h2 className="font-semibold">Raw Combat Log</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Select your WoWRawCombatLog.txt
            </p>
            <label className="block">
              <input
                type="file"
                accept=".txt,.csv"
                onChange={(e) => handleFileSelect(e, setRawCombatLog)}
                className="hidden"
              />
              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                {rawCombatLog ? (
                  <div className="space-y-1">
                    <FileText className="h-8 w-8 mx-auto text-primary" />
                    <p className="text-sm font-medium">{rawCombatLog.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(rawCombatLog.size / 1024).toFixed(2)} KB
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

      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={!combatLog || !rawCombatLog || uploading}
        className="w-full md:w-auto"
      >
        <UploadIcon className="h-4 w-4 mr-2" />
        {uploading ? "Uploading..." : "Upload Files"}
      </Button>
        </>
      )}

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
