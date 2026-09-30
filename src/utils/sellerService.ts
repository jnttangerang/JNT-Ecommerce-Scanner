import { Seller } from '../types';
import { fetchWithAuth } from './sheets';
import { dbService } from './db';

class SellerServiceManager {
  private cache: Seller[] = [];
  private readonly CACHE_KEY = 'jt_master_seller_cache';
  private syncInProgress = false;

  constructor() {
    this.loadCache();
  }

  parseSellersFromRaw(raw: string): Seller[] {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any, idx: number) => {
          if (typeof item === 'string') {
            return {
              id: `SEL_RAW_${idx}_${item.replace(/[^A-Z0-9]/ig, '')}`,
              kodeSeller: `KS-${item.replace(/[^A-Z0-9]/ig, '') || idx}`,
              nama: item.trim(),
              statusAktif: 'ACTIVE' as const,
              syncStatus: 'SYNCED' as const
            };
          } else if (item && typeof item === 'object') {
            const nama = item.NamaSeller || item.nama || item.Nama || item.SellerName || item.Nama_Seller || '';
            const kodeSeller = item.kodeSeller || item.KodeSeller || item.kode || `KS-${nama.replace(/[^A-Z0-9]/ig, '') || idx}`;
            const id = item.id || item.ID || `SEL_RAW_${idx}_${nama.replace(/[^A-Z0-9]/ig, '')}`;
            return {
              id: id,
              kodeSeller: kodeSeller,
              nama: nama.trim(),
              statusAktif: item.statusAktif || item.StatusAktif || 'ACTIVE',
              kategoriProduk: item.kategoriProduk || item.KategoriProduk,
              noHp: item.noHp || item.NoHp || item.no_hp || item.No_HP,
              alamat: item.alamat || item.Alamat,
              gps: item.gps || item.GPS,
              targetHarian: Number(item.targetHarian || item.TargetHarian) || 0,
              catatan: item.catatan || item.Catatan,
              updatedAt: item.updatedAt || item.UpdatedAt,
              createdAt: item.createdAt || item.CreatedAt,
              syncStatus: 'SYNCED' as const
            };
          }
          return null;
        }).filter(Boolean) as Seller[];
      }
    } catch (e) {
      console.warn("Failed to parse raw sellers:", e);
    }
    return [];
  }

  loadCache() {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      if (raw) {
        this.cache = JSON.parse(raw);
      } else {
        this.cache = [];
      }
    } catch (e) {
      this.cache = [];
    }

    if (this.cache.length === 0) {
      const configRawSellers = localStorage.getItem('jt_config_SELLERS');
      if (configRawSellers && configRawSellers !== '[]') {
        this.cache = this.parseSellersFromRaw(configRawSellers);
        this.saveCache();
      }
    }
  }

  saveCache() {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cache));
    } catch (e) {
      console.warn("Could not save seller cache to localStorage:", e);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("jt_sellers_updated", { detail: this.cache }));
      window.dispatchEvent(new Event("jt_db_updated"));
    }
  }

  setSellers(sellers: Seller[]) {
    // Upsert/merge incoming sellers into existing cache instead of wiping out MASTER_SELLER data
    const uniqueSellers = new Map<string, Seller>();

    // 1. Preserve existing cache first (especially enriched records from MASTER_SELLER)
    this.cache.forEach(s => {
      if (s && s.nama && s.nama.trim()) {
        uniqueSellers.set(s.nama.trim().toLowerCase(), s);
      }
    });

    // 2. Merge incoming sellers
    sellers.forEach(s => {
      if (s && s.nama && s.nama.trim()) {
        const key = s.nama.trim().toLowerCase();
        const existing = uniqueSellers.get(key);
        if (existing) {
          uniqueSellers.set(key, {
            ...s,
            ...existing,
            nama: s.nama.trim(),
            statusAktif: existing.statusAktif || s.statusAktif || 'ACTIVE',
            syncStatus: existing.syncStatus || s.syncStatus || 'SYNCED'
          });
        } else {
          uniqueSellers.set(key, {
            ...s,
            nama: s.nama.trim()
          });
        }
      }
    });

    this.cache = Array.from(uniqueSellers.values());
    this.saveCache();
  }

  getAll(): Seller[] {
    if (this.cache.length === 0) {
      this.loadCache();
    }
    // Deduplicate and filter out any empty entries
    const unique = new Map<string, Seller>();
    this.cache.forEach(s => {
      if (s && s.nama && s.nama.trim()) {
        const cleanName = s.nama.trim();
        const key = cleanName.toLowerCase();
        if (!unique.has(key)) {
          unique.set(key, {
            ...s,
            nama: cleanName
          });
        }
      }
    });
    return Array.from(unique.values());
  }

  getById(id: string): Seller | undefined {
    return this.cache.find(s => s.id === id);
  }

  search(query: string): Seller[] {
    const q = (query || "").trim().toLowerCase();
    const all = this.getAll();
    if (!q) return all;
    return all.filter(s => {
      const name = (s.nama || "").toLowerCase();
      const code = (s.kodeSeller || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }

  async create(seller: Omit<Seller, 'id'>, accessToken?: string) {
    const newSeller: Seller = {
      ...seller,
      id: `SEL_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      syncStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Validations
    if (!newSeller.nama || !newSeller.kodeSeller) {
      throw new Error("Nama and Kode Seller are required");
    }
    if (this.cache.some(s => s.kodeSeller === newSeller.kodeSeller)) {
      throw new Error("Kode Seller already exists");
    }

    this.cache.push(newSeller);
    this.saveCache();
    
    if (accessToken) {
      await this.sync(accessToken);
    }
    return newSeller;
  }

  async update(id: string, updates: Partial<Seller>, accessToken?: string) {
    const idx = this.cache.findIndex(s => s.id === id);
    if (idx === -1) throw new Error("Seller not found");
    
    if (updates.kodeSeller) {
      if (this.cache.some(s => s.kodeSeller === updates.kodeSeller && s.id !== id)) {
        throw new Error("Kode Seller already exists");
      }
    }

    this.cache[idx] = {
      ...this.cache[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
      syncStatus: 'PENDING'
    };
    this.saveCache();
    
    if (accessToken) {
      await this.sync(accessToken);
    }
    return this.cache[idx];
  }

  async delete(id: string, accessToken?: string) {
    const idx = this.cache.findIndex(s => s.id === id);
    if (idx !== -1) {
       // Ideally we might soft delete or mark for deletion
       this.cache.splice(idx, 1);
       this.saveCache();
       // Try sync
       const config = dbService.getCloudConfig();
       if (config.appsScriptUrl) {
         try {
           await fetch(config.appsScriptUrl, {
             method: 'POST',
             body: JSON.stringify({ action: 'delete_master_seller', id })
           });
         } catch(e) {}
       }
    }
  }

  async sync(accessToken?: string) {
    if (this.syncInProgress) return;
    this.syncInProgress = true;
    
    try {
      const config = dbService.getCloudConfig();
      if (!config.appsScriptUrl || config.appsScriptUrl.includes("Example_Apps_Script_Web_App")) {
        this.syncInProgress = false;
        return;
      }
      
      // 1. Sync pending local changes TO cloud
      const pendingSellers = this.cache.filter(s => s.syncStatus === 'PENDING');
      if (pendingSellers.length > 0) {
        try {
           const res = await fetch(config.appsScriptUrl, {
             method: 'POST',
             body: JSON.stringify({ action: 'sync_master_seller', sellers: pendingSellers })
           });
           const data = await res.json();
           
           if (data.success || (data.errors && data.errors.length < pendingSellers.length)) {
             // Mark all pending as SYNCED except those that failed
             // For simplicity, we just mark all SYNCED and let the next GET overwrite with truth
             pendingSellers.forEach(p => {
               const idx = this.cache.findIndex(s => s.id === p.id);
               if (idx !== -1) {
                  this.cache[idx].syncStatus = 'SYNCED';
               }
             });
             this.saveCache();
           }
        } catch (e) {
           console.warn("Error syncing sellers up", e);
        }
      }
      
      // 2. Sync FROM cloud
      const getRes = await fetch(config.appsScriptUrl + '?action=get_master_seller');
      if (getRes.ok) {
         const data = await getRes.json();
         if (data.success && data.values && Array.isArray(data.values)) {
            const rawHeaders: string[] = Array.isArray(data.headers) 
              ? data.headers.map((h: any) => String(h || "").toLowerCase().trim()) 
              : [];

            let nameColIdx = -1;
            let codeColIdx = -1;
            let idColIdx = -1;

            if (rawHeaders.length > 0) {
              for (let c = 0; c < rawHeaders.length; c++) {
                const h = rawHeaders[c];
                if ((h.includes("nama") || h.includes("seller") || h.includes("toko")) && !h.includes("kode") && !h.includes("admin") && !h.includes("no")) {
                  if (nameColIdx === -1) nameColIdx = c;
                } else if (h.includes("kode") && codeColIdx === -1) {
                  codeColIdx = c;
                } else if (h.includes("id") && idColIdx === -1) {
                  idColIdx = c;
                }
              }
            }

            const remoteSellers: Seller[] = [];

            data.values.forEach((row: any, rIdx: number) => {
              if (!row) return;
              let id = "";
              let kodeSeller = "";
              let nama = "";
              let kategoriProduk = "";
              let noHp = "";
              let alamat = "";
              let gps = "";
              let statusAktif = "ACTIVE";
              let targetHarian = 0;
              let catatan = "";
              let updatedAt = "";

              if (Array.isArray(row)) {
                if (nameColIdx !== -1 && row[nameColIdx] !== undefined) {
                  nama = String(row[nameColIdx] || "").trim();
                }
                if (codeColIdx !== -1 && row[codeColIdx] !== undefined) {
                  kodeSeller = String(row[codeColIdx] || "").trim();
                }
                if (idColIdx !== -1 && row[idColIdx] !== undefined) {
                  id = String(row[idColIdx] || "").trim();
                }

                // If nama still empty, fallback through columns
                if (!nama) {
                  if (row[2] && String(row[2]).trim()) {
                    nama = String(row[2]).trim();
                    kodeSeller = kodeSeller || String(row[1] || "").trim();
                    id = id || String(row[0] || "").trim();
                  } else if (row[1] && String(row[1]).trim()) {
                    nama = String(row[1]).trim();
                    kodeSeller = kodeSeller || String(row[0] || "").trim();
                  } else if (row[0] && String(row[0]).trim()) {
                    nama = String(row[0]).trim();
                  }
                }

                // Skip header rows if accidentally returned
                const lowerName = nama.toLowerCase();
                if (lowerName === "nama" || lowerName === "nama seller" || lowerName === "nama_seller" || lowerName === "seller" || lowerName === "id" || lowerName === "kode") {
                  return;
                }

                if (!nama) return;

                if (!kodeSeller) {
                  kodeSeller = `KS-${nama.replace(/[^A-Z0-9]/ig, '').toUpperCase() || rIdx}`;
                }
                if (!id) {
                  id = `SEL_${nama.replace(/[^A-Z0-9]/ig, '').toUpperCase() || rIdx}`;
                }

                kategoriProduk = String(row[3] || "");
                noHp = String(row[4] || "");
                alamat = String(row[5] || "");
                gps = String(row[6] || "");
                statusAktif = String(row[7] || "ACTIVE");
                targetHarian = Number(row[8]) || 0;
                catatan = String(row[9] || "");
                updatedAt = String(row[10] || "");
              } else if (typeof row === "object") {
                nama = String(row.NamaSeller || row.nama || row.Nama || row.SellerName || row.Nama_Seller || row.seller || "").trim();
                if (!nama) return;
                const lowerName = nama.toLowerCase();
                if (lowerName === "nama" || lowerName === "nama seller") return;
                
                kodeSeller = String(row.kodeSeller || row.KodeSeller || row.kode || `KS-${nama.replace(/[^A-Z0-9]/ig, '') || rIdx}`).trim();
                id = String(row.id || row.ID || `SEL_${nama.replace(/[^A-Z0-9]/ig, '') || rIdx}`).trim();
                kategoriProduk = row.kategoriProduk || row.KategoriProduk || "";
                noHp = row.noHp || row.NoHp || "";
                alamat = row.alamat || row.Alamat || "";
                gps = row.gps || row.GPS || "";
                statusAktif = row.statusAktif || row.StatusAktif || "ACTIVE";
                targetHarian = Number(row.targetHarian || row.TargetHarian) || 0;
                catatan = row.catatan || row.Catatan || "";
                updatedAt = row.updatedAt || row.UpdatedAt || "";
              }

              remoteSellers.push({
                id,
                kodeSeller,
                nama,
                kategoriProduk,
                noHp,
                alamat,
                gps,
                statusAktif: statusAktif as any,
                targetHarian,
                catatan,
                updatedAt,
                syncStatus: "SYNCED"
              });
            });

            // Upsert remote sellers safely matching by ID or case-insensitive Name
            remoteSellers.forEach(rs => {
               const normName = rs.nama.trim().toLowerCase();
               const idx = this.cache.findIndex(ls => 
                 (rs.id && ls.id === rs.id) || 
                 (ls.nama && ls.nama.trim().toLowerCase() === normName)
               );
               if (idx === -1) {
                  this.cache.push(rs);
               } else if (this.cache[idx].syncStatus !== 'PENDING') {
                  this.cache[idx] = {
                    ...this.cache[idx],
                    ...rs,
                    nama: rs.nama.trim(),
                    syncStatus: 'SYNCED'
                  };
               }
            });
            this.saveCache();
         }
      }

    } catch (e) {
      console.warn("Failed to sync sellers:", e);
    } finally {
      this.syncInProgress = false;
    }
  }
}

export const SellerService = new SellerServiceManager();
