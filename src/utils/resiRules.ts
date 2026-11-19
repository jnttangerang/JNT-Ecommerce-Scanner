import { Config, CONFIG_KEYS } from "./config";

export type ResiRuleType = "HURUF_ANGKA" | "ANGKA";

export interface ResiRule {
  prefix: string;
  panjangTotal: number;
  panjangMax?: number;
  tipe: ResiRuleType;
  layanan: string;
  aktif: boolean;
  bawaan?: boolean;
}

export type AnalisaResiStatus = "VALID" | "REJECT" | "CONFIRM_NUMERIC" | "INVALID_FALLBACK";

export interface AnalisaResiResult {
  resi: string;
  valid: boolean;
  status: AnalisaResiStatus;
  layanan: string | null;
  aturan: ResiRule | null;
  pesan: string;
  kodeError?: string;
}

export const DEFAULT_RESI_RULES: ResiRule[] = [
  {
    prefix: "JX",
    panjangTotal: 12,
    panjangMax: 14,
    tipe: "HURUF_ANGKA",
    layanan: "Express Ecommerce",
    aktif: true,
    bawaan: true,
  },
  {
    prefix: "JY",
    panjangTotal: 12,
    panjangMax: 14,
    tipe: "HURUF_ANGKA",
    layanan: "Express Ecommerce",
    aktif: true,
    bawaan: true,
  },
  {
    prefix: "JZ",
    panjangTotal: 12,
    panjangMax: 14,
    tipe: "HURUF_ANGKA",
    layanan: "Express Ecommerce",
    aktif: true,
    bawaan: true,
  },
  {
    prefix: "JO",
    panjangTotal: 12,
    panjangMax: 14,
    tipe: "HURUF_ANGKA",
    layanan: "Express Ecommerce",
    aktif: true,
    bawaan: true,
  },
  {
    prefix: "JD",
    panjangTotal: 12,
    tipe: "HURUF_ANGKA",
    layanan: "Express Reguler",
    aktif: true,
    bawaan: true,
  },
  {
    prefix: "2018",
    panjangTotal: 12,
    tipe: "ANGKA",
    layanan: "J&T Cargo",
    aktif: true,
    bawaan: true,
  },
  {
    prefix: "5707",
    panjangTotal: 12,
    tipe: "ANGKA",
    layanan: "J&T Cargo",
    aktif: true,
    bawaan: true,
  },
  {
    prefix: "136",
    panjangTotal: 10,
    tipe: "ANGKA",
    layanan: "Express VIP",
    aktif: true,
    bawaan: true,
  },
];

export function normalizeResi(raw: string): string {
  return String(raw || "").replace(/\s+/g, "").toUpperCase();
}

function createFallbackRule(prefix: string): ResiRule {
  const clean = prefix.trim().toUpperCase();
  const def = DEFAULT_RESI_RULES.find((d) => d.prefix === clean);
  if (def) return { ...def };
  const isNumeric = /^\d+$/.test(clean);
  return {
    prefix: clean,
    panjangTotal: clean.length + 10,
    panjangMax: clean.length + 12,
    tipe: isNumeric ? "ANGKA" : "HURUF_ANGKA",
    layanan: "",
    aktif: true,
    bawaan: false,
  };
}

/**
 * Menambahkan aturan bawaan yang belum ada secara non-destruktif dan idempoten.
 * Tidak menghapus atau menimpa prefix kustom maupun status aktif yang diubah Owner.
 */
export function seedDefaultResiRules(existing: ResiRule[]): {
  rules: ResiRule[];
  changed: boolean;
} {
  const result: ResiRule[] = [];
  const seen = new Set<string>();
  let changed = false;

  for (const r of existing) {
    const prefix = String(r?.prefix || "").trim().toUpperCase();
    if (!prefix || seen.has(prefix)) {
      changed = true;
      continue;
    }
    seen.add(prefix);
    const def = DEFAULT_RESI_RULES.find((d) => d.prefix === prefix);
    const panjangTotal =
      Number(r.panjangTotal) > prefix.length
        ? Number(r.panjangTotal)
        : def?.panjangTotal ?? prefix.length + 10;
    const panjangMax =
      r.panjangMax !== undefined && Number(r.panjangMax) >= panjangTotal
        ? Number(r.panjangMax)
        : def?.panjangMax;

    result.push({
      prefix,
      panjangTotal,
      ...(panjangMax ? { panjangMax } : {}),
      tipe:
        r.tipe === "ANGKA" || r.tipe === "HURUF_ANGKA"
          ? r.tipe
          : def?.tipe ?? (/^\d+$/.test(prefix) ? "ANGKA" : "HURUF_ANGKA"),
      layanan: r.layanan !== undefined ? String(r.layanan) : def?.layanan ?? "",
      aktif: typeof r.aktif === "boolean" ? r.aktif : true,
      bawaan: typeof r.bawaan === "boolean" ? r.bawaan : Boolean(def),
    });
  }

  for (const def of DEFAULT_RESI_RULES) {
    if (!seen.has(def.prefix)) {
      seen.add(def.prefix);
      result.push({ ...def });
      changed = true;
    }
  }

  return { rules: result, changed };
}

