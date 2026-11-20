import { useState } from 'react'
import StudioBioInfoDasar from './StudioBioInfoDasar'
import StudioBioSkb from './StudioBioSkb'
import StudioBioRekening from './StudioBioRekening'
import StudioBioAnggota from './StudioBioAnggota'
import StudioBioKepemilikanShu from './StudioBioKepemilikanShu'
import StudioBioPengeluaranRutin from './StudioBioPengeluaranRutin'

// ── Modal Bio Studio (shell) ──────────────────────────────
// `info` dipertahankan di sini (bukan di dalam StudioBioInfoDasar) supaya judul modal
// "Bio Studio — {nama}" ikut update live begitu Info Dasar disimpan, tanpa nunggu modal
// ditutup-buka lagi (behavior yang sama seperti sebelum dipecah).

export default function StudioBioModal({ studio, canEdit, onClose, onNavigate, studios, users, circles, rumahUsahaList, onSaved }) {
  const [info, setInfo] = useState({
    nama: studio.nama, circle: studio.circle ?? null, rumahUsaha: studio.rumahUsaha ?? null, induk: studio.induk ?? null,
    tipe: studio.tipe, niche: studio.niche, koordinatorId: studio.koordinatorId,
    statusAktif: studio.statusAktif,
    hitungDiEkosistem: studio.hitungDiEkosistem, mitraKolaborasi: studio.mitraKolaborasi,
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, gap: 0 }}>
        <div className="modal-header" style={{ flexShrink: 0, padding: '16px 20px' }}>
          <span className="modal-title">Bio Studio — {info.nama}</span>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px 20px 20px' }}>

          <StudioBioInfoDasar
            info={info} setInfo={setInfo} canEdit={canEdit}
            circles={circles} rumahUsahaList={rumahUsahaList} users={users}
            korporasiList={(studios ?? []).filter(s => s.tipe === 'KORPORASI')}
            studioId={studio.id} onSaved={onSaved}
          />

          <StudioBioSkb studioId={studio.id} skbUrl={studio.skbUrl ?? null} canEdit={canEdit} />

          <StudioBioRekening studioId={studio.id} canEdit={canEdit} />

          <StudioBioAnggota
            studio={studio} canEdit={canEdit} studios={studios} users={users}
            onNavigate={onNavigate} onClose={onClose}
          />

          <StudioBioKepemilikanShu studio={studio} canEdit={canEdit} users={users} onSaved={onSaved} />

          <StudioBioPengeluaranRutin studioId={studio.id} canEdit={canEdit} />

        </div>
      </div>
    </div>
  )
}
