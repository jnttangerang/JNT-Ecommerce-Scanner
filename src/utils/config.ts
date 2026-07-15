import { fetchWithAuth } from './sheets';


// DATA_MASTER schema keys as constants
export const CONFIG_KEYS = {
  APP_VERSION: 'APP_VERSION',
  OWNER_PASSWORD: 'OWNER_PASSWORD',
  RESI_PREFIXES: 'RESI_PREFIXES',
  OUTLETS: 'OUTLETS',
  OPERATORS: 'OPERATORS',
  SELLERS: 'SELLERS', // Adding SELLERS to match legacy
  DAILY_TARGET: 'DAILY_TARGET',
  GOOGLE_SHEET_ID: 'GOOGLE_SHEET_ID',
  GOOGLE_DRIVE_FOLDER: 'GOOGLE_DRIVE_FOLDER',
  APPS_SCRIPT_URL: 'APPS_SCRIPT_URL',
  OFFLINE_MODE: 'OFFLINE_MODE',
  AUTO_SYNC_INTERVAL: 'AUTO_SYNC_INTERVAL',
  CAMERA_QUALITY: 'CAMERA_QUALITY',
  CAMERA_RESOLUTION: 'CAMERA_RESOLUTION',
  CAMERA_SHARPNESS: 'CAMERA_SHARPNESS',
  CAMERA_SOUND: 'CAMERA_SOUND',
  CAMERA_VIBRATE: 'CAMERA_VIBRATE',
  CANCEL_REQUIRE_PHOTO: 'CANCEL_REQUIRE_PHOTO',
  RETAKE_REQUIRE_PHOTO: 'RETAKE_REQUIRE_PHOTO',
  ENABLE_OWNER_REVIEW: 'ENABLE_OWNER_REVIEW',
  ENABLE_DUPLICATE_CHECK: 'ENABLE_DUPLICATE_CHECK',
  ENABLE_SCAN_SOUND: 'ENABLE_SCAN_SOUND',
  ENABLE_GPS: 'ENABLE_GPS',
  ENABLE_MAP: 'ENABLE_MAP',
  ENABLE_SELLER_MASTER: 'ENABLE_SELLER_MASTER',

  // Also include the local selection keys that aren't necessarily master data,
  // but need to use config instead of direct localStorage to fulfill the requirement:
  // "Replace Existing Storage... jt_saved_outlet, jt_saved_operator, jt_saved_seller... Replace with ConfigService"
  SAVED_OUTLET: 'SAVED_OUTLET',
  SAVED_SELLER: 'SAVED_SELLER',
  SAVED_OPERATOR: 'SAVED_OPERATOR',
  CURRENT_VIEW: 'CURRENT_VIEW',
  OWNER_AUTHENTICATED: 'OWNER_AUTHENTICATED',
  IS_CLOUD_DATA_FRESH: 'IS_CLOUD_DATA_FRESH',
  COMPLETED_REVIEW_RECORDS: 'COMPLETED_REVIEW_RECORDS',
  REVIEW_COMPLETED_DATE: 'REVIEW_COMPLETED_DATE',
};