/**
 * Membaca CONFIG_KEYS.RESI_PREFIXES dengan dukungan mundur:
 * - JSON array ResiRule[] (format baru)
 * - String dipisah koma/spasi/titik-koma (format lama, mis. "JX, JY, JZ")
 */
export function parseResiRules(rawValue: string | null | undefined): {
  rules: ResiRule[];
  migratedOrSeeded: boolean;
} {
  const raw = (rawValue || "").trim();
  if (!raw) {
    return {
      rules: DEFAULT_RESI_RULES.map((r) => ({ ...r })),
      migratedOrSeeded: true,
    };
  }

  let parsed: ResiRule[] = [];
  let migrated = false;

  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        parsed = arr
          .map((item: any) => {
            if (typeof item === "string") {
              migrated = true;
              return createFallbackRule(item);
            }
            return item as ResiRule;
          })
          .filter((item) => item && typeof item.prefix === "string" && item.prefix.trim() !== "");
      }
    } catch {
      parsed = [];
    }
  }

  if (parsed.length === 0 && !raw.startsWith("[")) {
    migrated = true;
    const tokens = raw
      .split(/[\s,;]+/)
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean);
    parsed = tokens.map((token) => createFallbackRule(token));
  }

  const seeded = seedDefaultResiRules(parsed);
  return {
    rules: seeded.rules,
    migratedOrSeeded: migrated || seeded.changed,
  };
}

export function getResiRules(): ResiRule[] {
  const raw = Config.get(CONFIG_KEYS.RESI_PREFIXES);
  const { rules, migratedOrSeeded } = parseResiRules(raw);
  if (migratedOrSeeded) {
    Config.set(CONFIG_KEYS.RESI_PREFIXES, JSON.stringify(rules));
  }
  return rules;
}

export function saveResiRules(rules: ResiRule[], syncToCloud = true): ResiRule[] {
  const { rules: normalized } = seedDefaultResiRules(rules);
  Config.set(CONFIG_KEYS.RESI_PREFIXES, JSON.stringify(normalized));
  try {
    window.dispatchEvent(new Event("jt_config_updated"));
  } catch (_) {}
  if (syncToCloud) {
    Config.saveToSheet();
  }
  return normalized;
}

function matchRuleBody(resi: string, rule: ResiRule): {
  isDigitsOnly: boolean;
  lenOk: boolean;
  sisa: string;
  minDigits: number;
  maxDigits: number;
} {
  const prefixLen = rule.prefix.length;
  const minDigits = Math.max(1, rule.panjangTotal - prefixLen);
  const maxDigits = Math.max(minDigits, (rule.panjangMax ?? rule.panjangTotal) - prefixLen);
  const sisa = resi.slice(prefixLen);
  const isDigitsOnly = /^\d+$/.test(sisa);
  const lenOk = sisa.length >= minDigits && sisa.length <= maxDigits;
  return { isDigitsOnly, lenOk, sisa, minDigits, maxDigits };
}

/**
 * Fungsi tunggal terpusat untuk menganalisa dan memvalidasi nomor resi
 * dari kamera, ketik manual, dan paste.
 */
