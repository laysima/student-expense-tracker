import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  Shape,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export interface SplashScene {
  /** Zoom the mark towards the camera while the overlay fades out. */
  exit: () => void
  dispose: () => void
}

// Logo artwork lives in SVG units. The origin is the centre of XtrackLogo's
// 'mark' viewBox (18 18 152 122), so the 3D mark lands exactly on top of the
// static SVG shown while three.js loads.
const UNIT = 1 / 40
const ORIGIN_X = 94
const ORIGIN_Y = 79
const VIEWBOX_WIDTH = 152
// Must match --xt-mark and the 42% offset in globals.css.
const MARK_VW = 0.46
const MARK_MAX_PX = 210
const MARK_TOP = 0.42

export const INTRO_SECONDS = 1.7
const EXIT_SECONDS = 0.55

type Point = [number, number]

const ARM_TOP: Point[] = [[27.58, 38.632], [58.27, 38.632], [88.96, 74.668], [72.22, 94.072]]
const ARM_BOTTOM: Point[] = [[102.91, 99.616], [128.02, 130.108], [158.71, 130.108], [119.65, 85.756]]
const SLASH: Point[] = [[22, 135.652], [52.69, 135.652], [141.97, 38.632], [125.23, 24.772]]
const ARROW: Point[] = [[125.23, 44.176], [164.29, 22], [144.76, 60.808]]
const BARS: Point[][] = [
  [[44.32, 132.88], [53.248, 132.88], [53.248, 117.3568], [44.32, 117.3568]],
  [[59.944, 132.88], [68.872, 132.88], [68.872, 107.932], [59.944, 107.932]],
  [[75.568, 132.88], [84.496, 132.88], [84.496, 96.844], [75.568, 96.844]],
]

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
function easeOutBack(t: number, overshoot = 1.70158) {
  const c = overshoot + 1
  return 1 + c * (t - 1) ** 3 + overshoot * (t - 1) ** 2
}
const progress = (time: number, delay: number, duration: number) => MathUtils.clamp((time - delay) / duration, 0, 1)

function extrude(points: Point[], depth: number) {
  const shape = new Shape(points.map(([x, y]) => new Vector2((x - ORIGIN_X) * UNIT, -(y - ORIGIN_Y) * UNIT)))
  return new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.018,
    bevelSegments: 3,
    curveSegments: 1,
  })
}

interface Flyer {
  mesh: Mesh
  rest: Vector3
  from: Vector3
  fromRotation: Vector3
  fromScale: number
  delay: number
  duration: number
  ease: (t: number) => number
}

function dotTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
  }
  return new CanvasTexture(canvas)
}

