const fs = require('fs');
let code = fs.readFileSync('src/components/OwnerScreen.tsx', 'utf8');
const target = `            </button>
          </div>
        </div>

      </div>

          {/* Import YoYi Section */}`;
const replacement = `            </button>
          </div>
        </div>

      </div>

          {/* Chart Ringkasan (Recharts) */}
          {(() => {
            const todayStr = getTodayLocalDateString();
            const resiTodayCount = allRecords.filter(r => r.Tanggal === todayStr).length;
            const retakeCount = allRecords.filter(r => r.RetakeStatus === "PENDING" || r.RetakeStatus === "RETAKEN").length;
            const cancelledCount = allRecords.filter(r => r.Status === "CANCELLED").length;

            const chartData = [
              { name: "Scan Hari Ini", value: resiTodayCount, fill: "#3b82f6" },
              { name: "Bermasalah (Retake)", value: retakeCount, fill: "#f59e0b" },
              { name: "Status Cancelled", value: cancelledCount, fill: "#ef4444" }
            ];

            return (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-sm text-slate-800 flex items-center">
                    <BarChart3 className="h-4 w-4 text-blue-500 mr-2" />
                    RINGKASAN STATUS RESI
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Grafik perbandingan total resi yang discan hari ini, total resi bermasalah, dan total dibatalkan.
                  </p>
                </div>
                
                <div className="h-[250px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <RechartsTooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                        {chartData.map((entry, index) => (
                          <Cell key={\`cell-\${index}\`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          {/* Import YoYi Section */}`;

if (code.includes(target)) {
  fs.writeFileSync('src/components/OwnerScreen.tsx', code.replace(target, replacement));
  console.log("Replaced successfully!");
} else {
  console.log("Target not found!");
}