const DEFAULT_CONFIG: Record<string, string> = {
  [CONFIG_KEYS.APP_VERSION]: '1.0.0',
  [CONFIG_KEYS.OWNER_PASSWORD]: 'jntowner',
  [CONFIG_KEYS.RESI_PREFIXES]: 'JX,JZ',
  [CONFIG_KEYS.OUTLETS]: '[{"NamaOutlet":"J&T Pasir Jaha Balaraja"},{"NamaOutlet":"J&T Jayanti"},{"NamaOutlet":"J&T Cikupa Mas"}]',
  [CONFIG_KEYS.OPERATORS]: '[{"NamaOperator":"FITRI FAJRIA"},{"NamaOperator":"M. HARI YANTO"},{"NamaOperator":"M. DANANG"}]',
  [CONFIG_KEYS.SELLERS]: '[]',
  [CONFIG_KEYS.DAILY_TARGET]: '150',
  [CONFIG_KEYS.GOOGLE_SHEET_ID]: '12ly2pM3Vof9IKTwjselkLUX6sMdcdI6rcb_KvbjcQ_Y',
  [CONFIG_KEYS.GOOGLE_DRIVE_FOLDER]: '19peJr4JWqKA6Ei4AwuXgohhF2C59ugyp',
  [CONFIG_KEYS.APPS_SCRIPT_URL]: 'https://script.google.com/macros/s/AKfycbxHsd-wqkrjRxHvasCZ6_a-G0T36x5nZIXJ1fVn18C56TUU0lD3Hm45AHNNxdMIrxsw/exec',
  [CONFIG_KEYS.OFFLINE_MODE]: 'false',
  [CONFIG_KEYS.SAVED_OUTLET]: '',
  [CONFIG_KEYS.SAVED_SELLER]: '',
  [CONFIG_KEYS.SAVED_OPERATOR]: '',
  [CONFIG_KEYS.CURRENT_VIEW]: 'WELCOME',
  [CONFIG_KEYS.OWNER_AUTHENTICATED]: 'false',
  [CONFIG_KEYS.IS_CLOUD_DATA_FRESH]: 'false',
  [CONFIG_KEYS.COMPLETED_REVIEW_RECORDS]: '[]',
  [CONFIG_KEYS.REVIEW_COMPLETED_DATE]: '',
};

class ConfigurationService {
  private cache: Record<string, string> = {};
  private readonly CACHE_PREFIX = 'jt_config_';
  private syncInProgress = false;

  constructor() {
    this.loadCache();
  }

