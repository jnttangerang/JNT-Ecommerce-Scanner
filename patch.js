const fs = require('fs');
let code = fs.readFileSync('src/components/OwnerScreen.tsx', 'utf8');
const target = `          <p className="text-[10px] text-slate-400 mt-4 leading-relaxed italic">
            * Perubahan sandi hanya disimpan di local storage peramban browser perangkat ini.
          </p>
        </div>
      </div>
      </div>
    );
  };`;
const replacement = `          <p className="text-[10px] text-slate-400 mt-4 leading-relaxed italic">
            * Perubahan sandi hanya disimpan di local storage peramban browser perangkat ini.
          </p>
        </div>

        {/* Pengaturan Kode Resi Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h4 className="font-bold text-slate-900 flex items-center text-sm font-sans">
                  <Tag className="h-4 w-4 text-red-600 mr-2" />
                  PENGATURAN AWALAN KODE RESI
                </h4>
                <p className="text-[10px] text-slate-400">Atur huruf awalan resi yang diizinkan saat scan barcode</p>
              </div>
            </div>

            <form onSubmit={handleSaveResiPrefixes} className="space-y-4">
              <div className="space-y-1.55">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Daftar Awalan (Pisahkan dengan koma):</label>
                <input
                  type="text"
                  value={resiPrefixesInput}
                  onChange={(e) => setResiPrefixesInput(e.target.value)}
                  placeholder="Contoh: JX, JZ, JO"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-850 text-xs focus:outline-none focus:border-red-650 font-mono uppercase"
                />
              </div>

              {resiPrefixSuccess && (
                <p className="text-[10px] text-emerald-600 font-bold">✓ Daftar awalan resi berhasil disimpan!</p>
              )}

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-black text-white font-bold py-2.5 rounded-xl cursor-pointer text-xs flex items-center justify-center space-x-1 border border-slate-900 transition-all shadow-sm"
              >
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Simpan Kode Awalan</span>
              </button>
            </form>
          </div>
          <p className="text-[10px] text-slate-400 mt-4 leading-relaxed italic">
            * Awalan resi digunakan untuk memvalidasi barcode yang dipindai kamera. Format standar J&T adalah 2 huruf diikuti 10 angka.
          </p>
        </div>
      </div>
      </div>
    );
  };`;

if (code.includes(target)) {
  fs.writeFileSync('src/components/OwnerScreen.tsx', code.replace(target, replacement));
  console.log("Replaced successfully!");
} else {
  console.log("Target not found!");
}
