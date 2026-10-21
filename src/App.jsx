import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Check, ChevronDown, CircleHelp, Clock3, Crosshair, Database, Download, FileText, Filter, Home,
  LocateFixed, LogOut, Mail, Map, MapPin, Menu, MoreHorizontal, Plus, Search, Settings, ShieldCheck,
  SlidersHorizontal, Users, UserPlus, X, Eye,
} from 'lucide-react'

const seedReports = [
  { _id: 'RW-2841', neighborhood: 'Indiranagar', road: '12th Main Road, Bengaluru', createdAt: '2026-10-21T10:24:00', status: 'Reported', lat: 12.9719, lng: 77.6412, severity: 'High', image: 'pothole-one' },
  { _id: 'RW-2838', neighborhood: 'HSR Layout', road: '27th Cross Road, Bengaluru', createdAt: '2026-10-20T16:11:00', status: 'In progress', lat: 12.9116, lng: 77.6389, severity: 'Medium', image: 'pothole-two' },
  { _id: 'RW-2834', neighborhood: 'Koramangala', road: '80 Feet Road, Bengaluru', createdAt: '2026-10-19T09:03:00', status: 'Reported', lat: 12.9352, lng: 77.6245, severity: 'High', image: 'pothole-three' },
  { _id: 'RW-2829', neighborhood: 'Jayanagar', road: '9th Block, Bengaluru', createdAt: '2026-10-18T18:47:00', status: 'Fixed', lat: 12.9250, lng: 77.5838, severity: 'Low', image: 'pothole-four' },
  { _id: 'RW-2822', neighborhood: 'Whitefield', road: 'ITPL Main Road, Bengaluru', createdAt: '2026-10-17T14:35:00', status: 'In progress', lat: 12.9698, lng: 77.7499, severity: 'Medium', image: 'pothole-five' },
  { _id: 'RW-2817', neighborhood: 'Marathahalli', road: 'HAL Old Airport Road, Bengaluru', createdAt: '2026-10-16T11:18:00', status: 'Reported', lat: 12.9591, lng: 77.6974, severity: 'High', image: 'pothole-six' },
  { _id: 'RW-2810', neighborhood: 'BTM Layout', road: '2nd Stage, Bengaluru', createdAt: '2026-10-15T17:02:00', status: 'Fixed', lat: 12.9166, lng: 77.6101, severity: 'Low', image: 'pothole-seven' },
]

const navItems = [
  { label: 'Overview', icon: Home }, { label: 'Reports', icon: FileText },
  { label: 'Map', icon: MapPin }, { label: 'Users', icon: Users },
]

const demoTeam = [
  { name: 'Amit Sharma', email: 'amit.sharma@roadwatch.local', role: 'Municipal Officer', zone: 'Central Bengaluru', status: 'Active', initials: 'AS' },
  { name: 'Priya Nair', email: 'priya.nair@roadwatch.local', role: 'Field Engineer', zone: 'South Bengaluru', status: 'Active', initials: 'PN' },
  { name: 'Rahul Verma', email: 'rahul.verma@roadwatch.local', role: 'Field Engineer', zone: 'East Bengaluru', status: 'Active', initials: 'RV' },
  { name: 'Kavya Rao', email: 'kavya.rao@roadwatch.local', role: 'Administrator', zone: 'All zones', status: 'Active', initials: 'KR' },
  { name: 'Vikram Das', email: 'vikram.das@roadwatch.local', role: 'Field Engineer', zone: 'North Bengaluru', status: 'Pending', initials: 'VD' },
]

const formatDate = (value) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))

async function readApiJson(response) {
  const body = await response.text()
  let result = null
  try { result = body ? JSON.parse(body) : null } catch {}
  if (!result || typeof result !== 'object') {
    throw new Error(`The deployed site did not receive a JSON response from the RoadWatch API (HTTP ${response.status}). Deploy the Express server with the website and verify the production API URL.`)
  }
  if (!response.ok) throw new Error(result.message || `The RoadWatch server returned an error (${response.status}).`)
  return result
}

function StatusBadge({ status }) {
  const key = status.toLowerCase().replace(' ', '-')
  return <span className={`status-badge ${key}`}><i />{status}</span>
}

function ReportThumb({ kind, imageUrl }) {
  return <div className={`report-thumb ${kind || ''}`} aria-label="Road damage photo">{imageUrl ? <img src={imageUrl} alt="Reported road damage" /> : <span />}</div>
}

function SummaryCard({ icon: Icon, title, value, change, direction, tone, caption }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-icon"><Icon size={22} strokeWidth={2.5} /></div>
      <div className="metric-copy">
        <p>{title}</p>
        <div className="metric-value-row"><strong>{value}</strong>{change && <span className={direction}>{direction === 'down' ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}{change}</span>}</div>
        <small>{caption}</small>
      </div>
    </article>
  )
}

function ReportMapViewport({ reports, currentLocation, recenterKey }) {
  const map = useMap()
  const reportPoints = reports
    .filter((report) => Number.isFinite(Number(report.lat)) && Number.isFinite(Number(report.lng)))
    .map((report) => [Number(report.lat), Number(report.lng)])
  const pointsKey = reportPoints.map(([lat, lng]) => `${lat},${lng}`).join(';')
  useEffect(() => {
    const points = [...reportPoints]
    if (currentLocation) points.push([currentLocation.lat, currentLocation.lng])
    if (points.length > 1) map.fitBounds(points, { padding: [38, 38], maxZoom: 13 })
    else if (points.length === 1) map.setView(points[0], currentLocation ? 14 : 13)
    else map.setView([0, 0], 2)
  }, [map, pointsKey, currentLocation, recenterKey])
  return null
}

