// guid.ts
// Browser-safe TypeScript port of the Go GUID type.
// Uses bigint to preserve full uint64 precision in the browser.

export type GuidJson = string;

export class GUID {
  private readonly value: bigint; // uint64 stored as bigint (0..2^64-1)

  private constructor(v: bigint) {
    this.value = GUID.u64(v);
  }

  /** Parse "0x" + 16 hex digits (case-insensitive). */
  static fromString(gid: string): GUID {
    if (gid.length !== 18 || gid.slice(0, 2) !== "0x") {
      throw new Error(`invalid guid: ${gid}`);
    }
    const hex = gid.slice(2);
    if (!/^[0-9a-fA-F]{16}$/.test(hex)) {
      throw new Error(`invalid guid: ${gid}`);
    }
    // BigInt supports hex parsing directly.
    const v = BigInt("0x" + hex);
    return new GUID(v);
  }

  /** Create from a bigint (masked to uint64). */
  static fromBigInt(v: bigint): GUID {
    return new GUID(v);
  }

  /** uint64 as bigint. */
  toBigInt(): bigint {
    return this.value;
  }

  isZero(): boolean {
    return this.value === 0n;
  }

  /** "0x%016X" */
  toString(): string {
    return "0x" + this.value.toString(16).toUpperCase().padStart(16, "0");
  }

  /** Equivalent to Go's MarshalText/MarshalJSON in your code (JSON string). */
  toJSON(): GuidJson {
    return this.toString();
  }

  /** Equivalent to UnmarshalJSON: expects a JSON string holding the guid. */
  static fromJSON(data: unknown): GUID {
    if (typeof data !== "string") {
      throw new Error("GUID JSON must be a string");
    }
    return GUID.fromString(data);
  }

  // --- WoW-specific helpers (ported) ---

  /** Rotate-left for 64-bit values, works for negative (right rotation). */
  private static rotl64(x: bigint, k: number): bigint {
    const n = ((k % 64) + 64) % 64; // normalize to 0..63
    const mask = (1n << 64n) - 1n;
    const v = x & mask;
    if (n === 0) return v;
    return ((v << BigInt(n)) | (v >> BigInt(64 - n))) & mask;
  }

  /** Mask to uint64. */
  private static u64(x: bigint): bigint {
    return x & ((1n << 64n) - 1n);
  }

  /** GetHigh returns the high 16 bits of the GUID (Go: rotate left -48). */
  getHigh(): number {
    const rotated = GUID.rotl64(this.value, -48);
    // low 16 bits after rotate are the high 16 bits of original
    return Number(rotated & 0xFFFFn);
  }

  /** True if the GUID represents a player. */
  isPlayer(): boolean {
    return (this.getHigh() & 0x00f0) === 0x0000;
  }

  isObject(): boolean {
    return (this.getHigh() & 0x00f0) === 0x0010;
  }

  /** True if the GUID represents a pet. */
  isPet(): boolean {
    return (this.getHigh() & 0x00f0) === 0x0040;
  }

  /** True if the GUID represents a creature. */
  isCreature(): boolean {
    return (this.getHigh() & 0x00f0) === 0x0030;
  }

  /** True if the GUID represents a vehicle. */
  isVehicle(): boolean {
    return (this.getHigh() & 0x00f0) === 0x0050;
  }

  /** Any creature type (creature, pet, vehicle). */
  isAnyCreature(): boolean {
    return this.isCreature() || this.isPet() || this.isVehicle();
  }

  /** Unit (any creature or player). */
  isUnit(): boolean {
    return this.isAnyCreature() || this.isPlayer();
  }

  /**
   * GetEntry returns entry ID for creatures/objects.
   * Go: rotate left -24, then low 24 bits.
   */
  getEntry(): { entry: number; ok: boolean } {
    if (this.isAnyCreature() || this.isObject()) {
      const rotated = GUID.rotl64(this.value, -24);
      const entry = Number(rotated & 0xFFFFFFn);
      return { entry, ok: true };
    }
    return { entry: 0, ok: false };
  }

  /** Like MustEntry: throws if not a creature/object entry type. */
  mustEntry(): number {
    const { entry, ok } = this.getEntry();
    if (!ok) {
      throw new Error("GUID is not a creature");
    }
    return entry;
  }
}

// --------------------
// Example usage:
//
// const g = GUID.fromString("0x0000000000024225");
// console.log(g.toString()); // "0x0000000000024225"
// console.log(g.getHigh().toString(16)); // high 16 bits
// console.log(JSON.stringify(g)); // "\"0x0000000000024225\""
// const roundtrip = GUID.fromJSON(JSON.parse(JSON.stringify(g)));
// --------------------
