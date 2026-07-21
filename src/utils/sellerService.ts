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
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cache));
  }

  setSellers(sellers: Seller[]) {
    this.cache = sellers;
    this.saveCache();
  }

  getAll(): Seller[] {
    if (this.cache.length === 0) {
      const configRawSellers = localStorage.getItem('jt_config_SELLERS');
      if (configRawSellers && configRawSellers !== '[]') {
        this.cache = this.parseSellersFromRaw(configRawSellers);
        this.saveCache();
      }
    }
    return this.cache;
  }

  getById(id: string): Seller | undefined {
    return this.cache.find(s => s.id === id);
  }

  search(query: string): Seller[] {
    const q = query.toLowerCase();
    return this.cache.filter(s => 
      s.nama.toLowerCase().includes(q) || 
      s.kodeSeller.toLowerCase().includes(q)
    );
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
         if (data.success && data.values) {
            // merge data
            const remoteSellers: Seller[] = data.values.map((row: any) => ({
               id: row[0],
               kodeSeller: row[1],
               nama: row[2],
               kategoriProduk: row[3],
               noHp: row[4],
               alamat: row[5],
               gps: row[6],
               statusAktif: row[7],
               targetHarian: Number(row[8]) || 0,
               catatan: row[9],
               updatedAt: row[10],
               syncStatus: 'SYNCED'
            }));
            
            // Only overwrite if we don't have pending changes for that ID
            remoteSellers.forEach(rs => {
               const idx = this.cache.findIndex(ls => ls.id === rs.id);
               if (idx === -1) {
                  this.cache.push(rs);
               } else if (this.cache[idx].syncStatus !== 'PENDING') {
                  this.cache[idx] = rs;
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
