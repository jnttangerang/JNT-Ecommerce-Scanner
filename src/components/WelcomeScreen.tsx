/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Plus, Play, User, Home, Tag, HelpCircle, Check, BookOpen, Users } from "lucide-react";
import { Outlet, Seller, Operator, ScanRecord } from "../types";
import { dbService } from "../utils/db";
import { toast } from "sonner";

interface WelcomeScreenProps {
  onStartScanning: (config: {
    outlet: string;
    seller: string;
    operator: string;
  }) => void;
  savedOutlet: string;
  savedSeller: string;
  savedOperator: string;
  isPulling?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartScanning,
  savedOutlet,
  savedSeller,
  savedOperator,
  isPulling = false
}) => {
  // Master lists
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);

  // Selected values
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [selectedSeller, setSelectedSeller] = useState("");
  const [selectedOperator, setSelectedOperator] = useState("");

  // Add custom seller modal/state
  const [showAddSeller, setShowAddSeller] = useState(false);
  const [newSellerName, setNewSellerName] = useState("");
  const [sellerError, setSellerError] = useState("");
  const [sellerSuccess, setSellerSuccess] = useState(false);

  // Show Google Apps Script installation instructions helper
  const [showScriptDetails, setShowScriptDetails] = useState(false);

  // Local scan records for summary
  const [allRecords, setAllRecords] = useState<ScanRecord[]>([]);
  const [summaryDateType, setSummaryDateType] = useState<"ALL" | "TODAY" | "YESTERDAY" | "CUSTOM">("ALL");
  const [summaryStartDate, setSummaryStartDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [summaryEndDate, setSummaryEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  useEffect(() => {
    // Load local scan records
    setAllRecords(dbService.getRecords());
  }, [isPulling]);

  useEffect(() => {
    // Load metadata lists
    const outs = dbService.getOutlets();
    const ops = dbService.getOperators();
    const sels = dbService.getSellers();

    setOutlets(outs);
    setOperators(ops);
    setSellers(sels);

    // Hydrate from previous localStorage, otherwise default to empty string "" for the "--- Pilih ---" placeholder
    setSelectedOutlet(savedOutlet || "");
    setSelectedSeller(savedSeller || "");
    setSelectedOperator(savedOperator || "");
  }, [savedOutlet, savedSeller, savedOperator, isPulling]);

  const handleCreateSeller = (e: React.FormEvent) => {
    e.preventDefault();
    setSellerError("");
    setSellerSuccess(false);

    const name = newSellerName.trim();
    if (!name) {
      setSellerError("Nama seller tidak boleh kosong.");
      return;
    }

    const added = dbService.addSeller(name);
    if (added) {
      // Reload list
      const updatedSellers = dbService.getSellers();
      setSellers(updatedSellers);
      
      // Select the newly added seller automatically
      setSelectedSeller(name);
      
      setNewSellerName("");
      setSellerSuccess(true);
      setTimeout(() => {
        setShowAddSeller(false);
        setSellerSuccess(false);
      }, 1000);
    } else {
      setSellerError("Seller sudah terdaftar atau tidak valid.");
    }
  };

  const handleStart = () => {
    if (!selectedOutlet) {
      toast.error("Validasi Gagal", { description: "Harap pilih Outlet!" });
      return;
    }
    if (!selectedSeller) {
      toast.error("Validasi Gagal", { description: "Harap pilih Seller!" });
      return;
    }
    if (!selectedOperator) {
      toast.error("Validasi Gagal", { description: "Harap pilih Operator!" });
      return;
    }

    onStartScanning({
      outlet: selectedOutlet,
      seller: selectedSeller,
      operator: selectedOperator
    });
  };

  // Filter records based on selected date
  const getFilteredSummaryRecords = () => {
    let filtered = [...allRecords];
    const todayStr = new Date().toISOString().split("T")[0];
    
    if (summaryDateType === "TODAY") {
      filtered = filtered.filter(r => r.Tanggal === todayStr);
    } else if (summaryDateType === "YESTERDAY") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      filtered = filtered.filter(r => r.Tanggal === yesterdayStr);
    } else if (summaryDateType === "CUSTOM") {
      if (summaryStartDate) {
        filtered = filtered.filter(r => r.Tanggal >= summaryStartDate);
      }
      if (summaryEndDate) {
        filtered = filtered.filter(r => r.Tanggal <= summaryEndDate);
      }
    }
    return filtered;
  };

  // Group by seller and count
  const filteredRecords = getFilteredSummaryRecords();
  const statsSeller: Record<string, number> = {};
  filteredRecords.forEach((r) => {
    statsSeller[r.Seller] = (statsSeller[r.Seller] || 0) + 1;
  });

  return (
    <div className="w-full max-w-md mx-auto p-4 md:p-6 animate-in fade-in duration-200" id="welcome-setup-screen">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 relative overflow-hidden">
        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl animate-pulse" />
        
        <div className="text-center mb-6">
          <p className="text-red-650 text-[10px] font-bold tracking-widest uppercase mb-1">J&T Express Ecommerce Gateway</p>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">LOGIN</h2>
          <p className="text-xs text-slate-500 mt-1.5">
            Konfigurasi Sistem integrasi Ecommerce J&T.
          </p>
        </div>

        {/* Setup Form */}
        <div className="space-y-5">
          {/* Outlet Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
              <Home className="h-3.5 w-3.5 mr-1 text-red-600" />
              Outlet J&T
            </label>
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-red-600 focus:bg-white transition-all font-medium appearance-none"
              id="outlet-dropdown"
            >
              <option value="" disabled>--- Pilih Outlet J&T ---</option>
              {outlets.map((o) => (
                <option key={o.NamaOutlet} value={o.NamaOutlet}>
                  {o.NamaOutlet}
                </option>
              ))}
            </select>
          </div>

          {/* Seller Selection with + Tambah Seller */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center">
                <Tag className="h-3.5 w-3.5 mr-1 text-red-600" />
                Seller E-Commerce
              </label>
              
              <button
                type="button"
                onClick={() => {
                  setShowAddSeller(!showAddSeller);
                  setSellerError("");
                }}
                className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center hover:underline focus:outline-none cursor-pointer"
                id="add-seller-trigger"
              >
                <Plus className="h-3 w-3 mr-0.5" />
                Tambah Seller
              </button>
            </div>

            {/* Dynamic Inline "+ Tambah Seller" Component */}
            {showAddSeller && (
              <form
                onSubmit={handleCreateSeller}
                className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2 duration-200"
                id="add-seller-form"
              >
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">INPUT SELLER BARU</div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newSellerName}
                    onChange={(e) => setNewSellerName(e.target.value)}
                    placeholder="Contoh: Skincare Shandy"
                    className="flex-grow bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-red-500"
                    id="new-seller-name-input"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-750 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Simpan
                  </button>
                </div>
                {sellerError && <p className="text-[10px] text-red-500 font-mono">{sellerError}</p>}
                {sellerSuccess && (
                  <p className="text-[10px] text-green-600 flex items-center">
                    <Check className="h-3 w-3 mr-0.5" /> Berhasil ditambahkan & terpilih!
                  </p>
                )}
              </form>
            )}

            <select
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-red-600 focus:bg-white transition-all font-medium"
              id="seller-dropdown"
            >
              <option value="" disabled>--- Pilih Seller ---</option>
              {sellers.map((s) => (
                <option key={s.NamaSeller} value={s.NamaSeller}>
                  {s.NamaSeller}
                </option>
              ))}
            </select>
          </div>

          {/* Operator Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
              <User className="h-3.5 w-3.5 mr-1 text-red-600" />
              Nama Operator
            </label>
            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-red-600 focus:bg-white transition-all font-medium"
              id="operator-dropdown"
            >
              <option value="" disabled>--- Pilih Operator ---</option>
              {operators.map((o) => (
                <option key={o.NamaOperator} value={o.NamaOperator}>
                  {o.NamaOperator}
                </option>
              ))}
            </select>
          </div>

          {/* Start scanning trigger button */}
          <button
            onClick={handleStart}
            className="w-full mt-6 bg-red-600 hover:bg-red-750 text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-sm active:scale-98 transition-all cursor-pointer text-sm"
            id="start-scanning-button"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>MULAI SCAN SEKARANG</span>
          </button>
        </div>
      </div>

      {/* Summary Card by Seller with Date Filter on Operator Login page */}
      <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex flex-col space-y-2 border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-xs text-slate-800 flex items-center tracking-wider uppercase">
              <Users className="h-4 w-4 text-red-600 mr-1.5" />
              REKAP SCAN SELLER
            </h3>
            <span className="bg-red-50 text-red-600 border border-red-100 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              {Object.keys(statsSeller).length} Seller
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            Total scan paket yang tersimpan di database lokal per seller.
          </p>
        </div>

        {/* Date Filters */}
        <div className="space-y-3">
          <div className="bg-slate-100 p-0.5 rounded-xl flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSummaryDateType("ALL")}
              className={`flex-1 py-1 text-[9px] font-bold rounded-lg text-center transition-all cursor-pointer ${
                summaryDateType === "ALL" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setSummaryDateType("TODAY")}
              className={`flex-1 py-1 text-[9px] font-bold rounded-lg text-center transition-all cursor-pointer ${
                summaryDateType === "TODAY" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setSummaryDateType("YESTERDAY")}
              className={`flex-1 py-1 text-[9px] font-bold rounded-lg text-center transition-all cursor-pointer ${
                summaryDateType === "YESTERDAY" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Kemarin
            </button>
            <button
              type="button"
              onClick={() => setSummaryDateType("CUSTOM")}
              className={`flex-1 py-1 text-[9px] font-bold rounded-lg text-center transition-all cursor-pointer ${
                summaryDateType === "CUSTOM" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Kustom
            </button>
          </div>

          {summaryDateType === "CUSTOM" && (
            <div className="flex items-center space-x-1.5 animate-in fade-in slide-in-from-top-2 duration-150 bg-slate-50 p-2 border border-slate-200/60 rounded-xl justify-center">
              <input
                type="date"
                value={summaryStartDate}
                onChange={(e) => setSummaryStartDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[10px] font-medium text-slate-700 focus:outline-none focus:border-red-500"
              />
              <span className="text-[10px] text-slate-400 font-bold">s/d</span>
              <input
                type="date"
                value={summaryEndDate}
                onChange={(e) => setSummaryEndDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[10px] font-medium text-slate-700 focus:outline-none focus:border-red-500"
              />
            </div>
          )}
        </div>

        {Object.keys(statsSeller).length === 0 ? (
          <p className="text-slate-400 text-[11px] text-center py-4 font-medium">Belum ada rekap data pada filter ini.</p>
        ) : (
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {Object.entries(statsSeller).map(([sellerName, total]) => {
              const cancelledCount = filteredRecords.filter(r => r.Seller === sellerName && r.Status === "CANCELLED").length;
              const scannedCount = total - cancelledCount;

              return (
                <div key={sellerName} className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-100 rounded-xl transition duration-150">
                  <div className="max-w-[60%]">
                    <span className="font-extrabold text-[11px] text-slate-700 block truncate" title={sellerName}>
                      {sellerName}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] bg-green-50 text-green-700 border border-green-150 px-1.5 py-0.5 rounded font-mono font-bold" title="Scanned / Berhasil">
                      {scannedCount} OK
                    </span>
                    {cancelledCount > 0 && (
                      <span className="text-[9px] bg-red-50 text-red-650 border border-red-150 px-1.5 py-0.5 rounded font-mono font-bold" title="Cancelled / Batal">
                        {cancelledCount} BT
                      </span>
                    )}
                    <span className="text-[10px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-mono font-black">
                      {total} Pkt
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