function RoadMap({ reports, currentLocation = null, recenterKey = 0 }) {
  const color = (status) => status === 'Fixed' ? '#0eaa75' : status === 'In progress' ? '#f4a51c' : '#ef5350'
  return (
    <MapContainer center={[0, 0]} zoom={2} scrollWheelZoom={false} zoomControl={false} className="map-canvas">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ZoomControl position="bottomright" />
      <ReportMapViewport reports={reports} currentLocation={currentLocation} recenterKey={recenterKey} />
      {reports.map((report) => <CircleMarker key={report._id} center={[report.lat, report.lng]} radius={11} pathOptions={{ color: '#fff', weight: 3, fillColor: color(report.status), fillOpacity: 1 }}>
        <Popup><strong>{report.neighborhood}</strong><br />{report.road}{report.wardNumber && <><br />Ward {report.wardNumber}</>}{report.zone && <><br />{report.zone}</>}<br /><StatusBadge status={report.status} /></Popup>
      </CircleMarker>)}
      {currentLocation && <CircleMarker center={[currentLocation.lat, currentLocation.lng]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#087fce', fillOpacity: 1 }}><Popup><strong>Your current location</strong></Popup></CircleMarker>}
    </MapContainer>
  )
}

function SectionHeading({ label, title, description, action }) {
  return <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" />CITY OPERATIONS <span className="eyebrow-separator">/</span> {label.toUpperCase()}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function ReportsPage({ reports, query, setQuery, statusFilter, setStatusFilter, updateStatus }) {
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [severityFilter, setSeverityFilter] = useState('All priorities')
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = reports.filter((report) => {
    const searchableText = `${report._id} ${report.neighborhood} ${report.wardNumber || ''} ${report.road} ${report.zone || ''}`.toLowerCase()
    return searchableText.includes(normalizedQuery)
      && (statusFilter === 'All statuses' || report.status === statusFilter)
      && (severityFilter === 'All priorities' || report.severity === severityFilter)
  })
  const exportCsv = () => {
    const columns = ['Report ID', 'Neighborhood', 'Ward number', 'Road name', 'Zone', 'Date reported', 'Priority', 'Status', 'Latitude', 'Longitude', 'Photo URL']
    const rows = filtered.map((report) => [report._id, report.neighborhood, report.wardNumber, report.road, report.zone, formatDate(report.createdAt), report.severity || 'Medium', report.status, report.lat, report.lng, report.imageUrl ? new URL(report.imageUrl, window.location.origin).href : ''])
    const csv = [columns, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'roadwatch-reports.csv'
    link.click()
    URL.revokeObjectURL(url)
  }
  const exportPdf = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      window.alert('Allow pop-ups for RoadWatch to export the report list as a PDF.')
      return
    }
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
    const rows = filtered.map((report) => {
      const photoUrl = report.imageUrl ? new URL(report.imageUrl, window.location.origin).href : ''
      const photo = photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="Pothole reported in ${escapeHtml(report.neighborhood)}">` : '<span class="no-photo">No photo</span>'
      return `<tr><td class="photo-cell">${photo}</td><td>${escapeHtml(report._id)}</td><td>${escapeHtml(report.neighborhood)}</td><td>${escapeHtml(report.wardNumber)}</td><td>${escapeHtml(report.road)}</td><td>${escapeHtml(report.zone)}</td><td>${escapeHtml(formatDate(report.createdAt))}</td><td>${escapeHtml(report.severity || 'Medium')}</td><td>${escapeHtml(report.status)}</td><td>${escapeHtml(report.lat)}</td><td>${escapeHtml(report.lng)}</td></tr>`
    }).join('')
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>RoadWatch report list</title><style>
      @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font:10px Arial,sans-serif;color:#172b40;margin:0}h1{font-size:22px;margin:0 0 5px}.meta{color:#64768a;margin:0 0 18px}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #dce3e9;padding:5px;text-align:left;overflow-wrap:anywhere}th{background:#eff5f7;color:#395269;font-size:8px;text-transform:uppercase;letter-spacing:.03em}tr:nth-child(even){background:#f8fafb}.photo-cell{width:8%;text-align:center}.photo-cell img{display:block;width:58px;height:44px;margin:auto;object-fit:cover;border-radius:3px}.no-photo{color:#94a1ae;font-size:8px}td:nth-child(2){width:10%}td:nth-child(3){width:11%}td:nth-child(4){width:6%}td:nth-child(5){width:13%}td:nth-child(6){width:9%}td:nth-child(7){width:10%}td:nth-child(8),td:nth-child(9){width:7%}td:nth-child(10),td:nth-child(11){width:9%}tr{break-inside:avoid}footer{margin-top:14px;color:#64768a;font-size:9px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body><h1>RoadWatch pothole reports</h1><p class="meta">${filtered.length} reports · Generated ${escapeHtml(new Date().toLocaleString('en-IN'))}</p><table><thead><tr><th>Photo</th><th>Report ID</th><th>Neighborhood</th><th>Ward</th><th>Road name</th><th>Zone</th><th>Date reported</th><th>Priority</th><th>Status</th><th>Latitude</th><th>Longitude</th></tr></thead><tbody>${rows || '<tr><td colspan="11">No reports match the selected filters.</td></tr>'}</tbody></table><footer>RoadWatch Municipal Services</footer></body></html>`)
    printWindow.document.close()
    const imageLoads = [...printWindow.document.images].map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true })
      image.addEventListener('error', resolve, { once: true })
      window.setTimeout(resolve, 10000)
    }))
    printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true })
    Promise.all(imageLoads).then(() => {
      printWindow.focus()
      printWindow.print()
    })
  }
  return <>
    <SectionHeading label="Reports" title="Pothole reports" description="Review, filter and update road issues submitted by citizens." action={<div className="heading-actions"><button className="secondary-action" onClick={exportCsv}><Download size={15} /> Export CSV</button><button className="primary-action" onClick={exportPdf}><Download size={15} /> Export PDF</button></div>} />
    <div className="report-stats-row"><div><span className="stat-number">{reports.length}</span><span className="stat-label">Total in view</span></div><div><span className="stat-number red-text">{reports.filter((r) => r.status === 'Reported').length}</span><span className="stat-label">Awaiting review</span></div><div><span className="stat-number amber-text">{reports.filter((r) => r.status === 'In progress').length}</span><span className="stat-label">In progress</span></div><div><span className="stat-number green-text">{reports.filter((r) => r.status === 'Fixed').length}</span><span className="stat-label">Fixed</span></div></div>
    <section className="panel report-directory"><div className="directory-toolbar"><div><h2>All reports</h2><p>Search reports by ID, neighborhood, ward, road, or zone.</p></div><span className="directory-total">{filtered.length} results</span></div><div className="directory-filters"><label className="table-search directory-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search report ID, ward, road, or zone" /><button aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button></label><label className="filter-select"><Filter size={14} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option>All statuses</option><option>Reported</option><option>In progress</option><option>Fixed</option></select></label><label className="filter-select"><SlidersHorizontal size={14} /><select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} aria-label="Filter by priority"><option>All priorities</option><option>High</option><option>Medium</option><option>Low</option></select></label></div><div className="table-scroll"><table className="directory-table"><thead><tr><th>REPORT</th><th>LOCATION</th><th>DATE SUBMITTED</th><th>PRIORITY</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{filtered.map((report) => <tr key={report._id}><td><div className="report-cell"><ReportThumb kind={report.image} imageUrl={report.imageUrl} /><span className="report-id">{report._id}</span></div></td><td><b className="location-name">{report.neighborhood}</b><span className="location-road">{report.road}{(report.wardNumber || report.zone) ? ` · Ward ${report.wardNumber || '—'} · ${report.zone || '—'}` : ''}</span></td><td><b className="date-main">{formatDate(report.createdAt)}</b><span className="date-time">Citizen submission</span></td><td><span className={`priority-label ${report.severity?.toLowerCase()}`}>{report.severity || 'Medium'}</span></td><td><StatusBadge status={report.status} /></td><td><div className="report-row-actions"><button type="button" className="report-view-button" onClick={() => setSelectedReportId(report._id)}><Eye size={14} /> View</button><select className="row-action" value={report.status} onChange={(event) => updateStatus(report._id, event.target.value)} aria-label={`Update ${report._id}`}><option>Reported</option><option>In progress</option><option>Fixed</option></select></div></td></tr>)}{filtered.length === 0 && <tr><td className="empty-state" colSpan="6">No reports match these filters.</td></tr>}</tbody></table></div><div className="table-footer"><span>Showing <b>{filtered.length}</b> of <b>{reports.length}</b> reports</span><button onClick={() => { setQuery(''); setStatusFilter('All statuses'); setSeverityFilter('All priorities') }}>Reset filters <X size={13} /></button></div></section>
    {selectedReportId && reports.find((report) => report._id === selectedReportId) && <ReportDetailsCard report={reports.find((report) => report._id === selectedReportId)} onClose={() => setSelectedReportId(null)} />}
  </>
}

