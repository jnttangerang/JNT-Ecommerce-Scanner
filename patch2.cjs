const fs = require('fs');
let db = fs.readFileSync('src/utils/db.ts', 'utf8');

const t1 = `      // Try to get Access Token for native Google Drive upload
      let accessToken = null;
      try {
        const { getAccessToken } = await import("./auth");
        accessToken = await getAccessToken();
      } catch(e) {}

      const processedPending = [];
      for (const r of pending) {
        let finalPhotoUrl = r.PhotoURL;
        if (accessToken && r.PhotoURL && r.PhotoURL.startsWith("data:image")) {
          try {
            const base64Data = r.PhotoURL.split(',')[1];
            // Decode base64 to Uint8Array
            const binaryStr = atob(base64Data);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }

            const metadata: any = {
              name: \`\${r.Resi}.jpg\`,
              mimeType: 'image/jpeg'
            };

            let parentId = "";
            if (config.fotoFolderId) {
               const match = config.fotoFolderId.match(/folders\\/([a-zA-Z0-9_-]+)/);
               if (match) parentId = match[1];
               else parentId = config.fotoFolderId;
            }
            if (parentId) metadata.parents = [parentId];

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([bytes], { type: 'image/jpeg' }));

            const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
              method: 'POST',
              headers: { Authorization: \`Bearer \${accessToken}\` },
              body: form
            });
            if (uploadRes.ok) {
               const data = await uploadRes.json();
               finalPhotoUrl = \`https://drive.google.com/thumbnail?sz=w1000&id=\${data.id}\`;
               
               // Make it publicly viewable
               await fetch(\`https://www.googleapis.com/drive/v3/files/\${data.id}/permissions\`, {
                 method: 'POST',
                 headers: { 
                   Authorization: \`Bearer \${accessToken}\`,
                   'Content-Type': 'application/json'
                 },
                 body: JSON.stringify({ type: 'anyone', role: 'reader' })
               });
            }
          } catch (e) {
            console.warn("Direct Drive upload failed, falling back to Apps Script", e);
          }
        }
        processedPending.push({ ...r, PhotoURL: finalPhotoUrl });
      }`;

const r1 = `      // Try to get Access Token for native Google Drive upload (disabled)
      let accessToken = null;
      try {
        const { getAccessToken } = await import("./auth");
        accessToken = await getAccessToken();
      } catch(e) {}

      const processedPending = [];
      for (const r of pending) {
        let finalPhotoUrl = r.PhotoURL;
        // DISABLED DRIVE INTEGRATION: We do not upload to Google Drive directly anymore.
        processedPending.push({ ...r, PhotoURL: finalPhotoUrl });
      }`;

db = db.replace(t1, r1);
fs.writeFileSync('src/utils/db.ts', db);
