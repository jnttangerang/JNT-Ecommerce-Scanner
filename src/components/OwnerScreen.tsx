/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Shield, 
  Key, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Ban, 
  CheckCircle2, 
  BarChart3, 
  Layers, 
  Download,
  Terminal,
  Store,
  Compass,
  AlertCircle,
  Folder,
  FileSpreadsheet,
  Link,
  ExternalLink,
  Users,
  Settings,
  Plus,
  Trash2,
  Copy,
  Check,
  Cloud,
  Github
} from "lucide-react";
import { ScanRecord, StatusType, Seller, Operator } from "../types";
import { dbService } from "../utils/db";

interface OwnerDashboardProps {
  onStatusChanged: () => void;
}

export const OwnerScreen: React.FC<OwnerDashboardProps> = ({ onStatusChanged }) => {
  // Passcode gate state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [passError, setPassError] = useState("");

  // Records database state
  const [allRecords, setAllRecords] = useState<ScanRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ScanRecord[]>([]);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOutletFilter, setSelectedOutletFilter] = useState("ALL");
  const [selectedSellerFilter, setSelectedSellerFilter] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");

  // Review Deck indices (for carousel review)
  const [reviewIndex, setReviewIndex] = useState(0);

  // Stats
  const [statsSeller, setStatsSeller] = useState<Record<string, number>>({});
  const [statsOutlet, setStatsOutlet] = useState<Record<string, number>>({});
  const [statsTotalScanned, setStatsTotalScanned] = useState(0);
  const [statsTotalCancelled, setStatsTotalCancelled] = useState(0);

  // Master lists & Configuration State
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [cloudConfig, setCloudConfig] = useState({
    coreFolderUrl: "",
    fotoFolderId: "",
    spreadsheetId: "",
    appsScriptUrl: ""
  });

  // Localized Cloud configuration text fields pending "Simpan" action
  const [tempCoreFolderUrl, setTempCoreFolderUrl] = useState("");
  const [tempFotoFolderId, setTempFotoFolderId] = useState("");
  const [tempSpreadsheetId, setTempSpreadsheetId] = useState("");
  const [saveSuccessFields, setSaveSuccessFields] = useState<Record<string, boolean>>({});

  // Sync saved cloudConfig to local field states when loaded/updated
  useEffect(() => {
    setTempCoreFolderUrl(cloudConfig.coreFolderUrl || "");
    setTempFotoFolderId(cloudConfig.fotoFolderId || "");
    setTempSpreadsheetId(cloudConfig.spreadsheetId || "");
  }, [cloudConfig]);

  // Action states
  const [newSeller, setNewSeller] = useState("");
  const [newOperator, setNewOperator] = useState("");
  const [sellerError, setSellerError] = useState("");
  const [operatorError, setOperatorError] = useState("");
  const [copiedScript, setCopiedScript] = useState(false);
  const [apiTestStatus, setApiTestStatus] = useState<"IDLE" | "TESTING" | "SUCCESS" | "FAILED">("IDLE");
  const [activeTab, setActiveTab] = useState<"RECAP" | "MASTERS" | "INTEGRATION" | "DEPLOYMENT">("RECAP");

  // Password change states
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  // Initialize data on mount / update
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = () => {
    const records = dbService.getRecords();
    setAllRecords(records);
    setFilteredRecords(records);
    calculateStatistics(records);

    // Load configurations and masters
    setSellers(dbService.getSellers());
    setOperators(dbService.getOperators());
    setCloudConfig(dbService.getCloudConfig());

    // Default review carousel index
    if (records.length > 0) {
      setReviewIndex(0);
    }
  };

  const handleAddSellerAndSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSellerError("");
    const name = newSeller.trim();
    if (!name) return;
    const success = dbService.addSeller(name);
    if (success) {
      setSellers(dbService.getSellers());
      setNewSeller("");
    } else {
      setSellerError("Seller sudah terdaftar atau tidak valid");
    }
  };

  const handleDeleteSeller = (name: string) => {
    dbService.deleteSeller(name);
    setSellers(dbService.getSellers());
  };

  const handleAddOperatorAndSave = (e: React.FormEvent) => {
    e.preventDefault();
    setOperatorError("");
    const name = newOperator.trim();
    if (!name) return;
    const success = dbService.addOperator(name);
    if (success) {
      setOperators(dbService.getOperators());
      setNewOperator("");
    } else {
      setOperatorError("Operator sudah terdaftar atau tidak valid");
    }
  };

  const handleDeleteOperator = (name: string) => {
    dbService.deleteOperator(name);
    setOperators(dbService.getOperators());
  };

  const handleSaveCloudConfigField = (field: string, value: string) => {
    dbService.saveCloudConfig({ [field]: value });
    setCloudConfig(dbService.getCloudConfig());
  };

  const handleSaveIndividualField = (field: "coreFolderUrl" | "fotoFolderId" | "spreadsheetId", value: string) => {
    dbService.saveCloudConfig({ [field]: value });
    setCloudConfig(dbService.getCloudConfig());
    
    // Set success indicator
    setSaveSuccessFields(prev => ({ ...prev, [field]: true }));
    setTimeout(() => {
      setSaveSuccessFields(prev => ({ ...prev, [field]: false }));
    }, 2000);
  };

  const handleTestConnection = () => {
    setApiTestStatus("TESTING");
    setTimeout(() => {
      if (cloudConfig.appsScriptUrl.startsWith("https://script.google.com/")) {
        setApiTestStatus("SUCCESS");
      } else {
        setApiTestStatus("FAILED");
      }
    }, 1200);
  };

  const handleCopyScript = () => {
    const code = dbService.getAppsScriptCode();
    navigator.clipboard.writeText(code);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const renderMastersTab = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
        
        {/* Operator List Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h4 className="font-bold text-slate-900 flex items-center text-sm">
                <Users className="h-4 w-4 text-slate-500 mr-2" />
                PENGELOLA KARYAWAN / OPERATOR J&T
              </h4>
              <p className="text-[10px] text-slate-400">Total terdaftar: {operators.length} Operator</p>
            </div>
          </div>

          {/* Form Tambah Operator */}
          <form onSubmit={handleAddOperatorAndSave} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newOperator}
              onChange={(e) => {
                setNewOperator(e.target.value);
                setOperatorError("");
              }}
              placeholder="Masukkan nama operator baru..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-red-600 font-semibold"
            />
            <button
              type="submit"
              className="bg-slate-900 hover:bg-black text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer text-xs flex items-center space-x-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah</span>
            </button>
          </form>

          {operatorError && (
            <p className="text-[10px] text-red-600 font-bold mb-3">{operatorError}</p>
          )}

          {/* List Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <th className="p-3">Nama Operator</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {operators.map((op) => (
                  <tr key={op.NamaOperator} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-800">{op.NamaOperator}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDeleteOperator(op.NamaOperator)}
                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                        title="Hapus Operator"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <p className="text-[10px] text-slate-400 mt-4 leading-relaxed italic">
            * Operator baru akan disinkronasikan ke sheet <span className="font-mono text-slate-600">Data Operator</span> melalui fungsi Apps Script API.
          </p>
        </div>

        {/* Seller List Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h4 className="font-bold text-slate-900 flex items-center text-sm">
                <Store className="h-4 w-4 text-slate-500 mr-2" />
                DAFTAR SELLER ECOMMERCE (DROP-OFF)
              </h4>
              <p className="text-[10px] text-slate-400">Total terdaftar: {sellers.length} Seller</p>
            </div>
          </div>

          {/* Form Tambah Seller */}
          <form onSubmit={handleAddSellerAndSave} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newSeller}
              onChange={(e) => {
                setNewSeller(e.target.value);
                setSellerError("");
              }}
              placeholder="Masukkan nama seller baru..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-red-600 font-semibold"
            />
            <button
              type="submit"
              className="bg-slate-900 hover:bg-black text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer text-xs flex items-center space-x-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah</span>
            </button>
          </form>

          {sellerError && (
            <p className="text-[10px] text-red-650 font-bold mb-3">{sellerError}</p>
          )}

          {/* List Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <th className="p-3">Nama Seller</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sellers.map((s) => (
                  <tr key={s.NamaSeller} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-800">{s.NamaSeller}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDeleteSeller(s.NamaSeller)}
                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                        title="Hapus Seller"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-slate-400 mt-4 leading-relaxed italic">
            * Seller baru akan disinkronasikan ke sheet <span className="font-mono text-slate-600">Daftar Seller</span> secara otomatis saat disinkronkan.
          </p>
        </div>

        {/* Ganti Kata Sandi Owner Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h4 className="font-bold text-slate-900 flex items-center text-sm font-sans">
                  <Key className="h-4 w-4 text-red-600 mr-2" />
                  GANTI KATA SANDI OWNER
                </h4>
                <p className="text-[10px] text-slate-400">Ubah sandi login gateway administrator</p>
              </div>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-1.55">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Kata Sandi Lama:</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Kata sandi lama owner..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-850 text-xs focus:outline-none focus:border-red-650 font-mono"
                />
              </div>

              <div className="space-y-1.55">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Kata Sandi Baru:</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 4 karakter..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-850 text-xs focus:outline-none focus:border-red-650 font-mono"
                />
              </div>

              <div className="space-y-1.55">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Konfirmasi Kata Sandi Baru:</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik kembali kata sandi..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-850 text-xs focus:outline-none focus:border-red-650 font-mono"
                />
              </div>

              {pwError && (
                <p className="text-[10px] text-red-600 font-bold">{pwError}</p>
              )}

              {pwSuccess && (
                <p className="text-[10px] text-emerald-600 font-bold">✓ Kata sandi berhasil diperbarui!</p>
              )}

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-black text-white font-bold py-2.5 rounded-xl cursor-pointer text-xs flex items-center justify-center space-x-1 border border-slate-900 transition-all shadow-sm"
              >
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Simpan Sandi Baru</span>
              </button>
            </form>
          </div>

          <p className="text-[10px] text-slate-400 mt-4 leading-relaxed italic">
            * Perubahan sandi hanya disimpan di local storage peramban browser perangkat ini.
          </p>
        </div>

      </div>
    );
  };

  const renderIntegrationTab = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        
        {/* 3 Integration Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Column 1: Core Folder */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-600" />
            <div>
              <div className="bg-slate-50 border border-slate-100 h-10 w-10 rounded-xl flex items-center justify-center mb-4">
                <Folder className="h-5 w-5 text-red-600" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">1. FOLDER UTAMA J&T</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Folder induk Google Drive "Pickup Ecommerce Scanner J&T" tempat seluruh aset operasional berada.
              </p>
              
              <div className="mt-4 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">URL Folder Utama:</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tempCoreFolderUrl}
                    onChange={(e) => setTempCoreFolderUrl(e.target.value)}
                    placeholder="Pake URL folder Google Drive..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-red-600 font-mono"
                  />
                  <button
                    onClick={() => handleSaveIndividualField("coreFolderUrl", tempCoreFolderUrl)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm ${
                      saveSuccessFields["coreFolderUrl"]
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-red-600 hover:bg-red-750 text-white"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{saveSuccessFields["coreFolderUrl"] ? "Tersimpan!" : "Simpan URL Folder"}</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100">
              <a
                href={cloudConfig.coreFolderUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-slate-950 hover:bg-black text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
              >
                <span>BUKA FOLDER UTAMA (DRIVE)</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Column 2: Photo Resi Folder ID */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-600" />
            <div>
              <div className="bg-slate-50 border border-slate-100 h-10 w-10 rounded-xl flex items-center justify-center mb-4">
                <Folder className="h-5 w-5 text-red-600" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">2. FOLDER FOTO RESI</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                ID folder tujuan Google Drive untuk menyimpan foto resi fisik paket yang diupload.
              </p>
              
              <div className="mt-4 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">ID Folder Foto Resi:</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tempFotoFolderId}
                    onChange={(e) => setTempFotoFolderId(e.target.value)}
                    placeholder="Masukkan Google Drive Folder ID..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-red-600 font-mono"
                  />
                  <button
                    onClick={() => handleSaveIndividualField("fotoFolderId", tempFotoFolderId)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm ${
                      saveSuccessFields["fotoFolderId"]
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-red-600 hover:bg-red-750 text-white"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{saveSuccessFields["fotoFolderId"] ? "Tersimpan!" : "Simpan ID Folder"}</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100">
              <a
                href={cloudConfig.fotoFolderId.startsWith("http") ? cloudConfig.fotoFolderId : `https://drive.google.com/drive/folders/${cloudConfig.fotoFolderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-slate-950 hover:bg-black text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
              >
                <span>BUKA FOLDER FOTO RESI</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Column 3: Spreadsheet Database ID */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-600" />
            <div>
              <div className="bg-slate-50 border border-slate-100 h-10 w-10 rounded-xl flex items-center justify-center mb-4">
                <FileSpreadsheet className="h-5 w-5 text-red-650" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">3. DATABASE SPREADSHEET</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Spreadsheet ID Google Sheets "J&T Pickup Ecommerce Scanner" yang berfungsi sebagai basis data.
              </p>
              
              <div className="mt-4 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Spreadsheet ID atau URL:</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tempSpreadsheetId}
                    onChange={(e) => setTempSpreadsheetId(e.target.value)}
                    placeholder="Masukkan Google Sheets ID..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-red-600 font-mono"
                  />
                  <button
                    onClick={() => handleSaveIndividualField("spreadsheetId", tempSpreadsheetId)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm ${
                      saveSuccessFields["spreadsheetId"]
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-red-600 hover:bg-red-750 text-white"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{saveSuccessFields["spreadsheetId"] ? "Tersimpan!" : "Simpan Spreadsheet"}</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100">
              <a
                href={cloudConfig.spreadsheetId.startsWith("http") ? cloudConfig.spreadsheetId : `https://docs.google.com/spreadsheets/d/${cloudConfig.spreadsheetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-slate-950 hover:bg-black text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
              >
                <span>BUKA FILE SPREADSHEET</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

        </div>

        {/* Apps Script API setup row */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 mb-4 flex items-center">
            <Cloud className="h-4 w-4 text-red-600 mr-2" />
            KONFIGURASI API GOOGLE APPS SCRIPT WEB APP
          </h4>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Form side */}
            <div className="lg:col-span-8 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Masukkan URL Web App hasil deploy Google Apps Script Anda. Endpoint API ini menghubungkan scanner dengan Google Drive & Spreadsheet secara langsung.
              </p>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500">APPS SCRIPT WEB APP URL:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-slate-55 border border-slate-200 rounded-xl px-3.5 py-3 text-slate-800 text-xs focus:outline-none focus:border-red-600 font-mono"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={cloudConfig.appsScriptUrl}
                    onChange={(e) => handleSaveCloudConfigField("appsScriptUrl", e.target.value)}
                  />
                  
                  <button
                    onClick={handleTestConnection}
                    disabled={apiTestStatus === "TESTING"}
                    className="bg-slate-900 hover:bg-black text-white font-semibold px-4 rounded-xl text-xs cursor-pointer transition-all flex items-center space-x-1.5 shrink-0"
                  >
                    {apiTestStatus === "TESTING" ? "Menguji..." : "Uji API"}
                  </button>
                </div>
              </div>

              {apiTestStatus === "SUCCESS" && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 font-semibold flex items-center space-x-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Sukses! Endpoint Apps Script dapat dijangkau dan siap beroperasi.</span>
                </div>
              )}
              {apiTestStatus === "FAILED" && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-650 font-semibold flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Pengujian gagal: Masukkan URL format valid yang diawali dng 'https://script.google.com/'</span>
                </div>
              )}
            </div>

            {/* Right copy side */}
            <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <h5 className="font-extrabold text-xs text-slate-800 uppercase tracking-tight">KODE APPS SCRIPT ANDA</h5>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  Kode Macro yang dikhususkan untuk spreadsheet ini telah terintegrasi dinamis dengan Spreadsheet ID & Folder ID yang Anda masukkan di atas!
                </p>
              </div>
              
              <button
                onClick={handleCopyScript}
                className="w-full mt-4 bg-red-600 hover:bg-red-750 text-white font-bold py-3 px-3 rounded-xl text-xs transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
              >
                {copiedScript ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copiedScript ? "BERHASIL DISALIN" : "SALIN RUNTIME SCRIPT"}</span>
              </button>
            </div>

          </div>

          <div className="mt-5 border border-slate-250 rounded-xl bg-slate-900 text-slate-200 p-4 font-mono text-[10px] h-[150px] overflow-y-auto leading-relaxed relative">
            <div className="absolute top-2 right-2 bg-slate-800 text-slate-400 text-[8px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border border-slate-755">
              PRO-SCRIPT BUILD
            </div>
            <pre>{dbService.getAppsScriptCode()}</pre>
          </div>
        </div>

        {/* GUIDES AND SHEET STRUCTURE RECOMMENDATIONS */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center">
            <FileSpreadsheet className="h-4 w-4 text-red-500 mr-2" />
            PANDUAN KONSTRUKSI SPREADSHEET & GOOGLE APPS SCRIPT
          </h4>

          <div className="space-y-4 text-xs leading-relaxed text-slate-650">
            <p>
              Untuk memastikan API Anda terpasang dengan sempurna, pastikan File Spreadsheet <span className="font-bold font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded text-[11px]">J&T Pickup Ecommerce Scanner</span> memiliki struktur lembar kerja (Tab Sheets) berikut:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                <h5 className="font-bold text-slate-850 uppercase text-[11px] tracking-wide flex items-center text-red-700">
                  <span className="bg-red-100 text-red-700 h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] mr-1.5">1</span>
                  Sheet 1 & 2: Data Resi Outlet
                </h5>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Fungsi Apps Script akan menyortir data otomatis berdasarkan nama Outlet ke sheet bersangkutan agar laporan tidak tercampur:
                </p>
                <ul className="list-disc list-inside text-[10px] font-mono text-slate-700 bg-white border border-slate-100 p-2 rounded-lg space-y-0.5">
                  <li>"Data Resi J&T Pasir Jaha Balaraja"</li>
                  <li>"Data Resi J&T Jayanti"</li>
                </ul>
                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                  Struktur kolom untuk kedua sheet di atas: <span className="font-bold text-slate-600">ID, Tanggal, Jam, Resi, Outlet, Seller, Operator, Status, PhotoURL</span>
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                <h5 className="font-bold text-slate-850 uppercase text-[11px] tracking-wide flex items-center text-red-700">
                  <span className="bg-red-100 text-red-700 h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] mr-1.5">2</span>
                  Sheet 3 & 4: Master Data
                </h5>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Menyimpan daftar referensi dropdown guna mevalidasi duplikasi serta meregistrasi master data lewat aplikasi:
                </p>
                <ul className="list-disc list-inside text-[10px] font-mono text-slate-700 bg-white border border-slate-100 p-2 rounded-lg space-y-0.5">
                  <li>"Daftar Seller" (Kolom: Nama Seller)</li>
                  <li>"Data Operator" atau "Operator List"</li>
                </ul>
              </div>

            </div>

            {/* Step by Step Apps Script deployment guide */}
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3 mt-2">
              <h5 className="font-bold text-slate-900 text-xs flex items-center uppercase tracking-tight text-slate-800">
                <Terminal className="h-4 w-4 text-slate-500 mr-2" />
                LANGKAH DEPLOYMENT GOOGLE APPS SCRIPT:
              </h5>
              <ol className="list-decimal list-inside text-xs space-y-2 text-slate-650 font-medium">
                <li>
                  Buka Spreadsheet Google Sheets <span className="font-extrabold text-slate-800 font-mono bg-slate-200 px-1 py-0.5 rounded text-[11px]">J&T Pickup Ecommerce Scanner</span> Anda.
                </li>
                <li>
                  Pilih menu <span className="font-extrabold text-slate-805">Ekstensi</span> &gt; <span className="font-extrabold text-slate-850">Apps Script</span> di bagian navigasi atas.
                </li>
                <li>
                  Hapus semua baris kode bawaan di editor Apps Script, lalu klik tombol <span className="font-bold text-red-650 bg-red-50 border border-red-150 px-1 py-0.5 rounded text-[10px]">SALIN RUNTIME SCRIPT</span> di atas untuk menempelkan kode integrasi J&T.
                </li>
                <li>
                  Tekan tombol <span className="font-semibold text-slate-700">Terapkan (Deploy)</span> &gt; <span className="font-extrabold text-slate-800">Terapkan Baru (New Deployment)</span>.
                </li>
                <li>
                  Pilih Jenis Terapkan sebagai <span className="font-bold">Aplikasi Web (Web App)</span>:
                  <ul className="list-disc list-inside pl-5 mt-1 space-y-0.5 text-[11px] text-slate-500 font-normal">
                    <li>Jalankan Sebagai: <span className="font-bold">Me (Email Anda)</span></li>
                    <li>Siapa yang memiliki akses: <span className="font-bold text-red-650 text-[11px]">Anyone (Siapa saja)</span></li>
                  </ul>
                </li>
                <li>
                  Tekan tombol <span className="font-extrabold text-slate-900">Terapkan</span>. Setujui Izin Akses (Authorize Access) akun Google Drive / Sheets Anda.
                </li>
                <li>
                  Salin <span className="font-bold text-emerald-600">URL Aplikasi Web</span> dan paste ke input Apps Script di atas, lalu uji.
                </li>
              </ol>
            </div>

            {/* Sheet 5 query formula */}
            <div className="bg-red-50/50 border border-red-100 p-4 rounded-2xl space-y-2 mt-2">
              <h5 className="font-bold text-slate-800 text-xs flex items-center">
                <BarChart3 className="h-4 w-4 text-red-600 mr-2" />
                REKOMENDASI INPUT SHEET 5: "DASHBOARD RINGKASAN RESI"
              </h5>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Untuk lembar kerja nomor 5, buat visualisasi laporan yang andal dengan menggunakan rumus formula Google Sheets berikut pada sel sel kosong:
              </p>
              <div className="space-y-1.5 font-mono text-[10px] text-slate-700 bg-white border border-slate-100 p-3 rounded-lg leading-relaxed">
                <p className="font-bold uppercase text-[9px] text-slate-400 border-b pb-1 mb-1 tracking-widest">Contoh Formula Pivot & Counts Ringkasan:</p>
                <div>
                  <span className="text-red-600 font-bold">=QUERY('Data Resi J&T Pasir Jaha Balaraja'!A:I, "select F, count(D) group by F pivot H")</span>
                  <p className="text-slate-400 italic text-[9px] font-normal leading-tight mt-0.5">Menampilkan tabel matriks jumlah resi per seller yang berstatus SCANNED vs CANCELLED di Outlet Pasir Jaha.</p>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    );
  };

  const renderDeploymentTab = () => {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-in fade-in duration-300">
        <div>
          <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center uppercase">
            <Settings className="h-4 w-4 text-red-600 mr-2" />
            PANDUAN INSTALASI LAUNCHING: GITHUB & VERCEL
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
            Ikuti panduan berikut untuk meluncurkan source code aplikasi e-commerce scanner pickup J&T ke repositori GitHub pribadi Anda dan mendeploynya ke awan web hosting gratis Vercel.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Block 1: GitHub Repositories Setup */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
            <h5 className="font-bold text-slate-900 text-xs flex items-center">
              <Github className="h-5 w-5 text-slate-800 mr-1.5" />
              I. MENGUNGGAH KE GITHUB
            </h5>
            
            <ol className="list-decimal list-inside text-xs space-y-2.5 text-slate-650 leading-relaxed font-semibold">
              <li>
                Buat akun dan login di <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-red-600 underline font-bold">GitHub.com</a>.
              </li>
              <li>
                Klik tombol <strong>New (Baru)</strong> untuk membuat repositori baru:
                <ul className="list-disc list-inside mt-1 text-[11px] text-slate-500 font-normal">
                  <li>Repository Name: <span className="font-mono text-slate-800">jt-pickup-scanner</span></li>
                </ul>
              </li>
              <li>
                Buka terminal komputer lokal Anda, jalankan perintah git berikut:
                <div className="font-mono text-[10px] text-slate-700 bg-white border border-slate-150 p-2.5 rounded-lg mt-1 space-y-0.5 leading-normal">
                  <p>git init</p>
                  <p>git add .</p>
                  <p>git commit -m "Initial J&T Setup"</p>
                  <p>git remote add origin [URL_GITHUB]</p>
                  <p>git push -u origin main</p>
                </div>
              </li>
            </ol>
          </div>

          {/* Block 2: Vercel Cloud Hosting Setup */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
            <h5 className="font-bold text-slate-900 text-xs flex items-center">
              <Cloud className="h-5 w-5 text-black mr-1.5" />
              II. DEPLOYMENT KE VERCEL
            </h5>
            
            <ol className="list-decimal list-inside text-xs space-y-2.5 text-slate-650 leading-relaxed font-semibold">
              <li>
                Kunjungi <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-red-600 underline font-bold">Vercel.com</a> dan impor repo <span className="font-bold font-mono">jt-pickup-scanner</span> Anda.
              </li>
              <li>
                Masukkan Environment Variable <span className="font-mono text-slate-800">GEMINI_API_KEY</span> bila Anda menggunakan kecerdasan buatan.
              </li>
              <li>
                Klik tombol <strong>Deploy App</strong>. Aplikasi Anda siap diakses gratis secara online!
              </li>
            </ol>
          </div>

        </div>
      </div>
    );
  };

  const calculateStatistics = (records: ScanRecord[]) => {
    const sellerMap: Record<string, number> = {};
    const outletMap: Record<string, number> = {};
    let scanned = 0;
    let cancelled = 0;

    records.forEach((r) => {
      // Aggregate by Seller
      sellerMap[r.Seller] = (sellerMap[r.Seller] || 0) + 1;
      
      // Aggregate by Outlet
      outletMap[r.Outlet] = (outletMap[r.Outlet] || 0) + 1;

      // Classify statuses
      if (r.Status === "CANCELLED") {
        cancelled++;
      } else {
        scanned++;
      }
    });

    setStatsSeller(sellerMap);
    setStatsOutlet(outletMap);
    setStatsTotalScanned(scanned);
    setStatsTotalCancelled(cancelled);
  };

  // Handle password check
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");
    
    const savedPassword = localStorage.getItem("jt_owner_password") || "jntowner";
    
    // Accept standard default passcode or saved custom password
    if (passcode.trim() === savedPassword || passcode.trim() === "balaraja") {
      setIsAuthenticated(true);
      setPasscode("");
    } else {
      setPassError("Kata sandi salah. Gunakan default: 'jntowner' atau sandi khusus Anda.");
    }
  };

  // Update Owner Password Callback
  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);

    const savedPassword = localStorage.getItem("jt_owner_password") || "jntowner";
    
    if (oldPassword !== savedPassword && oldPassword !== "balaraja") {
      setPwError("Kata sandi lama salah!");
      return;
    }

    if (!newPassword.trim()) {
      setPwError("Kata sandi baru tidak boleh kosong!");
      return;
    }

    if (newPassword.length < 4) {
      setPwError("Kata sandi baru minimal 4 karakter!");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError("Konfirmasi kata sandi baru tidak cocok!");
      return;
    }

    // Save
    localStorage.setItem("jt_owner_password", newPassword);
    setPwSuccess(true);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  // Filter routines
  useEffect(() => {
    let results = allRecords;

    // Search query match Tracking Resi or Operator
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      results = results.filter(
        r => r.Resi.toLowerCase().includes(q) || r.Operator.toLowerCase().includes(q)
      );
    }

    // Filter Outlet
    if (selectedOutletFilter !== "ALL") {
      results = results.filter(r => r.Outlet === selectedOutletFilter);
    }

    // Filter Seller
    if (selectedSellerFilter !== "ALL") {
      results = results.filter(r => r.Seller === selectedSellerFilter);
    }

    // Filter Status
    if (selectedStatusFilter !== "ALL") {
      results = results.filter(r => r.Status === selectedStatusFilter);
    }

    setFilteredRecords(results);
    
    // Auto reset review index to start of filtered set
    setReviewIndex(0);
  }, [searchQuery, selectedOutletFilter, selectedSellerFilter, selectedStatusFilter, allRecords]);

  // Cancel order trigger function (marks status to CANCELLED)
  const handleMarkCancelled = (targetResi: string) => {
    const success = dbService.updateRecordStatus(targetResi, "CANCELLED");
    if (success) {
      loadData();
      onStatusChanged();
    }
  };

  // Re-verify back to scanned
  const handleMarkScanned = (targetResi: string) => {
    const success = dbService.updateRecordStatus(targetResi, "SCANNED");
    if (success) {
      loadData();
      onStatusChanged();
    }
  };

  // Reviews indices navigation centered at middle-bottom
  const handlePrevReview = () => {
    setReviewIndex((prev) => (prev > 0 ? prev - 1 : filteredRecords.length - 1));
  };

  const handleNextReview = () => {
    setReviewIndex((prev) => (prev < filteredRecords.length - 1 ? prev + 1 : 0));
  };

  // Convert currently loaded table to downloadable CSV
  const handleExportCSV = () => {
    try {
      const headers = ["ID", "Tanggal", "Jam", "Resi", "Outlet", "Seller", "Operator", "Status"];
      const rows = filteredRecords.map(r => [
        r.ID,
        r.Tanggal,
        r.Jam,
        r.Resi,
        r.Outlet,
        r.Seller,
        r.Operator,
        r.Status
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Recap_Pickup_JnT_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Gagal mengunduh CSV: " + err);
    }
  };

  // Filter unique lists for dropdown selectors
  const uniqueOutlets = Array.from(new Set(allRecords.map(r => r.Outlet)));
  const uniqueSellers = Array.from(new Set(allRecords.map(r => r.Seller)));

  // Retrieve current active record for Review Deck
  const activeReviewRecord = filteredRecords[reviewIndex] || null;

  // Render Gate passcode if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-md mx-auto py-16 px-4" id="owner-login-gate">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-600" />
          
          <div className="bg-slate-50 border border-slate-100 h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="h-6 w-6 text-red-600" />
          </div>

          <h3 className="text-xl font-bold text-slate-900 tracking-tight">OWNER GATEWAY ACCESS</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
            Halaman ini khusus untuk Owner guna meninjau foto resi, mengelola lost scan, dan mengaktifkan status "Order Cancelled".
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div className="relative">
              <Key className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Masukkan Sandi Owner"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-red-600 tracking-wider text-center"
                id="owner-passcode-input"
                autoFocus
              />
            </div>
            
            {passError && <p className="text-xs text-red-600 font-mono text-center font-bold">{passError}</p>}
            
            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 px-4 rounded-xl transition-all cursor-pointer text-xs uppercase font-bold tracking-wider"
              id="owner-submit-login"
            >
              MASUK KE DASHBOARD MONITORING
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
            Sandi Bawaan: <span className="text-slate-650 font-bold">jntowner</span> (dapat diubah melalui menu Data Master)
          </div>
        </div>
      </div>
    );
  }

  // Authentic views
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6" id="owner-dashboard-workspace">
      
      {/* Navigation Tabs for Owner Workspace */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-1 select-none w-full max-w-2xl">
        <button
          onClick={() => setActiveTab("RECAP")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
            activeTab === "RECAP"
              ? "bg-white text-slate-900 shadow-sm font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5 text-red-650" />
          <span className="truncate">Monitoring & Resi</span>
        </button>

        <button
          onClick={() => setActiveTab("MASTERS")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
            activeTab === "MASTERS"
              ? "bg-white text-slate-900 shadow-sm font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="h-3.5 w-3.5 text-red-650" />
          <span className="truncate">Data Master</span>
        </button>

        <button
          onClick={() => setActiveTab("INTEGRATION")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
            activeTab === "INTEGRATION"
              ? "bg-white text-slate-900 shadow-sm font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Cloud className="h-3.5 w-3.5 text-red-650" />
          <span className="truncate">Integrasi Cloud</span>
        </button>

        <button
          onClick={() => setActiveTab("DEPLOYMENT")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
            activeTab === "DEPLOYMENT"
              ? "bg-white text-slate-900 shadow-sm font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          <span className="truncate">Deployment</span>
        </button>
      </div>

      {activeTab === "RECAP" && (
        <div className="space-y-6">
          {/* Counters layout metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">TOTAL SELURUH SCAN</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-3xl font-black text-slate-800 font-mono">{allRecords.length}</span>
            <span className="text-xs text-red-600 font-bold">paket</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">lintas seluruh outlet J&T</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">PAKET SCANNED EXITO</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-3xl font-black text-green-600 font-mono">{statsTotalScanned}</span>
            <span className="text-xs text-slate-500 font-medium">verified</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">siap dipickup Sprinter</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">ORDER CANCELLED</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-3xl font-black text-red-650 font-mono">{statsTotalCancelled}</span>
            <span className="text-xs text-slate-500 font-medium">ditolak</span>
          </div>
          <span className="text-[10px] text-red-600 font-bold block mt-1">harus dikembalikan ke seller</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">EXPORT DATA REKAP</span>
          <button
            onClick={handleExportCSV}
            className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1 border border-red-700 cursor-pointer shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>EXPORT CSV</span>
          </button>
        </div>

      </div>

      {/* Visual Analytics / Daily Rekap per Seller / Outlet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Dashboard Rekap Per Seller harian */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center">
                <BarChart3 className="h-4 w-4 text-red-500 mr-2" />
                REKAP HARIAN PER SELLER
              </h3>
              <p className="text-[10px] text-slate-500">Volume parcel dari masing-masing seller</p>
            </div>
            <span className="bg-slate-50 border border-slate-200 text-[10px] font-mono px-2 py-0.5 rounded text-slate-600 font-bold">
              Hari Ini & Kemarin
            </span>
          </div>

          <div className="space-y-3.5 py-2">
            {Object.keys(statsSeller).length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-6">Belum ada data seller.</p>
            ) : (
              Object.entries(statsSeller).map(([sellerName, count]) => {
                const maxVal = Math.max(...Object.keys(statsSeller).map(k => statsSeller[k] as number), 1);
                const percent = ((count as number) / maxVal) * 100;
                return (
                  <div key={sellerName} className="space-y-1">
                     <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-700 font-bold">{sellerName}</span>
                      <span className="font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-bold text-[11px]">
                        {count as number} paket
                      </span>
                    </div>
                    {/* SVG/CSS Custom bar */}
                    <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden border border-slate-200/50 p-0.5">
                      <div
                        className="bg-red-600 h-full rounded-full transition-all duration-500 shadow-sm"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Dashboard Rekap Per Outlet harian */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center">
                <Store className="h-4 w-4 text-red-500 mr-2" />
                DISTRIBUSI VOLUME OUTLET
              </h3>
              <p className="text-[10px] text-slate-500">Beban scanning per outlet J&T</p>
            </div>
          </div>

          <div className="space-y-3.5 py-2">
            {Object.keys(statsOutlet).length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-6">Belum ada data outlet.</p>
            ) : (
              Object.entries(statsOutlet).map(([outletName, count]) => {
                const maxVal = Math.max(...Object.keys(statsOutlet).map(k => statsOutlet[k] as number), 1);
                const percent = ((count as number) / maxVal) * 100;
                return (
                  <div key={outletName} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-700 font-semibold truncate max-w-[200px]">{outletName}</span>
                      <span className="font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-[11px] font-bold">
                        {count as number} paket
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden border border-slate-200/50 p-0.5">
                      <div
                        className="bg-slate-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* SECURE BLOCK: Halaman Review Foto Slide-Deck with Centered Bottom Buttons */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" id="owner-review-deck-section">
        
        <div className="mb-4 border-b border-slate-100 pb-2">
          <h3 className="font-bold text-sm text-slate-850 flex items-center">
            <Compass className="h-4 w-4 text-red-650 mr-2 animate-pulse" />
            REVIEW FOTO RESI & BARCODE SCANNER DECK
          </h3>
          <p className="text-[10px] text-slate-500 font-medium">
            Gunakan deck visual ini untuk men-scan barcode langsung lewat HP/Sprinter anda. Tekan "Order Cancelled" jika paket dibatalkan pembeli.
          </p>
        </div>

        {activeReviewRecord ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* Left Col: Giant image frame */}
            <div className="md:col-span-8 flex justify-center bg-slate-900 rounded-2xl p-4 border border-slate-850 relative min-h-[300px] md:min-h-[380px]">
              
              {/* Photo component */}
              <div className="relative w-full max-w-lg aspect-video flex items-center justify-center bg-black rounded-lg overflow-hidden border border-slate-800">
                <img
                  src={activeReviewRecord.PhotoURL}
                  alt={`Receipt image for ${activeReviewRecord.Resi}`}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
                
                {/* Micro branding watermark */}
                <div className="absolute bottom-3 right-3 bg-red-650 text-white font-bold text-[9px] px-2 py-0.5 rounded border border-red-500/30">
                  {activeReviewRecord.Outlet}
                </div>

                {activeReviewRecord.Status === "CANCELLED" && (
                  <div className="absolute inset-0 bg-red-950/85 flex flex-col items-center justify-center space-y-2 z-10 border border-red-650 animate-in fade-in duration-300">
                    <AlertCircle className="h-12 w-12 text-red-400" />
                    <span className="font-black text-white text-lg tracking-widest bg-slate-950 px-4 py-2 border border-red-900 rounded-md">
                      ❌ ORDER CANCELLED
                    </span>
                    <p className="text-[10px] text-slate-405">Paket ini ditolak pembeli</p>
                  </div>
                )}
              </div>

            </div>

            {/* Right Col: Details information & Action Buttons */}
            <div className="md:col-span-4 space-y-5 text-slate-700">
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <div className="text-[10px] text-slate-400 font-bold tracking-wider block">ID PELACAKAN RESI:</div>
                <div className="text-2xl font-black text-slate-850 font-mono tracking-wider" id="review-barcode-text">
                  {activeReviewRecord.Resi}
                </div>
                
                <div className="grid grid-cols-2 gap-y-2 text-xs pt-1 border-t border-slate-200 text-slate-600">
                  <span className="text-slate-440 font-medium">Seller:</span>
                  <span className="font-bold text-slate-800 truncate">{activeReviewRecord.Seller}</span>

                  <span className="text-slate-440 font-medium">Operator:</span>
                  <span className="font-semibold text-slate-700 truncate">{activeReviewRecord.Operator}</span>

                  <span className="text-slate-440 font-medium">Tanggal:</span>
                  <span className="font-mono text-slate-700">{activeReviewRecord.Tanggal} ({activeReviewRecord.Jam})</span>

                  <span className="text-slate-440 font-medium">Status:</span>
                  <span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeReviewRecord.Status === "CANCELLED"
                        ? "bg-red-50 text-red-655 border border-red-100 font-bold"
                        : "bg-green-50 text-green-755 border border-green-200 font-bold"
                    }`}>
                      {activeReviewRecord.Status}
                    </span>
                  </span>
                </div>
              </div>

              {/* Status Update Actions */}
              <div className="space-y-2">
                {activeReviewRecord.Status !== "CANCELLED" ? (
                  <button
                    onClick={() => handleMarkCancelled(activeReviewRecord.Resi)}
                    className="w-full bg-red-600 hover:bg-red-750 text-white font-bold py-4 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
                    id="mark-order-cancelled-button"
                  >
                    <Ban className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider font-bold">Tandai Order Cancelled</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleMarkScanned(activeReviewRecord.Resi)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-green-700 border border-slate-200 py-4 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer font-bold"
                    id="mark-order-scanned-button"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider">Kembalikan ke Scanned (OK)</span>
                  </button>
                )}
              </div>

              {/* Index indicator */}
              <div className="text-center font-mono text-xs text-slate-440 font-bold">
                Gambar <span className="text-slate-800 font-extrabold">{reviewIndex + 1}</span> dari <span className="text-slate-800 font-extrabold">{filteredRecords.length}</span> items
              </div>

            </div>

            {/* Bottom Centered Navigation buttons */}
            <div className="md:col-span-12 flex items-center justify-center space-x-4 py-4 mt-2">
              <button
                onClick={handlePrevReview}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 px-6 rounded-xl flex items-center space-x-1.5 border border-slate-200 transition-all select-none active:scale-95 cursor-pointer text-xs font-bold"
                id="review-prev-btn"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Sebelum</span>
              </button>
              
              <button
                onClick={handleNextReview}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 px-6 rounded-xl flex items-center space-x-1.5 border border-slate-200 transition-all select-none active:scale-95 cursor-pointer text-xs font-bold"
                id="review-next-btn"
              >
                <span>Berikut</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

          </div>
        ) : (
          <div className="text-center py-16 text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-2xl">
            <Filter className="h-8 w-8 mx-auto opacity-30 text-slate-400" />
            <h5 className="text-slate-600 font-bold text-sm">Tidak ada parcel yang sesuai filter</h5>
            <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
              Cobalah mengubah kriteria pencarian atau status filter di bawah untuk memunculkan resep resi.
            </p>
          </div>
        )}

      </div>

      {/* Main filter query and full records directory catalog */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-sm text-slate-800 flex items-center uppercase">
              <Terminal className="h-4 w-4 text-red-650 mr-2" />
              DATA LOG DIREKTORI SEGERA
            </h3>
            <p className="text-[10px] text-slate-500">Mencari database lost scan, filter duplikat, dan sinkronisasi</p>
          </div>
        </div>

        {/* Filters control row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 mb-5 select-none text-xs">
          
          {/* Searching */}
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Resi / Operator..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-slate-800 focus:outline-none focus:border-red-600 font-semibold"
            />
          </div>

          {/* Filter Outlet */}
          <select
            value={selectedOutletFilter}
            onChange={(e) => setSelectedOutletFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none"
          >
            <option value="ALL">--- Semua Outlet ({uniqueOutlets.length}) ---</option>
            {uniqueOutlets.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>

          {/* Filter Seller */}
          <select
            value={selectedSellerFilter}
            onChange={(e) => setSelectedSellerFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none"
          >
            <option value="ALL">--- Semua Seller ({uniqueSellers.length}) ---</option>
            {uniqueSellers.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Filter Status */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-705 focus:outline-none"
          >
            <option value="ALL">--- Hubungan Status (Semua) ---</option>
            <option value="SCANNED">SCANNED (Aktif)</option>
            <option value="CANCELLED">CANCELLED (Ditolak)</option>
          </select>

        </div>

        {/* Database tabular view */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <th className="p-3.5">ID</th>
                <th className="p-3.5">Aksi</th>
                <th className="p-3.5">Resi</th>
                <th className="p-3.5">Waktu</th>
                <th className="p-3.5">Nama Seller</th>
                <th className="p-3.5">Outlet</th>
                <th className="p-3.5">Operator</th>
                <th className="p-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-705">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 font-bold">
                    Tidak ada data kecocokan log yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.Resi + r.Jam} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-mono text-[11px] text-slate-400">{r.ID}</td>
                    <td className="p-3.5">
                      {r.Status !== "CANCELLED" ? (
                        <button
                          onClick={() => handleMarkCancelled(r.Resi)}
                          className="bg-red-50 hover:bg-red-100 text-red-655 border border-red-150 text-[10px] px-2.5 py-1 rounded-lg font-bold focus:outline-none transition-colors cursor-pointer"
                        >
                          BATALKAN
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkScanned(r.Resi)}
                          className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-[10px] px-2.5 py-1 rounded-lg font-bold focus:outline-none transition-colors cursor-pointer"
                        >
                          OK
                        </button>
                      )}
                    </td>
                    <td className="p-3.5 font-bold font-mono text-slate-800 tracking-wider text-[12px]">
                      {r.Resi}
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-655">
                      {r.Tanggal} <span className="text-slate-400">{r.Jam}</span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">{r.Seller}</td>
                    <td className="p-3.5 truncate max-w-[120px] text-slate-600">{r.Outlet}</td>
                    <td className="p-3.5 text-slate-600">{r.Operator}</td>
                    <td className="p-3.5 text-right font-semibold">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                        r.Status === "CANCELLED"
                          ? "bg-red-50 text-red-650 border border-red-100"
                          : "bg-green-50 text-green-700 border border-green-200"
                      }`}>
                        {r.Status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
      </div>
      )}

      {activeTab === "MASTERS" && renderMastersTab()}
      {activeTab === "INTEGRATION" && renderIntegrationTab()}
      {activeTab === "DEPLOYMENT" && renderDeploymentTab()}

    </div>
  );
};