function ReportDetailsCard({ report, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  const reporter = typeof report.submittedBy === 'object' && report.submittedBy ? report.submittedBy : null
  const coordinates = Number.isFinite(Number(report.lat)) && Number.isFinite(Number(report.lng))
    ? `${Number(report.lat).toFixed(6)}, ${Number(report.lng).toFixed(6)}`
    : 'Not available'
  const history = [...(report.statusHistory || [])].sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt))
  return <div className="report-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="report-detail-card" role="dialog" aria-modal="true" aria-labelledby="report-detail-title">
      <header className="report-detail-header"><div><span className="report-detail-kicker">POTHOLE REPORT</span><h2 id="report-detail-title">{report._id}</h2><p>Complete report information and activity</p></div><button type="button" className="icon-button" aria-label="Close report details" onClick={onClose}><X size={21} /></button></header>
      <div className="report-detail-content">
        <div className="report-detail-photo">{report.imageUrl ? <img src={report.imageUrl} alt={`Pothole reported in ${report.neighborhood}`} /> : <div><FileText size={28} /><span>No photo attached</span></div>}</div>
        <div className="report-detail-main">
          <div className="report-detail-badges"><StatusBadge status={report.status} /><span className={`priority-label ${report.severity?.toLowerCase()}`}>{report.severity || 'Medium'} priority</span></div>
          <h3>Location</h3>
          <div className="report-detail-fields">
            <div><small>Neighborhood / locality</small><b>{report.neighborhood || 'Not provided'}</b></div>
            <div><small>Road name</small><b>{report.road || 'Not provided'}</b></div>
            <div><small>Ward number</small><b>{report.wardNumber || 'Not provided'}</b></div>
            <div><small>Zone</small><b>{report.zone || 'Not provided'}</b></div>
            <div><small>Coordinates</small><b>{coordinates}</b></div>
            <div><small>Date submitted</small><b>{new Date(report.createdAt).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}</b></div>
            <div className="report-detail-reporter"><small>Submitted by</small><b>{reporter?.name || 'Citizen account'}</b>{reporter?.email && <span>{reporter.email}</span>}</div>
          </div>
          <div className="report-detail-description"><h3>Description</h3><p>{report.description?.trim() || 'No additional description was provided.'}</p></div>
          <div className="report-detail-history"><h3>Status history</h3>{history.length ? <ol>{history.map((entry, index) => <li key={`${entry.changedAt}-${index}`}><span className={`report-history-dot ${entry.status?.toLowerCase().replace(' ', '-')}`} /><div><b>{entry.status}</b><small>{new Date(entry.changedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small>{entry.note && <p>{entry.note}</p>}</div></li>)}</ol> : <p>Report submitted on {new Date(report.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}. No status changes recorded yet.</p>}</div>
        </div>
      </div>
    </section>
  </div>
}

function CitizenReportPage({ onCreated }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [createdReport, setCreatedReport] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [location, setLocation] = useState(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [locating, setLocating] = useState(false)

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview) }, [photoPreview])

  const choosePhoto = (event) => {
    const file = event.target.files?.[0]
    setError('')
    if (!file) { setPhotoPreview(''); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      event.target.value = ''
      setPhotoPreview('')
      setError('Choose a JPG, PNG, or WebP photo.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      event.target.value = ''
      setPhotoPreview('')
      setError('The photo must be 5 MB or smaller.')
      return
    }
    setPhotoPreview(URL.createObjectURL(file))
  }

  const submitReport = async (event) => {
    event.preventDefault()
    if (!location) { setError('Use your current location or choose a point on the map.'); return }
    const form = event.currentTarget
    setError('')
    setSubmitting(true)
    try {
      const response = await fetch('/api/reports', { method: 'POST', body: new FormData(form) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Could not submit your report.')
      onCreated(result)
      setCreatedReport(result)
      setPhotoPreview('')
      setLocation(null)
      form.reset()
    } catch (submitError) { setError(submitError.message) }
    finally { setSubmitting(false) }
  }

  if (createdReport) return <>
    <SectionHeading label="Citizen report" title="Thank you for reporting this pothole" description="Your report has been saved and is now visible to the municipal road team." />
    <section className="panel citizen-success"><span className="citizen-success-icon"><Check size={27} /></span><h2>Report submitted</h2><p>Keep this reference number to follow up on your report.</p><code>{createdReport._id}</code><button className="primary-action" onClick={() => setCreatedReport(null)}>Submit another report <ArrowRight size={15} /></button></section>
  </>

  return <>
    <SectionHeading label="Citizen report" title="Report a pothole" description="Share a photo and the exact location so the repair team can find the problem." />
    <div className="citizen-report-layout">
      <form className="panel citizen-report-form" onSubmit={submitReport}>
        <div className="citizen-form-heading"><span className="citizen-form-icon"><MapPin size={19} /></span><div><h2>Where is the pothole?</h2><p>Enter the address manually, then use your location or select the spot on a map.</p></div></div>
        <div className="citizen-fields">
          <label>Neighborhood or locality<input name="neighborhood" required maxLength="100" placeholder="e.g. Indiranagar" /></label>
          <label>Ward number<input name="wardNumber" required maxLength="20" placeholder="e.g. Ward 150" /></label>
          <label>Road name<input name="road" required maxLength="180" placeholder="e.g. 12th Main Road" /></label>
          <label>Zone<input name="zone" required maxLength="100" placeholder="e.g. East Bengaluru" /></label>
          <div className="citizen-location-field"><span className="citizen-field-label">Pinpoint the location <span className="required-label">Required</span></span><div className="location-choice-buttons"><button type="button" className="secondary-action" disabled={locating} onClick={() => { setError(''); if (!navigator.geolocation) { setError('Current location is not available in this browser. Choose a point on the map instead.'); return } setLocating(true); navigator.geolocation.getCurrentPosition(({ coords }) => { setLocation({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy, source: 'Current location' }); setLocating(false) }, (geoError) => { setLocating(false); setError(geoError.code === geoError.PERMISSION_DENIED ? 'Location permission was denied. You can choose your location on the map instead.' : 'Could not get your current location. Choose a point on the map instead.') }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }) }}><LocateFixed size={15} />{locating ? 'Finding location…' : 'Use current location'}</button><button type="button" className="secondary-action" onClick={() => { setError(''); setMapOpen(true) }}><Map size={15} />Select on map</button></div>{location ? <div className="selected-location"><span className="live-dot" /><span><b>{location.source} selected</b><small>{location.lat.toFixed(6)}, {location.lng.toFixed(6)}{location.accuracy ? ` · accuracy ±${Math.round(location.accuracy)} m` : ''}</small></span><button type="button" onClick={() => setLocation(null)}>Change</button></div> : <small className="location-help">Choose either option to attach a precise map location to your report.</small>}<input type="hidden" name="lat" value={location?.lat ?? ''} /><input type="hidden" name="lng" value={location?.lng ?? ''} /></div>
          <label>How serious is it?<select name="severity" defaultValue="Medium"><option>High</option><option>Medium</option><option>Low</option></select></label>
          <label className="citizen-description">Additional details<textarea name="description" maxLength="1200" rows="3" placeholder="Describe the pothole or a helpful landmark (optional)" /></label>
          <label className="citizen-photo-field">Pothole photo <span className="required-label">Required</span>
            <span className={`citizen-photo-picker ${photoPreview ? 'has-photo' : ''}`}>
              {photoPreview ? <img src={photoPreview} alt="Selected pothole preview" /> : <span className="photo-picker-prompt"><span className="photo-picker-icon"><Plus size={19} /></span><b>Choose a photo</b><small>JPG, PNG, or WebP · up to 5 MB</small></span>}
              <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required onChange={choosePhoto} />
            </span>
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="citizen-form-footer"><span>Your location is shared with the road repair team.</span><button className="primary-action" disabled={submitting} type="submit">{submitting ? 'Submitting…' : 'Submit report'} <ArrowRight size={15} /></button></div>
      </form>
      <aside className="panel citizen-tips"><h2>Help us fix it faster</h2><p>A clear picture and a precise location help crews assess and find the issue.</p><div><b>1</b><span><strong>Add a clear photo</strong><small>Capture the pothole and enough of the road to show its size.</small></span></div><div><b>2</b><span><strong>Pin the location</strong><small>Use your current location or select the spot on the map.</small></span></div><div><b>3</b><span><strong>Send your report</strong><small>The report will appear in the municipal dashboard.</small></span></div></aside>
    </div>
    {mapOpen && <LocationPickerMap startLocation={location} onCancel={() => setMapOpen(false)} onConfirm={(point) => { setLocation({ ...point, source: 'Map location' }); setMapOpen(false) }} />}
  </>
}

function MapClickCapture({ onPick }) {
  useMapEvents({ click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }) })
  return null
}

