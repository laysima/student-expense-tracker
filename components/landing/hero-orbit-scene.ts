import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
} from 'three'

export interface HeroOrbitScene {
  setActive: (active: boolean) => void
  setTheme: (light: boolean) => void
  dispose: () => void
}

export function createHeroOrbitScene(host: HTMLDivElement, interactionRegion: HTMLElement): HeroOrbitScene | null {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none'
  host.appendChild(renderer.domElement)

  const scene = new Scene()
  const camera = new PerspectiveCamera(44, 1, 0.1, 30)
  camera.position.z = 8.4
  const orbit = new Group()
  scene.add(orbit)
  scene.add(new AmbientLight('#FFF6E9', 1.6))
  const keyLight = new DirectionalLight('#FFE0C8', 3.5)
  keyLight.position.set(-3, 4, 5)
  scene.add(keyLight)
  const rimLight = new DirectionalLight('#B7D1B1', 2)
  rimLight.position.set(4, -1, 3)
  scene.add(rimLight)

  const coral = new MeshStandardMaterial({ color: '#E2835F', metalness: 0.5, roughness: 0.32 })
  const sage = new MeshStandardMaterial({ color: '#A9BA9E', metalness: 0.35, roughness: 0.42 })
  const muted = new MeshStandardMaterial({ color: '#8E8D7D', transparent: true, opacity: 0.32, metalness: 0.25, roughness: 0.6 })
  const outer = new Mesh(new TorusGeometry(2.87, 0.012, 6, 128), muted)
  outer.rotation.set(0.4, -0.4, -0.25)
  const middle = new Mesh(new TorusGeometry(2.52, 0.026, 8, 128), sage)
  middle.rotation.set(-0.45, 0.3, 0.4)
  const arc = new Mesh(new TorusGeometry(2.72, 0.045, 8, 128, Math.PI * 1.55), coral)
  arc.rotation.set(0.18, 0.52, -0.8)
  orbit.add(outer, middle, arc)

  const nodeGeometry = new SphereGeometry(0.095, 16, 12)
  const coralNode = new Mesh(nodeGeometry, coral)
  const sageNode = new Mesh(nodeGeometry, sage)
  const smallNode = new Mesh(nodeGeometry, coral)
  smallNode.scale.setScalar(0.55)
  orbit.add(coralNode, sageNode, smallNode)

  let targetX = 0
  let targetY = 0
  let active = false
  let disposed = false
  let frame = 0
  let lastFrame = 0
  let elapsed = 0

  function resize() {
    const { width, height } = host.getBoundingClientRect()
    if (!width || !height || disposed) return
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  resize()

  function move(event: PointerEvent) {
    const rect = interactionRegion.getBoundingClientRect()
    targetY = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1)) * 0.12
    targetX = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1)) * 0.08
  }
  function resetPointer() { targetX = 0; targetY = 0 }
  interactionRegion.addEventListener('pointermove', move, { passive: true })
  interactionRegion.addEventListener('pointerleave', resetPointer)

  function draw(time: number) {
    if (!active || disposed) return
    frame = requestAnimationFrame(draw)
    // This is a background detail; 30 rendered frames per second is sufficient.
    if (time - lastFrame < 1000 / 30) return
    const delta = Math.min((time - lastFrame) / 1000, 0.05)
    lastFrame = time
    elapsed += delta
    const ease = 1 - Math.exp(-delta * 4)
    orbit.rotation.x += (targetX - orbit.rotation.x) * ease
    orbit.rotation.y += (targetY - orbit.rotation.y) * ease
    orbit.rotation.z = Math.sin(elapsed * 0.12) * 0.045
    arc.rotation.z = -0.8 + elapsed * 0.035
    middle.rotation.z = 0.4 - elapsed * 0.02
    coralNode.position.set(Math.cos(elapsed * 0.16 + 0.6) * 2.77, Math.sin(elapsed * 0.16 + 0.6) * 2.25, 0.4)
    sageNode.position.set(Math.cos(-elapsed * 0.12 + 3.8) * 2.7, Math.sin(-elapsed * 0.12 + 3.8) * 2.5, -0.1)
    smallNode.position.set(Math.cos(elapsed * 0.1 + 5.3) * 2.85, Math.sin(elapsed * 0.1 + 5.3) * 2.4, 0.2)
    renderer.render(scene, camera)
    host.dataset.ready = 'true'
  }

  function setActive(next: boolean) {
    if (disposed || active === next) return
    active = next
    cancelAnimationFrame(frame)
    if (active) { lastFrame = performance.now(); frame = requestAnimationFrame(draw) }
  }

  // Return to the CSS rings if the GPU context becomes unavailable.
  function contextLost(event: Event) {
    event.preventDefault()
    dispose()
  }
  renderer.domElement.addEventListener('webglcontextlost', contextLost)

  function dispose() {
    if (disposed) return
    setActive(false)
    disposed = true
    resizeObserver.disconnect()
    interactionRegion.removeEventListener('pointermove', move)
    interactionRegion.removeEventListener('pointerleave', resetPointer)
    renderer.domElement.removeEventListener('webglcontextlost', contextLost)
    outer.geometry.dispose()
    middle.geometry.dispose()
    arc.geometry.dispose()
    nodeGeometry.dispose()
    coral.dispose()
    sage.dispose()
    muted.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
    host.dataset.ready = 'false'
  }

  return {
    setActive,
    setTheme(light) {
      muted.color.set(light ? '#777C6B' : '#8E8D7D')
      muted.opacity = light ? 0.5 : 0.32
      renderer.toneMappingExposure = light ? 0.85 : 1
    },
    dispose,
  }
}