export function createSplashScene(host: HTMLElement, onIntroDone: () => void): SplashScene | null {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%'
  host.appendChild(renderer.domElement)

  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environment
  scene.environmentIntensity = 0.55

  const camera = new PerspectiveCamera(32, 1, 0.1, 60)
  scene.add(new AmbientLight('#FFF6E9', 0.5))
  const key = new DirectionalLight('#FFF1E6', 2.4)
  key.position.set(-2, 3, 5)
  const rim = new DirectionalLight('#B7D1B1', 1.6)
  rim.position.set(3, -2, 2)
  // Sweeps across the face once the mark has assembled, for a glint.
  const glint = new PointLight('#FFE3D3', 0, 0, 2)
  scene.add(key, rim, glint)

  const ink = new MeshStandardMaterial({ color: '#F1ECE2', roughness: 0.35, metalness: 0.15 })
  const coral = new MeshStandardMaterial({ color: '#E2835F', roughness: 0.26, metalness: 0.55 })
  // The bars are white on the light logo, where the arm behind them is dark. Here
  // the arm is cream, so the bars switch to brand sage to stay visible.
  const bar = new MeshStandardMaterial({ color: '#A9C4A3', roughness: 0.3, metalness: 0.35, emissive: new Color('#A9C4A3'), emissiveIntensity: 0.12 })

  const stage = new Group() // positioned to match the static SVG
  const logo = new Group() // animated as a whole
  stage.add(logo)
  scene.add(stage)

  const geometries: BufferGeometry[] = []
  const flyers: Flyer[] = []

  // Each geometry is re-centred on itself so pieces spin about their own middle
  // on the way in, then the mesh is placed back where the artwork has it.
  function addFlyer(points: Point[], material: MeshStandardMaterial, depth: number, z: number, options: Omit<Flyer, 'mesh' | 'rest'>) {
    const geometry = extrude(points, depth)
    geometry.computeBoundingBox()
    const centre = geometry.boundingBox!.getCenter(new Vector3())
    geometry.translate(-centre.x, -centre.y, -centre.z)
    geometries.push(geometry)
    const mesh = new Mesh(geometry, material)
    const rest = centre.clone().setZ(z)
    logo.add(mesh)
    flyers.push({ mesh, rest, ...options, from: rest.clone().add(options.from) })
  }

  addFlyer(ARM_TOP, ink, 0.16, 0, {
    from: new Vector3(-2.8, 2.4, 2.2),
    fromRotation: new Vector3(-1.1, 0.9, -0.7),
    fromScale: 0.4,
    delay: 0,
    duration: 0.9,
    ease: easeOutCubic,
  })
  addFlyer(ARM_BOTTOM, ink, 0.16, 0, {
    from: new Vector3(2.8, -2.4, 2.2),
    fromRotation: new Vector3(1, -0.9, 0.6),
    fromScale: 0.4,
    delay: 0.08,
    duration: 0.9,
    ease: easeOutCubic,
  })
  addFlyer(SLASH, coral, 0.22, 0.02, {
    from: new Vector3(0, -0.6, 3.4),
    fromRotation: new Vector3(0, 0, 1.3),
    fromScale: 0.3,
    delay: 0.14,
    duration: 0.95,
    ease: easeOutCubic,
  })
  // The arrowhead shoots up the slash like a trend line, overshooting a touch.
  const slashDirection = new Vector3(141.97 - 52.69, -(38.632 - 135.652), 0).normalize()
  addFlyer(ARROW, coral, 0.22, 0.02, {
    from: slashDirection.clone().multiplyScalar(-2.6),
    fromRotation: new Vector3(0, 0, 0),
    fromScale: 0.5,
    delay: 0.72,
    duration: 0.5,
    ease: t => easeOutBack(t, 2.2),
  })

  // Bars grow from their base like a chart filling in.
  const bars = BARS.map((points, index) => {
    const geometry = extrude(points, 0.2)
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const centre = box.getCenter(new Vector3())
    geometry.translate(-centre.x, -box.min.y, -centre.z)
    geometries.push(geometry)
    const mesh = new Mesh(geometry, bar)
    mesh.position.set(centre.x, box.min.y, 0.16)
    mesh.scale.y = 0.001
    logo.add(mesh)
    return { mesh, delay: 1.0 + index * 0.09 }
  })

  // Drifting dust in brand colours.
  const dustGeometry = new BufferGeometry()
  const count = 150
  const positions: number[] = []
  const colors: number[] = []
  const palette = [new Color('#E2835F'), new Color('#A9BA9E'), new Color('#F1ECE2')]
  for (let index = 0; index < count; index++) {
    const radius = 2.2 + Math.random() * 3.6
    const angle = Math.random() * Math.PI * 2
    positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius * 1.4, -3 + Math.random() * 3.5)
    const color = palette[index % palette.length]
    colors.push(color.r, color.g, color.b)
  }
  dustGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  dustGeometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometries.push(dustGeometry)
  const dotMap = dotTexture()
  const dustMaterial = new PointsMaterial({
    size: 0.16,
    map: dotMap,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  const dust = new Points(dustGeometry, dustMaterial)
  stage.add(dust)

  function fit() {
    const width = host.clientWidth || window.innerWidth
    const height = host.clientHeight || window.innerHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    // Size the scene so the mark is the same pixel size as the static SVG.
    const markPx = Math.min(width * MARK_VW, MARK_MAX_PX)
    const worldPerPx = (VIEWBOX_WIDTH * UNIT) / markPx
    const visibleHeight = height * worldPerPx
    camera.position.set(0, 0, visibleHeight / 2 / Math.tan(MathUtils.degToRad(camera.fov / 2)))
    stage.position.y = (0.5 - MARK_TOP) * visibleHeight
    camera.updateProjectionMatrix()
  }
  fit()
  window.addEventListener('resize', fit)

  let frame = 0
  let started = -1
  let exitStarted = -1
  let introReported = false

  function render(now: number) {
    frame = requestAnimationFrame(render)
    if (started < 0) started = now
    const time = (now - started) / 1000

    for (const flyer of flyers) {
      const raw = progress(time, flyer.delay, flyer.duration)
      const eased = flyer.ease(raw)
      flyer.mesh.position.lerpVectors(flyer.from, flyer.rest, eased)
      const settle = 1 - easeOutCubic(raw)
      flyer.mesh.rotation.set(flyer.fromRotation.x * settle, flyer.fromRotation.y * settle, flyer.fromRotation.z * settle)
      flyer.mesh.scale.setScalar(MathUtils.lerp(flyer.fromScale, 1, easeOutCubic(raw)))
      flyer.mesh.visible = time >= flyer.delay
    }
    for (const item of bars) {
      item.mesh.scale.y = Math.max(0.001, easeOutBack(progress(time, item.delay, 0.5), 2))
    }

    // Start turned away, swing round to face the camera, then sway gently.
    const turn = easeOutCubic(progress(time, 0, 1.4))
    const sway = MathUtils.clamp((time - 1.3) / 0.8, 0, 1)
    logo.rotation.y = -0.65 * (1 - turn) + Math.sin(time * 1.1) * 0.2 * sway
    logo.rotation.x = Math.sin(time * 0.8) * 0.06 * sway

    const sweep = progress(time, 1.05, 0.9)
    glint.position.set(MathUtils.lerp(-3.2, 3.2, sweep), 0.6, 1.4)
    glint.intensity = Math.sin(sweep * Math.PI) * 9

    dust.rotation.z = time * 0.05
    dust.rotation.y = Math.sin(time * 0.3) * 0.15
    dustMaterial.opacity = 0.7 * easeOutCubic(progress(time, 0.1, 1.2))

    if (exitStarted >= 0) {
      const out = easeOutCubic(MathUtils.clamp((now - exitStarted) / 1000 / EXIT_SECONDS, 0, 1))
      logo.scale.setScalar(1 + out * 0.22)
      logo.position.z = out * 1.4
      dust.scale.setScalar(1 + out * 0.8)
      dustMaterial.opacity *= 1 - out
    }

    renderer.render(scene, camera)

    if (!introReported && time >= INTRO_SECONDS) {
      introReported = true
      onIntroDone()
    }
  }
  frame = requestAnimationFrame(render)

  return {
    exit() {
      if (exitStarted < 0) exitStarted = performance.now()
    },
    dispose() {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', fit)
      geometries.forEach(geometry => geometry.dispose())
      ;[ink, coral, bar, dustMaterial].forEach(material => material.dispose())
      dotMap.dispose()
      environment.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
