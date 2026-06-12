/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Plus, Play, User, Home, Tag, HelpCircle, Check, BookOpen } from "lucide-react";
import { Outlet, Seller, Operator } from "../types";
import { dbService } from "../utils/db";

interface WelcomeScreenProps {
  onStartScanning: (config: {
    outlet: string;
    seller: string;
    operator: string;
  }) => void;
  savedOutlet: string;
  savedSeller: string;
  savedOperator: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartScanning,
  savedOutlet,
  savedSeller,
  savedOperator
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

  useEffect(() => {
    // Load metadata lists
    const outs = dbService.getOutlets();
    const ops = dbService.getOperators();
    const sels = dbService.getSellers();

    setOutlets(outs);
    setOperators(ops);
    setSellers(sels);

    // Hydrate from previous localStorage, otherwise fallback to index 0
    // FIX: Hanya pakai data yang tersimpan, jika tidak ada biarkan kosong ("")
    // agar memicu teks placeholder default dropdown
    setSelectedOutlet(savedOutlet || "");
    setSelectedSeller(savedSeller || "");
    setSelectedOperator(savedOperator || "");
  }, [savedOutlet, savedSeller, savedOperator]);

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
      alert("Harap pilih Outlet!");
      return;
    }
    if (!selectedSeller) {
      alert("Harap pilih Seller!");
      return;
    }
    if (!selectedOperator) {
      alert("Harap pilih Operator!");
      return;
    }

    onStartScanning({
      outlet: selectedOutlet,
      seller: selectedSeller,
      operator: selectedOperator
    });
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 md:p-6" id="welcome-setup-screen">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 relative overflow-hidden">
        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl animate-pulse" />
        
        <div className="text-center mb-6">
          <p className="text-red-650 text-[10px] font-bold tracking-widest uppercase mb-1">J&T Express Ecommerce Gateway</p>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">LOGIN</h2>
          <p className="text-xs text-slate-500 mt-1.5">
            Sistem Scanner E-COMMERCE J&T Terintegrasi.
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
              id="outlet-dropdown">
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
                    className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
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
              Nama Operator Pickup
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
            <span>MULAI SCAN</span>
          </button>
        </div>
      </div>
    </div>
  );
};