function LocationPickerMap({ startLocation, onCancel, onConfirm }) {
  const [point, setPoint] = useState(startLocation ? { lat: startLocation.lat, lng: startLocation.lng } : null)
  const [mapCenter, setMapCenter] = useState(startLocation ? [startLocation.lat, startLocation.lng] : null)
  const [zoom, setZoom] = useState(startLocation ? 16 : 2)
  const [locating, setLocating] = useState(!startLocation)
  const [locationError, setLocationError] = useState('')

  useEffect(() => {
    if (startLocation) return
    const useFallback = (message) => {
      setMapCenter([20, 0])
      setZoom(2)
      setLocationError(message)
      setLocating(false)
    }
    if (!navigator.geolocation) {
      useFallback('Current location is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const current = { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }
      setPoint(current)
      setMapCenter([current.lat, current.lng])
      setZoom(16)
      setLocating(false)
    }, () => useFallback('Could not access your current location. Pan and zoom to choose a point.'), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    })
  }, [startLocation])

  return <div className="location-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}><section className="location-modal" role="dialog" aria-modal="true" aria-labelledby="location-modal-title"><div className="location-modal-heading"><div><h2 id="location-modal-title">Choose the pothole location</h2><p>{locating ? 'Finding your current location to center the map…' : locationError || 'Centered on your current location. Click the map to move the pin.'}</p></div><button type="button" className="icon-button" aria-label="Close map" onClick={onCancel}><X size={19} /></button></div><div className="location-picker-map">{mapCenter && <MapContainer key={`${mapCenter[0]}-${mapCenter[1]}`} center={mapCenter} zoom={zoom} scrollWheelZoom zoomControl={false} className="map-canvas"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><ZoomControl position="bottomright" /><MapClickCapture onPick={setPoint} />{point && <CircleMarker center={[point.lat, point.lng]} radius={10} pathOptions={{ color: '#fff', weight: 3, fillColor: '#078e9f', fillOpacity: 1 }} />}</MapContainer>}{!mapCenter && <div className="location-map-loading">Finding your current location…</div>}</div><div className="location-modal-footer"><span>{point ? <><Crosshair size={14} /> Selected: {point.lat.toFixed(6)}, {point.lng.toFixed(6)}</> : 'No location selected yet'}</span><div><button type="button" className="secondary-action" onClick={onCancel}>Cancel</button><button type="button" className="primary-action" disabled={!point} onClick={() => onConfirm(point)}>Use this location <Check size={15} /></button></div></div></section></div>
}

function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const response = await fetch(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const result = await readApiJson(response)
      setEmail('')
      setPassword('')
      setName('')
      onAuthenticated(result.user)
    } catch (authError) { setError(authError.message === 'Failed to fetch' ? 'Could not reach the RoadWatch API. Check that the backend is deployed and the API URL is configured.' : authError.message) }
    finally { setSaving(false) }
  }

  return <main className="auth-screen"><section className="auth-card">
    <a className="brand auth-brand" href="#"><span className="brand-mark"><Activity size={25} strokeWidth={2.8} /></span><span><strong>RoadWatch</strong><small>Safer roads, together</small></span></a>
    <div className="auth-intro"><span className="auth-kicker">ROADWATCH COMMUNITY</span><h1>{mode === 'login' ? 'Welcome back' : 'Create your citizen account'}</h1><p>{mode === 'login' ? 'Sign in to report road damage and follow repair progress.' : 'Join RoadWatch to report potholes and track your submissions.'}</p></div>
    <form className="auth-form" onSubmit={submit}>
      {mode === 'register' && <label>Your name<input autoComplete="name" required maxLength="100" value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></label>}
      <label>Email address<input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
      <label>Password<input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" minLength="8" maxLength="128" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'login' ? 'Enter your password' : 'At least 8 characters'} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-action auth-submit" disabled={saving} type="submit">{saving ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={15} /></button>
    </form>
    <p className="auth-switch">{mode === 'login' ? 'New to RoadWatch?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Create a citizen account' : 'Sign in'}</button></p>
    <div className="auth-role-note"><ShieldCheck size={15} /> Administrator accounts are provisioned by the RoadWatch system administrator.</div>
  </section><div className="auth-side"><span className="auth-side-mark"><Activity size={28} /></span><h2>Every report helps make roads safer.</h2><p>Share a photo, tell us where it is, and follow the repair from your account.</p><div className="auth-side-points"><span><Check size={15} /> Submit a pothole report</span><span><Check size={15} /> Track pending repair work</span><span><Check size={15} /> See status updates in one place</span></div></div></main>
}