export function analisaResi(raw: string, rulesOverride?: ResiRule[]): AnalisaResiResult {
  const resi = normalizeResi(raw);
  if (!resi) {
    return {
      resi: "",
      valid: false,
      status: "INVALID_FALLBACK",
      layanan: null,
      aturan: null,
      kodeError: "ERR-RESI-000",
      pesan:
        "[ERR-RESI-000] Nomor resi kosong. Penyebab: Belum ada barcode atau nomor resi yang masuk. Solusi: Scan barcode atau ketik nomor resi.",
    };
  }

  const allRules = rulesOverride ?? getResiRules();
  const activeRules = allRules
    .filter((r) => r.aktif)
    .sort((a, b) => b.prefix.length - a.prefix.length);

  const matchedRule = activeRules.find((r) => resi.startsWith(r.prefix)) || null;

  if (matchedRule) {
    const { isDigitsOnly, lenOk, sisa, minDigits, maxDigits } = matchRuleBody(resi, matchedRule);

    if (isDigitsOnly && lenOk) {
      return {
        resi,
        valid: true,
        status: "VALID",
        layanan: matchedRule.layanan ? matchedRule.layanan : null,
        aturan: matchedRule,
        pesan: "",
      };
    }

    if (matchedRule.tipe === "HURUF_ANGKA") {
      if (!isDigitsOnly) {
        return {
          resi,
          valid: false,
          status: "REJECT",
          layanan: matchedRule.layanan ? matchedRule.layanan : null,
          aturan: matchedRule,
          kodeError: "ERR-RESI-003",
          pesan: `[ERR-RESI-003] Format resi ${matchedRule.prefix} tidak valid (${resi}). Penyebab: Setelah awalan ${matchedRule.prefix} hanya boleh berisi angka. Solusi: Scan ulang atau periksa nomor resi.`,
        };
      }

      const expectedLabel =
        minDigits === maxDigits ? `${minDigits} angka` : `${minDigits}-${maxDigits} angka`;
      return {
        resi,
        valid: false,
        status: "REJECT",
        layanan: matchedRule.layanan ? matchedRule.layanan : null,
        aturan: matchedRule,
        kodeError: "ERR-RESI-002",
        pesan: `[ERR-RESI-002] Resi ${matchedRule.prefix} harus ${matchedRule.prefix} + ${expectedLabel} (terbaca ${sisa.length} angka). Penyebab: Nomor resi kurang atau berlebih digit. Solusi: Scan ulang atau periksa nomor resi.`,
      };
    }

    // Tipe ANGKA (mis. 2018, 5707, 136)
    if (!/^\d+$/.test(resi)) {
      return {
        resi,
        valid: false,
        status: "INVALID_FALLBACK",
        layanan: null,
        aturan: matchedRule,
        kodeError: "ERR-RESI-001",
        pesan: `[ERR-RESI-001] Barcode terbaca (${resi}) bukan resi angka valid. Penyebab: Terdapat huruf setelah awalan ${matchedRule.prefix}. Solusi: Pastikan memindai barcode nomor resi J&T.`,
      };
    }

    const expectedTotalLabel =
      matchedRule.panjangMax && matchedRule.panjangMax !== matchedRule.panjangTotal
        ? `${matchedRule.panjangTotal}-${matchedRule.panjangMax} angka`
        : `${matchedRule.panjangTotal} angka`;

    return {
      resi,
      valid: false,
      status: "CONFIRM_NUMERIC",
      layanan: matchedRule.layanan ? matchedRule.layanan : null,
      aturan: matchedRule,
      kodeError: "WARN-RESI-001",
      pesan: `Awalan ${matchedRule.prefix} dikenali sebagai ${
        matchedRule.layanan || "Layanan Terdaftar"
      } (${expectedTotalLabel}), tetapi terbaca ${resi.length} angka. Periksa lagi sebelum menyimpan.`,
    };
  }

  // Awalan tidak dikenal: perilaku tetap sama seperti versi sebelumnya (^\d{10,12}$ untuk numerik murni)
  if (/^\d{10,12}$/.test(resi)) {
    return {
      resi,
      valid: true,
      status: "VALID",
      layanan: null,
      aturan: null,
      pesan: "",
    };
  }

  return {
    resi,
    valid: false,
    status: "INVALID_FALLBACK",
    layanan: null,
    aturan: null,
    kodeError: "ERR-RESI-001",
    pesan: `[ERR-RESI-001] Barcode terbaca (${resi}) tapi formatnya tidak sesuai pola resi J&T. Penyebab: Awalan atau panjang barcode tidak dikenali. Solusi: Pastikan memindai barcode resi yang benar.`,
  };
}

/**
 * Menurunkan label layanan dari nomor resi berdasarkan aturan aktif.
 * Mengembalikan null bila awalan tidak dikenal atau tidak cocok pola aturan aktif.
 */
export function getLayananResi(resi: string, rulesOverride?: ResiRule[]): string | null {
  const clean = normalizeResi(resi);
  if (!clean) return null;
  const allRules = rulesOverride ?? getResiRules();
  const activeRules = allRules
    .filter((r) => r.aktif && r.layanan)
    .sort((a, b) => b.prefix.length - a.prefix.length);

  for (const rule of activeRules) {
    if (!clean.startsWith(rule.prefix)) continue;
    const { isDigitsOnly, lenOk } = matchRuleBody(clean, rule);
    if (isDigitsOnly && lenOk) {
      return rule.layanan;
    }
  }
  return null;
}