  loadCache() {
    this.cache = { ...DEFAULT_CONFIG };
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          const configKey = key.substring(this.CACHE_PREFIX.length);
          this.cache[configKey] = value;
        }
      }
    }
    
    // Legacy migration
    this.migrateLegacyKeys();
  }

  private migrateLegacyKeys() {
    const legacyMap: Record<string, string> = {
      'jt_owner_password': CONFIG_KEYS.OWNER_PASSWORD,
      'jt_saved_outlet': CONFIG_KEYS.SAVED_OUTLET,
      'jt_saved_operator': CONFIG_KEYS.SAVED_OPERATOR,
      'jt_saved_seller': CONFIG_KEYS.SAVED_SELLER,
      'jt_pickup_outlets': CONFIG_KEYS.OUTLETS,
      'jt_pickup_operators': CONFIG_KEYS.OPERATORS,
      'jt_pickup_sellers': CONFIG_KEYS.SELLERS, // Adding for sellers
      'jt_pickup_daily_target': CONFIG_KEYS.DAILY_TARGET,
      'jt_pickup_offline_mode': CONFIG_KEYS.OFFLINE_MODE,
      'jt_current_view': CONFIG_KEYS.CURRENT_VIEW,
      'jt_owner_authenticated': CONFIG_KEYS.OWNER_AUTHENTICATED,
      'jt_is_cloud_data_fresh': CONFIG_KEYS.IS_CLOUD_DATA_FRESH,
      'jt_completed_review_records': CONFIG_KEYS.COMPLETED_REVIEW_RECORDS,
      'jt_review_completed_date': CONFIG_KEYS.REVIEW_COMPLETED_DATE,
    };

    let migrated = false;
    for (const [legacyKey, newKey] of Object.entries(legacyMap)) {
      const val = localStorage.getItem(legacyKey);
      if (val !== null && !localStorage.getItem(this.CACHE_PREFIX + newKey)) {
        this.set(newKey, val);
        migrated = true;
      }
    }
    
    // Also migrate cloud config
    const legacyCloudConfig = localStorage.getItem('jt_pickup_cloud_config');
    if (legacyCloudConfig && !localStorage.getItem(this.CACHE_PREFIX + CONFIG_KEYS.GOOGLE_SHEET_ID)) {
      try {
        const parsed = JSON.parse(legacyCloudConfig);
        if (parsed.spreadsheetId) this.set(CONFIG_KEYS.GOOGLE_SHEET_ID, parsed.spreadsheetId);
        if (parsed.fotoFolderId) this.set(CONFIG_KEYS.GOOGLE_DRIVE_FOLDER, parsed.fotoFolderId);
        migrated = true;
      } catch (e) {}
    }
  }

  saveCache() {
    for (const key of Object.keys(this.cache)) {
      localStorage.setItem(this.CACHE_PREFIX + key, this.cache[key]);
    }
  }

  get(key: string): string {
    return this.cache[key] ?? DEFAULT_CONFIG[key] ?? '';
  }

  set(key: string, value: string) {
    this.cache[key] = value;
    localStorage.setItem(this.CACHE_PREFIX + key, value);
  }

  async sync(accessToken?: string) {
    if (this.syncInProgress) return;
    this.syncInProgress = true;
    
    try {
      const spreadsheetId = this.get(CONFIG_KEYS.GOOGLE_SHEET_ID);
      if (!spreadsheetId) {
        this.syncInProgress = false;
        return;
      }

      let success = false;
      let values: any[][] = [];

      // Try reading DATA_MASTER via Sheets API if accessToken is available
      if (accessToken) {
        try {
          const res = await fetchWithAuth(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DATA_MASTER!A2:B`,
            { method: 'GET' },
            accessToken
          );

          if (res.ok) {
            const data = await res.json();
            values = data.values || [];
            success = true;
          } else if (res.status === 400) {
            // Sheet might not exist, let's create it
            await this.createDataMaster(spreadsheetId, accessToken);
          }
        } catch (apiErr) {
          console.warn("Direct Sheets API sync failed, will try fallback", apiErr);
        }
      }

      // Fallback: Try reading via Apps Script Web App
      if (!success) {
        const appsScriptUrl = this.get(CONFIG_KEYS.APPS_SCRIPT_URL);
        if (appsScriptUrl && !appsScriptUrl.includes("Example_Apps_Script_Web_App") && !appsScriptUrl.includes("AKfycbz_Example")) {
          try {
            const getUrl = `${appsScriptUrl}${appsScriptUrl.includes("?") ? "&" : "?"}action=get_data_master&_t=${Date.now()}`;
            const response = await fetch(getUrl, {
              method: "GET",
              mode: "cors"
            });
            const resJson = await response.json();
            if (resJson && resJson.success) {
              values = resJson.values || [];
              success = true;
            }
          } catch (scriptErr) {
            console.warn("Config sync via Apps Script failed:", scriptErr);
          }
        }
      }

      if (success && values.length > 0) {
        for (const row of values) {
          const key = row[0];
          const val = row[1];
          if (key && val !== undefined) {
            this.set(key, String(val));
          }
        }
      }
    } catch (e) {
      console.error("Failed to sync config:", e);
    } finally {
      this.syncInProgress = false;
    }
  }
  
  async saveToSheet(accessToken?: string) {
    const spreadsheetId = this.get(CONFIG_KEYS.GOOGLE_SHEET_ID);
    if (!spreadsheetId) return;

    // Keys that should be synced to DATA_MASTER
    const masterKeys = [
      CONFIG_KEYS.APP_VERSION,
      CONFIG_KEYS.OWNER_PASSWORD,
      CONFIG_KEYS.RESI_PREFIXES,
      CONFIG_KEYS.OUTLETS,
      CONFIG_KEYS.OPERATORS,
      CONFIG_KEYS.SELLERS,
      CONFIG_KEYS.DAILY_TARGET,
      CONFIG_KEYS.GOOGLE_SHEET_ID,
      CONFIG_KEYS.GOOGLE_DRIVE_FOLDER,
      CONFIG_KEYS.APPS_SCRIPT_URL,
      CONFIG_KEYS.OFFLINE_MODE,
      CONFIG_KEYS.AUTO_SYNC_INTERVAL,
      CONFIG_KEYS.CAMERA_QUALITY,
      CONFIG_KEYS.CAMERA_RESOLUTION,
      CONFIG_KEYS.CAMERA_SHARPNESS,
      CONFIG_KEYS.CAMERA_SOUND,
      CONFIG_KEYS.CAMERA_VIBRATE,
      CONFIG_KEYS.CANCEL_REQUIRE_PHOTO,
      CONFIG_KEYS.RETAKE_REQUIRE_PHOTO,
      CONFIG_KEYS.ENABLE_OWNER_REVIEW,
      CONFIG_KEYS.ENABLE_DUPLICATE_CHECK,
      CONFIG_KEYS.ENABLE_SCAN_SOUND,
      CONFIG_KEYS.ENABLE_GPS,
      CONFIG_KEYS.ENABLE_MAP,
      CONFIG_KEYS.ENABLE_SELLER_MASTER,
    ];

    const values = masterKeys.map(k => [k, this.get(k), ""]);

    // If no accessToken is provided, try to dynamically fetch it
    if (!accessToken) {
      try {
        const { getAccessToken } = await import("./auth");
        accessToken = (await getAccessToken()) || undefined;
      } catch (authErr) {
        console.warn("Failed to get accessToken for config saving", authErr);
      }
    }

    let success = false;

    // Try direct Sheets API PUT if accessToken is available
    if (accessToken) {
      try {
        const res = await fetchWithAuth(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DATA_MASTER!A2:C?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values })
          },
          accessToken
        );
        
        if (res.ok) {
          success = true;
        } else if (res.status === 400) {
          await this.createDataMaster(spreadsheetId, accessToken);
          const retryRes = await fetchWithAuth(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DATA_MASTER!A2:C?valueInputOption=USER_ENTERED`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ values })
            },
            accessToken
          );
          if (retryRes.ok) success = true;
        }
      } catch (apiErr) {
        console.warn("Failed to save config via Sheets API, trying fallback", apiErr);
      }
    }

    // Fallback: Try saving via Apps Script Web App
    if (!success) {
      const appsScriptUrl = this.get(CONFIG_KEYS.APPS_SCRIPT_URL);
      if (appsScriptUrl && !appsScriptUrl.includes("Example_Apps_Script_Web_App") && !appsScriptUrl.includes("AKfycbz_Example")) {
        const keysValues = masterKeys.map(k => ({ key: k, value: this.get(k) }));
        try {
          const response = await fetch(appsScriptUrl, {
            method: "POST",
            mode: "cors",
            headers: {
              "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
              action: "save_data_master",
              keysValues
            })
          });
          const resJson = await response.json();
          if (resJson && resJson.success) {
            success = true;
          }
        } catch (scriptErr) {
          console.warn("Failed to save config via Apps Script:", scriptErr);
        }
      }
    }
  }

  private async createDataMaster(spreadsheetId: string, accessToken: string) {
    try {
      await fetchWithAuth(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: [{ addSheet: { properties: { title: "DATA_MASTER" } } }] })
        },
        accessToken
      );
      
      await fetchWithAuth(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DATA_MASTER!A1:C1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [["KEY", "VALUE", "DESCRIPTION"]] })
        },
        accessToken
      );
    } catch (e) {
      console.error("Failed to create DATA_MASTER", e);
    }
  }

  // Clear non-master keys from cache
  clearSessionCache() {
    const keysToKeep = Object.keys(this.cache).filter(k => 
      Object.values(CONFIG_KEYS).includes(k) && 
      k !== CONFIG_KEYS.SAVED_OUTLET &&
      k !== CONFIG_KEYS.SAVED_SELLER &&
      k !== CONFIG_KEYS.SAVED_OPERATOR &&
      k !== CONFIG_KEYS.CURRENT_VIEW &&
      k !== CONFIG_KEYS.OWNER_AUTHENTICATED
    );

    const keptData: Record<string, string> = {};
    for (const k of keysToKeep) {
      keptData[k] = this.get(k);
    }

    // Actually clear localStorage completely for the config cache
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_PREFIX)) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) localStorage.removeItem(key);

    this.cache = {};
    for (const k of Object.keys(keptData)) {
      this.set(k, keptData[k]);
    }
  }
}

export const Config = new ConfigurationService();