function CitizenDashboard({ user, reports, onReport }) {
  const pending = reports.filter((report) => report.status === 'Reported').length
  const inProgress = reports.filter((report) => report.status === 'In progress').length
  const fixed = reports.filter((report) => report.status === 'Fixed').length
  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" />CITIZEN SPACE <span className="eyebrow-separator">/</span> MY DASHBOARD</div><h1>Hello, {user.name.split(' ')[0]}</h1><p>See your pothole reports and follow the repair work in your area.</p></div><button className="primary-action" onClick={onReport}><Plus size={15} /> Report a pothole</button></div>
    <div className="metric-grid citizen-metrics"><SummaryCard icon={FileText} title="Awaiting review" value={String(pending)} change="" direction="down" tone="rose" caption="reports received" /><SummaryCard icon={Clock3} title="Repair in progress" value={String(inProgress)} change="" direction="down" tone="amber" caption="being worked on" /><SummaryCard icon={Check} title="Fixed" value={String(fixed)} change="" direction="down" tone="mint" caption="completed reports" /><SummaryCard icon={Activity} title="My reports" value={String(reports.length)} change="" direction="down" tone="sky" caption="submitted by you" /></div>
    <section className="panel citizen-own-reports"><div className="panel-heading"><div><h2>Your recent reports</h2><p>Follow each pothole from submission through repair.</p></div></div><div className="table-scroll"><table><thead><tr><th>REPORT</th><th>LOCATION</th><th>SUBMITTED</th><th>PRIORITY</th><th>WORK STATUS</th></tr></thead><tbody>{reports.slice(0, 10).map((report) => <tr key={report._id}><td><div className="report-cell"><ReportThumb kind={report.image} imageUrl={report.imageUrl} /><span className="report-id">{report._id}</span></div></td><td><b className="location-name">{report.neighborhood}</b><span className="location-road">{report.road}{(report.wardNumber || report.zone) ? ` · Ward ${report.wardNumber || '—'} · ${report.zone || '—'}` : ''}</span></td><td><b className="date-main">{formatDate(report.createdAt)}</b></td><td><span className={`priority-label ${report.severity?.toLowerCase()}`}>{report.severity || 'Medium'}</span></td><td><StatusBadge status={report.status} /></td></tr>)}{reports.length === 0 && <tr><td className="empty-state" colSpan="5">You have not submitted a pothole report yet.</td></tr>}</tbody></table></div></section>
    <div className="citizen-progress-note"><ShieldCheck size={17} /><span><b>We’ll keep your reports updated.</b><small>When the road team changes a report’s status, you’ll see it here after signing in.</small></span></div>
  </>
}

function CitizenReportsPage({ reports, onReport }) {
  return <>
    <SectionHeading label="My reports" title="Reports submitted by you" description="Track the review and repair progress for each pothole you have reported." action={<button className="primary-action" onClick={onReport}><Plus size={15} /> Report a pothole</button>} />
    <section className="panel citizen-own-reports"><div className="table-scroll"><table><thead><tr><th>REPORT</th><th>LOCATION</th><th>SUBMITTED</th><th>PRIORITY</th><th>WORK STATUS</th></tr></thead><tbody>{reports.map((report) => <tr key={report._id}><td><div className="report-cell"><ReportThumb kind={report.image} imageUrl={report.imageUrl} /><span className="report-id">{report._id}</span></div></td><td><b className="location-name">{report.neighborhood}</b><span className="location-road">{report.road}{(report.wardNumber || report.zone) ? ` · Ward ${report.wardNumber || '—'} · ${report.zone || '—'}` : ''}</span></td><td><b className="date-main">{formatDate(report.createdAt)}</b></td><td><span className={`priority-label ${report.severity?.toLowerCase()}`}>{report.severity || 'Medium'}</span></td><td><StatusBadge status={report.status} /></td></tr>)}{reports.length === 0 && <tr><td className="empty-state" colSpan="5">No reports yet. Submit your first pothole report to track it here.</td></tr>}</tbody></table></div></section>
  </>
}

function MapPage({ reports }) {
  const [mapStatus, setMapStatus] = useState('All reports')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [locationMessage, setLocationMessage] = useState('Getting your current location…')
  const [recenterKey, setRecenterKey] = useState(0)
  const mapReports = reports.filter((report) => mapStatus === 'All reports' || report.status === mapStatus)
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Current location is unavailable; showing all report locations.')
      return
    }
    setLocationMessage('Getting your current location…')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setCurrentLocation({ lat: coords.latitude, lng: coords.longitude })
      setLocationMessage('Centered on your current location and showing report pins.')
      setRecenterKey((value) => value + 1)
    }, (error) => {
      setCurrentLocation(null)
      setLocationMessage(error.code === error.PERMISSION_DENIED
        ? 'Location access is blocked; showing all report locations. Allow location access to center on you.'
        : 'Could not get your location; showing all report locations.')
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 })
  }
  useEffect(() => { requestLocation() }, [])
  return <>
    <SectionHeading label="Map" title="City report map" description="Explore pothole reports by location and current repair status." />
    <section className="panel full-map-panel"><div className="full-map-toolbar"><div><h2>{currentLocation ? 'Your current location' : 'Report locations'}</h2><p>{locationMessage} · {mapReports.length} report {mapReports.length === 1 ? 'pin' : 'pins'}</p></div><div className="full-map-actions"><div className="map-filter-tabs">{['All reports', 'Reported', 'In progress', 'Fixed'].map((status) => <button key={status} className={mapStatus === status ? 'selected' : ''} onClick={() => setMapStatus(status)}>{status}</button>)}</div><button type="button" className="secondary-action map-locate-button" onClick={requestLocation}><LocateFixed size={15} /> My location</button></div></div><div className="full-map-wrap"><RoadMap reports={mapReports} currentLocation={currentLocation} recenterKey={recenterKey} /><div className="map-legend full-map-legend"><span><i className="legend-red" />Reported</span><span><i className="legend-amber" />In progress</span><span><i className="legend-green" />Fixed</span></div></div><div className="full-map-footer"><span><MapPin size={14} /> Pins update with report status</span><span>Map tiles © OpenStreetMap contributors</span></div></section>
    <div className="map-report-strip">{mapReports.slice(0, 4).map((report) => <article className="mini-report-card" key={report._id}><ReportThumb kind={report.image} imageUrl={report.imageUrl} /><div><b>{report.neighborhood}</b><small>{report.road}</small></div><StatusBadge status={report.status} /></article>)}</div>
  </>
}

function UsersPage() {
  const [team, setTeam] = useState(demoTeam)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Field Engineer')
  const [search, setSearch] = useState('')
  const [memberError, setMemberError] = useState('')
  const [savingMember, setSavingMember] = useState(false)
  useEffect(() => {
    fetch('/api/team').then((response) => response.ok ? response.json() : Promise.reject()).then((data) => setTeam(Array.isArray(data) ? data : [])).catch(() => {
      try { setTeam(JSON.parse(localStorage.getItem('roadwatch-team')) || demoTeam) } catch { setTeam(demoTeam) }
    })
  }, [])
  useEffect(() => { localStorage.setItem('roadwatch-team', JSON.stringify(team)) }, [team])
  const visibleTeam = team.filter((member) => `${member.name} ${member.email} ${member.zone}`.toLowerCase().includes(search.toLowerCase()))
  const addMember = async (event) => {
    event.preventDefault()
    if (!name.trim() || !email.trim()) return
    setMemberError(''); setSavingMember(true)
    try {
      const response = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, role }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Could not add team member.')
      setTeam((current) => [result, ...current]); setName(''); setEmail(''); setFormOpen(false)
    } catch (error) { setMemberError(error.message) }
    finally { setSavingMember(false) }
  }
  return <>
    <SectionHeading label="Users" title="Team members" description="Manage the municipal staff who review reports and coordinate repairs." action={<button className="primary-action" onClick={() => setFormOpen(!formOpen)}>{formOpen ? <X size={15} /> : <UserPlus size={15} />}{formOpen ? 'Close form' : 'Add team member'}</button>} />
    <div className="user-summary-grid"><article><div className="summary-icon blue"><Users size={18} /></div><div><b>{team.length}</b><small>Team members</small></div></article><article><div className="summary-icon green"><ShieldCheck size={18} /></div><div><b>{team.filter((member) => member.status === 'Active').length}</b><small>Active accounts</small></div></article><article><div className="summary-icon amber"><Mail size={18} /></div><div><b>{team.filter((member) => member.status === 'Pending').length}</b><small>Pending setup</small></div></article></div>
    {formOpen && <form className="panel add-member-form" onSubmit={addMember}><div><h2>Add a team member</h2><p>Save a team record to the RoadWatch database.</p></div><label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ananya Rao" /></label><label>Email address<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@municipality.gov.in" /></label><label>Role<select value={role} onChange={(event) => setRole(event.target.value)}><option>Field Engineer</option><option>Municipal Officer</option><option>Administrator</option></select></label><button className="primary-action" disabled={savingMember} type="submit"><Plus size={15} /> {savingMember ? 'Saving…' : 'Add member'}</button>{memberError && <p className="form-error" role="alert">{memberError}</p>}</form>}
    <section className="panel team-panel"><div className="directory-toolbar"><div><h2>Staff directory</h2><p>People with access to the RoadWatch operations workspace.</p></div><label className="table-search team-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a team member" /></label></div><div className="team-list"><div className="team-list-head"><span>MEMBER</span><span>ROLE</span><span>ASSIGNED ZONE</span><span>STATUS</span></div>{visibleTeam.map((member) => <div className="team-row" key={member.email}><div className="team-person"><span className="team-avatar">{member.initials || member.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><span><b>{member.name}</b><small>{member.email}</small></span></div><span className="team-role">{member.role}</span><span className="team-zone">{member.zone}</span><span><span className={`member-status ${member.status.toLowerCase()}`}><i />{member.status}</span></span></div>)}{visibleTeam.length === 0 && <div className="no-team-results">No team members match that search.</div>}</div><div className="team-note"><ShieldCheck size={15} /> Admin workspace access is protected by administrator sign-in. Staff directory entries are informational records.</div></section>
  </>
}

