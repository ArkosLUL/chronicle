import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card/Card"
import { Button } from "@/components/ui/button"
import { decodePayload, decodeDelimitedMessages, decompressGzip, isGzipped, type PayloadHeader } from "@/api/protodecode/decode"
import { DamageSchema, type Damage, School } from "@/api/proto/chronicle_pb"

type DecodeMode = "payload" | "messages"

export function ProtoDecode() {
  const [input, setInput] = useState("")
  const [instanceId, setInstanceId] = useState("")
  const [mode, setMode] = useState<DecodeMode>("payload")
  const [header, setHeader] = useState<PayloadHeader | null>(null)
  const [messages, setMessages] = useState<Damage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFetch = async () => {
    if (!instanceId.trim()) {
      setError("Please enter an instance ID")
      return
    }

    setError(null)
    setHeader(null)
    setMessages([])
    setLoading(true)

    try {
      const url = `/api/v1/raidlogs/instances/${instanceId.trim()}/events/damage`
      const response = await fetch(url)
      
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`)
      }

      const contentType = response.headers.get("content-type") || ""
      
      if (contentType.includes("application/json")) {
        const json = await response.json()
        throw new Error(`Server error: ${JSON.stringify(json)}`)
      }

      const buffer = await response.arrayBuffer()
      let data = new Uint8Array(buffer)

      if (isGzipped(data)) {
        data = await decompressGzip(data)
      }

      if (mode === "payload") {
        const result = decodePayload(DamageSchema, data)
        setHeader(result.header)
        setMessages(result.messages)
      } else {
        const msgs = decodeDelimitedMessages(DamageSchema, data)
        setMessages(msgs)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleDecode = async () => {
    setError(null)
    setHeader(null)
    setMessages([])

    try {
      let data = parseInput(input.trim())

      if (isGzipped(data)) {
        data = await decompressGzip(data)
      }

      if (mode === "payload") {
        const result = decodePayload(DamageSchema, data)
        setHeader(result.header)
        setMessages(result.messages)
      } else {
        const msgs = decodeDelimitedMessages(DamageSchema, data)
        setMessages(msgs)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleClear = () => {
    setInput("")
    setInstanceId("")
    setHeader(null)
    setMessages([])
    setError(null)
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Protobuf Decoder</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Decode Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === "payload"}
                onChange={() => setMode("payload")}
                className="accent-primary"
              />
              <span>Full Payload (with header)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === "messages"}
                onChange={() => setMode("messages")}
                className="accent-primary"
              />
              <span>Messages Only (no header)</span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Fetch from API</CardTitle>
          <CardDescription>
            Load events directly from the API by instance ID
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              placeholder="Instance UUID (e.g., a1da6acf-a103-4aca-9176-d46e4deabb69)"
              className="flex-1 p-2 font-mono text-sm bg-background border rounded-md"
            />
            <Button onClick={handleFetch} disabled={loading}>
              {loading ? "Loading..." : "Fetch"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Manual Input</CardTitle>
          <CardDescription>
            Or paste base64 or hex-encoded protobuf data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste base64 or hex data here..."
            className="w-full h-40 p-3 font-mono text-sm bg-background border rounded-md resize-y"
          />

          <div className="flex gap-2">
            <Button onClick={handleDecode}>Decode</Button>
            <Button variant="outline" onClick={handleClear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-destructive whitespace-pre-wrap">{error}</pre>
          </CardContent>
        </Card>
      )}

      {header && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Header</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="font-medium text-muted-foreground">Encounter ID:</dt>
              <dd className="font-mono">{header.encounterID}</dd>
              <dt className="font-medium text-muted-foreground">First Timestamp:</dt>
              <dd>{header.firstTimestamp.toISOString()}</dd>
              <dt className="font-medium text-muted-foreground">Message Count:</dt>
              <dd>{header.count}</dd>
              <dt className="font-medium text-muted-foreground">Data Length:</dt>
              <dd>{header.dataLength.toLocaleString()} bytes</dd>
            </dl>
          </CardContent>
        </Card>
      )}

      {messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Messages ({messages.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Index</th>
                    <th className="text-left p-2">Offset (ms)</th>
                    <th className="text-left p-2">Caster</th>
                    <th className="text-left p-2">Source</th>
                    <th className="text-left p-2">Target</th>
                    <th className="text-right p-2">Amount</th>
                    <th className="text-left p-2">School</th>
                    <th className="text-left p-2">Hit Type</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((msg, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="p-2 text-muted-foreground">{i}</td>
                      <td className="p-2">{msg.meta?.index ?? "-"}</td>
                      <td className="p-2">{msg.meta?.offsetMilli?.toString() ?? "-"}</td>
                      <td className="p-2">{msg.caster ?? "-"}</td>
                      <td className="p-2">{msg.sourceName}</td>
                      <td className="p-2">{msg.target}</td>
                      <td className="p-2 text-right">{msg.amount}</td>
                      <td className="p-2">{schoolName(msg.school)}</td>
                      <td className="p-2">{msg.hitType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function parseInput(input: string): Uint8Array {
  if (/^[A-Za-z0-9+/=]+$/.test(input)) {
    try {
      const binary = atob(input)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return bytes
    } catch {
      // Fall through to hex
    }
  }

  const hexClean = input.replace(/^0x/i, "").replace(/\s/g, "")
  if (/^[A-Fa-f0-9]+$/.test(hexClean) && hexClean.length % 2 === 0) {
    const bytes = new Uint8Array(hexClean.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hexClean.substr(i * 2, 2), 16)
    }
    return bytes
  }

  throw new Error("Invalid input: expected base64 or hex-encoded data")
}

function schoolName(school: School): string {
  switch (school) {
    case School.Unknown: return "Unknown"
    case School.None: return "None"
    case School.Physical: return "Physical"
    case School.Holy: return "Holy"
    case School.Fire: return "Fire"
    case School.Nature: return "Nature"
    case School.Frost: return "Frost"
    case School.Shadow: return "Shadow"
    case School.Arcane: return "Arcane"
    default: return `${school}`
  }
}
