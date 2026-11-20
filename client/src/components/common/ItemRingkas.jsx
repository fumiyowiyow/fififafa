import { useState } from 'react'

// Satu baris list ringkas untuk tampilan HP (1 Nov 2026) -- pengganti kartu bertumpuk di
// .responsive-cards yang bikin layar penuh kartu. Baris cuma nampilin judul + nilai utama;
// detail (data-card-row lama + tombol aksi) baru muncul setelah baris diketuk. Bungkus daftarnya
// dengan <div className="responsive-cards list-ringkas">.
//   judul, sub, nilai : isi baris (sub = keterangan kecil di bawah judul, nilai = angka di kanan)
//   warna             : titik warna circle/rumah usaha di depan judul (opsional)
//   redup             : baris dibuat pudar (nonaktif / belum lapor)
//   onPilih           : kalau diisi, ketuk baris menjalankan ini (mis. buka halaman detail),
//                       bukan membuka detail di tempat
//   selaluBuka        : detail dipaksa terbuka (mis. sedang mode edit)
//   buka, onToggle    : buka/tutup dikendalikan induk (mis. riwayat baru di-fetch saat dibuka)
//   children          : isi detail
export default function ItemRingkas({ judul, sub, nilai, warna, redup = false, onPilih, selaluBuka = false, buka, onToggle, children }) {
  const [bukaSendiri, setBukaSendiri] = useState(false)
  const adaDetail = !onPilih && children != null && children !== false
  const terbuka = adaDetail && ((buka ?? bukaSendiri) || selaluBuka)

  const isi = (
    <>
      {(onPilih || adaDetail) && (
        <span className="item-ringkas-panah" aria-hidden style={{ transform: terbuka ? 'rotate(90deg)' : 'none' }}>▶</span>
      )}
      {warna && <span className="item-ringkas-titik" aria-hidden style={{ background: warna }} />}
      <span className="item-ringkas-teks">
        <span className="item-ringkas-judul">{judul}</span>
        {sub && <span className="item-ringkas-sub">{sub}</span>}
      </span>
      {nilai != null && <span className="item-ringkas-nilai">{nilai}</span>}
    </>
  )

  return (
    <div className="item-ringkas" style={{ opacity: redup ? 0.55 : 1 }}>
      {onPilih || adaDetail ? (
        <button type="button" className="item-ringkas-baris" aria-expanded={onPilih ? undefined : terbuka}
          onClick={onPilih ?? onToggle ?? (() => setBukaSendiri(b => !b))}>
          {isi}
        </button>
      ) : (
        <div className="item-ringkas-baris">{isi}</div>
      )}
      {terbuka && <div className="item-ringkas-detail">{children}</div>}
    </div>
  )
}