function SettingsPage({ apiState }) {
  const [saved, setSaved] = useState(false)
  const [preferences, setPreferences] = useState(() => { try { return { municipality: 'Bengaluru', duplicateRadius: '20', emailAlerts: true, statusAlerts: true, weeklySummary: false, ...JSON.parse(localStorage.getItem('roadwatch-settings') || '{}') } } catch { return { municipality: 'Bengaluru', duplicateRadius: '20', emailAlerts: true, statusAlerts: true, weeklySummary: false } } })
  const update = (field, value) => { setPreferences((current) => ({ ...current, [field]: value })); setSaved(false) }
  const save = (event) => { event.preventDefault(); localStorage.setItem('roadwatch-settings', JSON.stringify(preferences)); setSaved(true) }
  return <>
    <SectionHeading label="Settings" title="Workspace settings" description="Adjust your local dashboard preferences and report handling defaults." />
    <form className="settings-layout" onSubmit={save}><div className="settings-main">
      <section className="panel settings-card"><div className="settings-card-heading"><span className="settings-icon"><SlidersHorizontal size={17} /></span><div><h2>General</h2><p>Set the default city and duplicate report behavior.</p></div></div><label className="setting-field"><span><b>Municipality</b><small>City used for map and report defaults</small></span><select value={preferences.municipality} onChange={(event) => update('municipality', event.target.value)}><option>Bengaluru</option><option>Mysuru</option><option>Mangaluru</option><option>Other</option></select></label><label className="setting-field"><span><b>Duplicate warning radius</b><small>Warn before creating a report near an existing pothole</small></span><span className="radius-input"><input type="number" min="5" max="500" value={preferences.duplicateRadius} onChange={(event) => update('duplicateRadius', event.target.value)} /><small>meters</small></span></label></section>
      <section className="panel settings-card"><div className="settings-card-heading"><span className="settings-icon"><Bell size={17} /></span><div><h2>Notifications</h2><p>Choose which dashboard updates you want to see.</p></div></div><label className="toggle-setting"><span><b>New report alerts</b><small>Notify me when citizens submit new potholes</small></span><input type="checkbox" checked={preferences.emailAlerts} onChange={(event) => update('emailAlerts', event.target.checked)} /></label><label className="toggle-setting"><span><b>Status change alerts</b><small>Notify me when a report is marked in progress or fixed</small></span><input type="checkbox" checked={preferences.statusAlerts} onChange={(event) => update('statusAlerts', event.target.checked)} /></label><label className="toggle-setting"><span><b>Weekly summary</b><small>Receive a weekly overview of city repair activity</small></span><input type="checkbox" checked={preferences.weeklySummary} onChange={(event) => update('weeklySummary', event.target.checked)} /></label></section>
      <section className="panel settings-card"><div className="settings-card-heading"><span className="settings-icon"><Database size={17} /></span><div><h2>Data connection</h2><p>RoadWatch uses the Express API and MongoDB database.</p></div></div><div className="connection-row"><span><i className={apiState === 'connected' ? 'live-dot' : 'demo-dot'} /> MongoDB connection</span><code>roadwatch database</code><span className="connection-status">{apiState === 'connected' ? 'Connected' : 'Demo mode'}</span></div></section>
      <div className="settings-save-row"><span>{saved ? <><Check size={15} /> Preferences saved on this device.</> : 'Preferences are saved to this browser.'}</span><button className="primary-action" type="submit">Save changes <ArrowRight size={15} /></button></div>
    </div><aside className="panel settings-aside"><div className="settings-aside-icon"><Settings size={19} /></div><h3>Workspace defaults</h3><p>These settings apply to this browser session and do not change your MongoDB records.</p><div className="aside-divider" /><div className="aside-info"><b>Duplicate radius</b><span>{preferences.duplicateRadius} meters</span></div><div className="aside-info"><b>Default city</b><span>{preferences.municipality}</span></div></aside></form>
  </>
}

function HelpPage() {
  return <>
    <SectionHeading label="Help & support" title="How can we help?" description="Quick guidance for reviewing reports and keeping road repairs moving." />
    <div className="help-hero"><div><span className="help-kicker">ROADWATCH SUPPORT CENTRE</span><h2>Help make every report count.</h2><p>Find quick answers for the most common tasks in the municipal dashboard.</p></div><span className="help-hero-mark"><CircleHelp size={46} /></span></div>
    <div className="help-grid"><section className="panel help-card"><div className="help-card-title"><span className="help-icon"><FileText size={17} /></span><div><h2>Frequently asked questions</h2><p>Common questions about reports and status updates.</p></div></div><details><summary>How do I update a pothole report?</summary><p>Open Reports, find the report, then use its Action menu to choose Reported, In progress, or Fixed. The dashboard updates the map marker to match.</p></details><details><summary>How are duplicate reports identified?</summary><p>New reports are compared with open reports within a 20-meter radius of their GPS coordinates. Nearby matches are returned so the reporter can check before submitting.</p></details><details><summary>Why can’t I see a report on the map?</summary><p>Check that the report has valid latitude and longitude coordinates. Use the status filters to ensure the report type you need is visible.</p></details><details><summary>Where are dashboard settings stored?</summary><p>Current display preferences are saved in this browser. Report data and status changes are stored in MongoDB when the database is connected.</p></details></section>
      <div className="help-side"><section className="panel help-card"><span className="help-icon"><MapPin size={17} /></span><h2>Quick start</h2><ol className="quick-start"><li><i>1</i><span><b>Review new reports</b><small>Use the Reports page to filter by status and priority.</small></span></li><li><i>2</i><span><b>Check the location</b><small>Open the city map and inspect nearby road reports.</small></span></li><li><i>3</i><span><b>Update repair status</b><small>Mark a report in progress or fixed after work is confirmed.</small></span></li></ol></section><section className="support-card"><div className="support-card-icon"><Mail size={17} /></div><div><b>Need more help?</b><p>Contact your RoadWatch workspace administrator for account or access questions.</p></div></section></div>
    </div>
  </>
}

