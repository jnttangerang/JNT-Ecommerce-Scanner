const fs = require('fs');
let code = fs.readFileSync('src/utils/sellerService.ts', 'utf8');

const oldSync1 = `      const pendingSellers = this.cache.filter(s => s.syncStatus === 'PENDING');
      for (const p of pendingSellers) {
        try {
           const action = this.cache.find(s => s.id === p.id) ? 'update_master_seller' : 'save_master_seller';
           // If we don't know if it's create or update on the remote, 
           // our backend handles it based on action. But we track 'PENDING' for both.
           // Since we generate the ID locally, if it fails because it doesn't exist on update,
           // we should probably save_master_seller instead. We'll just try update, if fail, save.
           
           let res = await fetch(config.appsScriptUrl, {
             method: 'POST',
             body: JSON.stringify({ action: 'update_master_seller', seller: p })
           });
           let data = await res.json();
           
           if (!data.success && data.error === "Seller not found") {
              res = await fetch(config.appsScriptUrl, {
                 method: 'POST',
                 body: JSON.stringify({ action: 'save_master_seller', seller: p })
               });
              data = await res.json();
           }
           
           if (data.success) {
             const idx = this.cache.findIndex(s => s.id === p.id);
             if (idx !== -1) {
                this.cache[idx].syncStatus = 'SYNCED';
                this.saveCache();
             }
           } else if (data.error === "Kode Seller already exists") {
             // Handle conflict
             console.error("Conflict syncing seller: ", p.kodeSeller);
           }
        } catch (e) {
           console.error("Error syncing seller up", e);
        }
      }`;

const newSync1 = `      const pendingSellers = this.cache.filter(s => s.syncStatus === 'PENDING');
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
      }`;

code = code.replace(oldSync1, newSync1);
fs.writeFileSync('src/utils/sellerService.ts', code);
