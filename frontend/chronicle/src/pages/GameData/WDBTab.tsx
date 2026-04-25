import { useState } from "react";
import { WDBUpload } from "./WDBUpload";

const FILE_TYPES = [
  {
    key: "items",
    label: "itemcache.wdb",
    description: "Item cache data",
    props: {
      title: "Item Cache Import",
      description:
        "Upload an itemcache.wdb file from your WoW client to compare and import item data.",
      fileHint: "itemcache.wdb",
      showUnreliableFilter: true,
    },
  },
  {
    key: "creatures",
    label: "creaturecache.wdb",
    description: "Creature cache data",
    props: {
      title: "Creature Cache Import",
      description:
        "Upload a creaturecache.wdb file from your WoW client to compare and import creature data (name, subname, display IDs).",
      fileHint: "creaturecache.wdb",
    },
  },
] as const;

type FileTypeKey = (typeof FILE_TYPES)[number]["key"];

export function WDBTab() {
  const [selected, setSelected] = useState<FileTypeKey>("items");
  const config = FILE_TYPES.find((f) => f.key === selected)!;

  const dropdown = (
    <div>
      <label className="block text-sm font-medium mb-1">Cache File Type</label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value as FileTypeKey)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      >
        {FILE_TYPES.map((ft) => (
          <option key={ft.key} value={ft.key}>
            {ft.label} — {ft.description}
          </option>
        ))}
      </select>
    </div>
  );

  return <WDBUpload key={config.key} {...config.props} cardHeader={dropdown} />;
}