function NotificationCenter({ reports, session, onViewReports }) {
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`roadwatch-notifications:${session._id || session.email}`) || '[]') }
    catch { return [] }
  })
  const rootRef = useRef(null)
  const storageKey = `roadwatch-notifications:${session._id || session.email}`
  const notifications = useMemo(() => reports.flatMap((report) => {
    const location = [report.neighborhood, report.road].filter(Boolean).join(' · ')
    const createdAt = report.createdAt || report.updatedAt || new Date().toISOString()
    const submitted = {
      id: `${report._id}:submitted:${createdAt}`,
      reportId: report._id,
      title: session.role === 'admin' ? 'New pothole report submitted' : 'Your report was submitted',
      description: location || `Report ${report._id}`,
      status: 'Reported',
      timestamp: createdAt,
    }
    const updates = (report.statusHistory || []).map((entry, index) => ({
      id: `${report._id}:status:${entry.changedAt || index}:${entry.status}`,
      reportId: report._id,
      title: session.role === 'admin' ? `Report ${entry.status.toLowerCase()}` : `Your report is ${entry.status.toLowerCase()}`,
      description: entry.note || location || `Report ${report._id}`,
      status: entry.status,
      timestamp: entry.changedAt || createdAt,
    }))
    return [submitted, ...updates]
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), [reports, session.role])
  const unreadCount = notifications.filter((item) => !readIds.includes(item.id)).length

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(readIds)) } catch {}
  }, [readIds, storageKey])

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const markAllRead = () => setReadIds(notifications.map((item) => item.id))
  const openReport = (notification) => {
    if (!readIds.includes(notification.id)) setReadIds((current) => [...current, notification.id])
    setOpen(false)
    onViewReports()
  }

  return <div className="notification-wrapper" ref={rootRef}>
    <button className="icon-button notification-button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>
      <Bell size={19} />{unreadCount > 0 && <i aria-hidden="true" />}
    </button>
    {open && <section className="notification-panel" role="dialog" aria-label="Notifications">
      <div className="notification-panel-heading"><div><h2>Notifications</h2><p>{unreadCount ? `${unreadCount} unread updates` : 'You’re all caught up'}</p></div><button type="button" disabled={!unreadCount} onClick={markAllRead}>Mark all read</button></div>
      <div className="notification-list">
        {notifications.length ? notifications.map((item) => <button type="button" className={`notification-item ${readIds.includes(item.id) ? '' : 'unread'}`} key={item.id} onClick={() => openReport(item)}>
          <span className={`notification-status ${item.status.toLowerCase().replace(' ', '-')}`}><FileText size={16} /></span>
          <span className="notification-item-copy"><b>{item.title}</b><span>{item.description}</span><small>{item.reportId} · {new Date(item.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small></span>
          {!readIds.includes(item.id) && <i className="notification-unread-dot" aria-label="Unread" />}
        </button>) : <div className="notification-empty"><Bell size={21} /><b>No notifications yet</b><span>Report submissions and status updates will show here.</span></div>}
      </div>
      <button type="button" className="notification-view-all" onClick={() => { setOpen(false); onViewReports() }}>View reports <ArrowRight size={15} /></button>
    </section>}
  </div>
}

export default function App() {
  const [reports, setReports] = useState([])
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authScreenVersion, setAuthScreenVersion] = useState(0)
  const [activeNav, setActiveNav] = useState('Overview')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [range, setRange] = useState('This month')
  const [menuOpen, setMenuOpen] = useState(false)
  const [apiState, setApiState] = useState('loading')

  useEffect(() => {
    fetch('/api/auth/me').then(async (response) => {
      if (response.ok) {
        const result = await response.json()
        setSession(result.user)
        setActiveNav(result.user.role === 'admin' ? 'Overview' : 'My dashboard')
      }
    }).catch(() => {}).finally(() => setAuthReady(true))
  }, [])

  useEffect(() => {
    if (!session) return
    let active = true
    let firstLoad = true
    const refreshReports = async () => {
      try {
        const [reportsResponse, healthResponse] = await Promise.all([fetch('/api/reports'), fetch('/api/health')])
        if (!reportsResponse.ok || !healthResponse.ok) throw new Error('API unavailable')
        const [data, health] = await Promise.all([reportsResponse.json(), healthResponse.json()])
        if (active) {
          if (Array.isArray(data)) setReports(data)
          setApiState(health.database === 'connected' ? 'connected' : 'demo')
        }
      } catch {
        if (active) {
          if (firstLoad) setReports([])
          setApiState('demo')
        }
      } finally { firstLoad = false }
    }
    refreshReports()
    const refreshTimer = window.setInterval(refreshReports, 30000)
    return () => { active = false; window.clearInterval(refreshTimer) }
  }, [session])

  const filteredReports = useMemo(() => reports.filter((report) => {
    const matchesQuery = `${report.neighborhood} ${report.wardNumber || ''} ${report.road} ${report.zone || ''} ${report._id}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (statusFilter === 'All statuses' || report.status === statusFilter)
  }), [reports, query, statusFilter])

  const updateStatus = async (id, status) => {
    const previous = reports.find((report) => report._id === id)?.status
    setReports((current) => current.map((report) => report._id === id ? { ...report, status } : report))
    try {
      const response = await fetch(`/api/reports/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      if (!response.ok) throw new Error('Could not update the report status.')
      const updated = await response.json()
      setReports((current) => current.map((report) => report._id === id ? { ...report, ...updated } : report))
    } catch { setReports((current) => current.map((report) => report._id === id ? { ...report, status: previous || report.status } : report)) }
  }

  const addReport = (report) => setReports((current) => [report, ...current])
  const authenticate = (user) => {
    setSession(user)
    setReports([])
    setActiveNav(user.role === 'admin' ? 'Overview' : 'My dashboard')
  }
  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setSession(null)
    setReports([])
    setAuthScreenVersion((version) => version + 1)
    setActiveNav('Overview')
  }
  const visibleNavItems = session?.role === 'admin' ? navItems : [
    { label: 'My dashboard', icon: Home }, { label: 'My reports', icon: FileText },
  ]

  if (!authReady) return <div className="auth-loading"><Activity size={22} /> Loading RoadWatch…</div>
  if (!session) return <AuthPage key={authScreenVersion} onAuthenticated={authenticate} />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#overview" onClick={() => setActiveNav('Overview')}>
          <span className="brand-mark"><Activity size={26} strokeWidth={2.8} /></span>
          <span><strong>RoadWatch</strong><small>{session.role === 'admin' ? 'Admin workspace' : 'Citizen portal'}</small></span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {visibleNavItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-link ${activeNav === label ? 'active' : ''}`} onClick={() => { setActiveNav(label); setMenuOpen(false) }}>
            <Icon size={19} strokeWidth={2.2} /><span>{label}</span>{['Reports', 'My reports'].includes(label) && <span className="nav-count">{reports.length}</span>}
          </button>)}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-bottom">
          {session.role === 'citizen' && <button className={`nav-link citizen-nav-link ${activeNav === 'Report a pothole' ? 'active' : ''}`} onClick={() => { setActiveNav('Report a pothole'); setMenuOpen(false) }}><Plus size={18} /><span>Report a pothole</span></button>}
          {session.role === 'admin' && <><button className={`nav-link ${activeNav === 'Settings' ? 'active' : ''}`} onClick={() => setActiveNav('Settings')}><Settings size={18} /><span>Settings</span></button><button className={`nav-link ${activeNav === 'Help & Support' ? 'active' : ''}`} onClick={() => setActiveNav('Help & Support')}><CircleHelp size={18} /><span>Help &amp; Support</span></button></>}
        </div>
        <div className="sidebar-foot">ROADWATCH <span>•</span> MUNICIPAL SERVICES</div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} /></button>
          {session.role === 'admin' && <label className="global-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reports, locations or reference ID..." /><kbd>⌘ K</kbd></label>}
          <div className="topbar-actions">
            <NotificationCenter reports={reports} session={session} onViewReports={() => setActiveNav(session.role === 'admin' ? 'Reports' : 'My reports')} />
            <div className="profile-info"><span className="avatar">{session.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><span className="profile-copy"><b>{session.name}</b><small>{session.role === 'admin' ? 'Administrator' : 'Citizen'}</small></span></div>
            <button className="sign-out-button" onClick={signOut} title="Sign out"><LogOut size={15} /><span>Sign out</span></button>
          </div>
        </header>

        <section className="content">
          {session.role === 'citizen' ? activeNav === 'Report a pothole' ? <CitizenReportPage onCreated={addReport} /> : activeNav === 'My reports' ? <CitizenReportsPage reports={reports} onReport={() => setActiveNav('Report a pothole')} /> : <CitizenDashboard user={session} reports={reports} onReport={() => setActiveNav('Report a pothole')} /> : activeNav === 'Overview' ? <>
          <div className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-dot" />CITY OPERATIONS <span className="eyebrow-separator">/</span> OVERVIEW</div><h1>{activeNav === 'Overview' ? 'Operations overview' : activeNav}</h1><p>Track pothole reports, work status and repair performance across the city.</p></div>
            <button className="date-select" onClick={() => setRange(range === 'This month' ? 'Last 30 days' : 'This month')}><CalendarDays size={17} /><span>{range === 'This month' ? '01 Oct 2026 – 31 Oct 2026' : 'Last 30 days'}</span><ChevronDown size={15} /></button>
          </div>

          <div className="metric-grid">
            <SummaryCard icon={FileText} title="Open reports" value={String(reports.filter((r) => r.status === 'Reported').length)} change="" direction="down" tone="rose" caption="in the database" />
            <SummaryCard icon={Clock3} title="In progress" value={String(reports.filter((r) => r.status === 'In progress').length)} change="" direction="down" tone="amber" caption="in the database" />
            <SummaryCard icon={Check} title="Fixed reports" value={String(reports.filter((r) => r.status === 'Fixed').length)} change="" direction="down" tone="mint" caption="in the database" />
            <SummaryCard icon={Activity} title="Total reports" value={String(reports.length)} change="" direction="down" tone="sky" caption="all statuses" />
          </div>

          <div className="dashboard-grid">
            <section className="panel reports-panel">
              <div className="panel-heading"><div><div className="panel-title-row"><h2>Recent reports</h2><span className="report-total">{filteredReports.length} shown</span></div><p>Latest road issues submitted by citizens</p></div><button className="text-link" onClick={() => setActiveNav('Reports')}>View all reports <ArrowRight size={16} /></button></div>
              <div className="table-tools"><div className="table-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this list" /><button aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button></div><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter reports by status"><option>All statuses</option><option>Reported</option><option>In progress</option><option>Fixed</option></select></div>
              <div className="table-scroll"><table><thead><tr><th>REPORT</th><th>LOCATION</th><th>DATE REPORTED</th><th>STATUS</th><th className="actions-heading">ACTION</th></tr></thead><tbody>
                {filteredReports.map((report) => <tr key={report._id}><td><div className="report-cell"><ReportThumb kind={report.image} imageUrl={report.imageUrl} /><span className="report-id">{report._id}</span></div></td><td><b className="location-name">{report.neighborhood}</b><span className="location-road">{report.road}{(report.wardNumber || report.zone) ? ` · Ward ${report.wardNumber || '—'} · ${report.zone || '—'}` : ''}</span></td><td><b className="date-main">{formatDate(report.createdAt)}</b><span className="date-time">{report.severity} priority</span></td><td><StatusBadge status={report.status} /></td><td><select className="row-action" value={report.status} onChange={(event) => updateStatus(report._id, event.target.value)} aria-label={`Update status for ${report._id}`}><option>Reported</option><option>In progress</option><option>Fixed</option></select></td></tr>)}
                {filteredReports.length === 0 && <tr><td className="empty-state" colSpan="5">No reports match your search.</td></tr>}
              </tbody></table></div>
              <div className="table-footer"><span>Showing <b>{filteredReports.length}</b> of <b>{reports.length}</b> reports</span><button onClick={() => { setQuery(''); setStatusFilter('All statuses') }}>Clear filters <X size={13} /></button></div>
            </section>

            <section className="panel map-panel">
              <div className="panel-heading map-heading"><div><div className="panel-title-row"><h2>Pothole reports map</h2><span className="map-live"><span className="live-dot" /> LIVE</span></div></div><button className="text-link" onClick={() => setActiveNav('Map')}>Full map <ArrowRight size={16} /></button></div>
              <div className="map-wrap"><RoadMap reports={reports} /><div className="map-legend"><span><i className="legend-red" />Open</span><span><i className="legend-amber" />In progress</span><span><i className="legend-green" />Fixed</span></div><div className="map-caption"><MapPin size={14} /> {reports.filter((report) => Number.isFinite(Number(report.lat)) && Number.isFinite(Number(report.lng))).length} reports mapped <span>•</span> Updated just now</div></div>
              <div className="map-summary"><div><span className="legend-red-dot" /><b>{reports.filter((report) => report.status === 'Reported').length}</b><small>Open</small></div><div><span className="legend-amber-dot" /><b>{reports.filter((report) => report.status === 'In progress').length}</b><small>In progress</small></div><div><span className="legend-green-dot" /><b>{reports.filter((report) => report.status === 'Fixed').length}</b><small>Fixed</small></div><button aria-label="More map options"><MoreHorizontal size={18} /></button></div>
            </section>
          </div>
          <footer className="content-footer"><span>© 2026 RoadWatch Municipal Services</span><span className="footer-links"><a href="#privacy">Privacy</a><a href="#support">Support</a><span>v1.0.0</span></span></footer>
          </> : activeNav === 'Reports' ? <ReportsPage reports={reports} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} updateStatus={updateStatus} />
            : activeNav === 'Map' ? <MapPage reports={reports} />
              : activeNav === 'Users' ? <UsersPage />
                : activeNav === 'Settings' ? <SettingsPage apiState={apiState} />
                  : <HelpPage />}
        </section>
      </main>
    </div>
  )
}
