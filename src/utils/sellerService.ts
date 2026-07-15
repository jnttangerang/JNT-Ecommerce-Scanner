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
  }

  saveCache() {
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cache));
  }

  getAll(): Seller[] {
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
           console.error("Error syncing sellers up", e);
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
      console.error("Failed to sync sellers:", e);
    } finally {
      this.syncInProgress = false;
    }
  }
}

export const SellerService = new SellerServiceManager();
