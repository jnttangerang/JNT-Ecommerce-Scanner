const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

const newTypes = `
export interface Seller {
  id: string;
  kodeSeller: string;
  nama: string;
  kategoriProduk?: string;
  noHp?: string;
  alamat?: string;
  gps?: string;
  statusAktif: 'ACTIVE' | 'INACTIVE';
  targetHarian?: number;
  catatan?: string;
  updatedAt?: string;
  createdAt?: string;
  syncStatus?: 'SYNCED' | 'PENDING' | 'ERROR';
}
`;

code += newTypes;
fs.writeFileSync('src/types.ts', code);
