import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'
import { STLLoader  } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader  } from 'three/examples/jsm/loaders/OBJLoader.js'
import { useCADStore } from './useCADStore'

// Module-level cache maps object-id → BufferGeometry (not serialised, session-only)
export const importGeometryCache = new Map()

let _importId = 1
const importUid = () => `imp_${_importId++}`

function centerGeometry(geo) {
  geo.computeBoundingBox()
  const box    = geo.boundingBox
  const center = new THREE.Vector3()
  box.getCenter(center)
  geo.translate(-center.x, -center.y, -center.z)
  return geo
}

function geoToBBoxParams(geo) {
  geo.computeBoundingBox()
  const s = new THREE.Vector3()
  geo.boundingBox.getSize(s)
  return { w: parseFloat(s.x.toFixed(3)), h: parseFloat(s.y.toFixed(3)), d: parseFloat(s.z.toFixed(3)) }
}

const FILE_VERSION = 1

/* Build a Three.js geometry matching the CADObject component's geometry args */
function buildGeometry(type) {
  switch (type) {
    case 'sphere':   return new THREE.SphereGeometry(0.5, 32, 32)
    case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
    case 'cone':     return new THREE.ConeGeometry(0.5, 1, 16)
    case 'torus':    return new THREE.TorusGeometry(0.5, 0.18, 16, 48)
    default:         return new THREE.BoxGeometry(1, 1, 1)
  }
}

/* Build a disposable Three.js group from the current objects array */
function buildExportGroup(objects) {
  const group = new THREE.Group()
  for (const obj of objects) {
    const geo  = buildGeometry(obj.type)
    const mat  = new THREE.MeshStandardMaterial({ color: obj.color ?? '#c4b0ff' })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(...(obj.position ?? [0, 0, 0]))
    mesh.rotation.set(...(obj.rotation ?? [0, 0, 0]))
    mesh.scale.set(...(obj.scale ?? [1, 1, 1]))
    group.add(mesh)
  }
  return group
}

function triggerDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function useFileOperations() {
  const { objects, restoreObjects } = useCADStore()

  /* ── New ── */
  const newFile = () => {
    if (objects.length === 0 || window.confirm('Create new file? Unsaved changes will be lost.')) {
      restoreObjects([])
    }
  }

  /* ── Open (JSON round-trip format) ── */
  const openFile = () => {
    const input = document.createElement('input')
    input.type   = 'file'
    input.accept = '.json,.tfc'
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result)
          if (!Array.isArray(data.objects)) throw new Error('missing objects array')
          restoreObjects(data.objects)
        } catch {
          window.alert('Could not open file — expected a TOFU CAD .json file.')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  /* ── Save (download JSON) ── */
  const saveFile = (filename = `tofu-cad-${Date.now()}.json`) => {
    const payload = JSON.stringify(
      { version: FILE_VERSION, savedAt: new Date().toISOString(), objects },
      null, 2
    )
    triggerDownload(payload, filename, 'application/json')
  }

  /* ── Save As (prompt for name) ── */
  const saveAs = () => {
    const raw = window.prompt('Save as:', `tofu-design-${Date.now()}.json`)
    if (!raw) return
    saveFile(raw.endsWith('.json') ? raw : `${raw}.json`)
  }

  /* ── Export STL ── */
  const exportSTL = () => {
    if (objects.length === 0) { window.alert('No objects in scene to export.'); return }
    const group   = buildExportGroup(objects)
    const result  = new STLExporter().parse(group, { binary: true })
    triggerDownload(result, 'tofu-export.stl', 'model/stl')
    group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose() } })
  }

  /* ── Export OBJ ── */
  const exportOBJ = () => {
    if (objects.length === 0) { window.alert('No objects in scene to export.'); return }
    const group  = buildExportGroup(objects)
    const result = new OBJExporter().parse(group)
    triggerDownload(result, 'tofu-export.obj', 'model/obj')
    group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose() } })
  }

  /* ── Export STEP (not supported in browser — inform user) ── */
  const exportSTEP = () => {
    window.alert('STEP export requires a server-side CAD kernel and is not yet available.\n\nUse STL (for 3D printing / meshes) or OBJ (for most 3D apps).')
  }

  /* ── Import STL ── */
  const importSTL = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.stl'
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const loader = new STLLoader()
          const geo    = centerGeometry(loader.parse(ev.target.result))
          const params = geoToBBoxParams(geo)
          const id     = importUid()
          importGeometryCache.set(id, geo)
          useCADStore.getState().addObject({
            id, type: 'import', name: file.name.replace(/\.stl$/i,''),
            color: '#80f0e0', position: [0, params.h / 2, 0],
            params, _extra: { importSource: 'stl' },
          })
        } catch { window.alert('Could not parse STL file.') }
      }
      reader.readAsArrayBuffer(file)
    }
    input.click()
  }

  /* ── Import OBJ ── */
  const importOBJ = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.obj'
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const loader = new OBJLoader()
          const group  = loader.parse(ev.target.result)
          const geos   = []
          group.traverse(o => { if (o.isMesh) geos.push(o.geometry.clone()) })
          if (!geos.length) { window.alert('No meshes found in OBJ file.'); return }
          const merged = geos.length === 1 ? geos[0] : (() => {
            const m = new THREE.BufferGeometry()
            // Simple merge: concatenate positions
            const positions = geos.flatMap(g => Array.from(g.attributes.position.array))
            m.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
            return m
          })()
          const geo    = centerGeometry(merged)
          const params = geoToBBoxParams(geo)
          const id     = importUid()
          importGeometryCache.set(id, geo)
          useCADStore.getState().addObject({
            id, type: 'import', name: file.name.replace(/\.obj$/i,''),
            color: '#c4b0ff', position: [0, params.h / 2, 0],
            params, _extra: { importSource: 'obj' },
          })
        } catch { window.alert('Could not parse OBJ file.') }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return { newFile, openFile, saveFile, saveAs, exportSTL, exportOBJ, exportSTEP, importSTL, importOBJ }
}
