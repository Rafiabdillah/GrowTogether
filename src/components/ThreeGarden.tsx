import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sparkles, Eye, RotateCcw, ChevronDown, ChevronUp, TreeDeciduous, Orbit, Home, Palmtree } from 'lucide-react';
import { IslandDecorationId, TimeOfDay, WeatherType } from '../types';
import { openPartIds, openParts, TREE_PARTS, type TreePartId } from '../lib/treeCraft';

interface ThreeGardenProps {
  streakCount: number;
  completedTodayCount: number;
  partnerCompletedTodayCount: number;
  /** Misi tuntas seumur ruangan; tiap ambang menambah satu bagian pada pohon. */
  missionsDone?: number;
  unlockedDecorations?: IslandDecorationId[];
  timeOfDay?: TimeOfDay;
  weather?: WeatherType;
}

export type SceneTheme = 'island' | 'bonsai' | 'galaxy' | 'desk';

export const ThreeGarden: React.FC<ThreeGardenProps> = ({
  streakCount,
  completedTodayCount,
  partnerCompletedTodayCount,
  missionsDone = 0,
  unlockedDecorations = [],
  timeOfDay = 'auto',
  weather = 'clear',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [currentTheme, setCurrentTheme] = useState<SceneTheme>('island');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRotating, setIsRotating] = useState(true);
  // Bagian pohon yang sudah terbuka, dipakai tulisan di atas kanvas: kanvasnya
  // sendiri tidak bisa dibaca peramban atau pembaca layar.
  const craftOpen = openParts(missionsDone);

  // References to keep mutable objects across re-renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const activeGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect software WebGL
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    // 2. Initialize Three.js Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Scene and Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 3.2, 5.5);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // prevent going below floor
    controls.minDistance = 2.5;
    controls.maxDistance = 10;
    controls.target.set(0, 1.2, 0);

    // 5. Studio Environment Lighting
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Studio 3-point light rig
    const keyLight = new THREE.DirectionalLight(0xfff1e0, 2.2);
    keyLight.position.set(4, 7, 5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 15;
    const d = 3.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x3d4a58, 0.9);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0xa5c4d4, 1.2);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    // Ground contact shadow receiver plane
    const shadowGeo = new THREE.PlaneGeometry(8, 8);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.18 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.001;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Subtle decorative pedestal disc
    const pedestalGeo = new THREE.CylinderGeometry(2.4, 2.6, 0.12, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0xf5f3ee,
      roughness: 0.6,
      metalness: 0.05,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.06;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    // 6. Build the active subject group
    const contentGroup = new THREE.Group();
    scene.add(contentGroup);
    activeGroupRef.current = contentGroup;

    buildThemeScene(contentGroup, currentTheme, streakCount, completedTodayCount, partnerCompletedTodayCount, unlockedDecorations);

    // Resize observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 7. Render Loop with dampening and rotation
    let animationFrameId: number;
    let lastFrameTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const delta = Math.min((now - lastFrameTime) / 1000, 0.1);
      lastFrameTime = now;
      controls.update();

      if (isRotating && activeGroupRef.current) {
        activeGroupRef.current.rotation.y += delta * 0.15;
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update scene when theme, streak, or completion changes
  useEffect(() => {
    if (activeGroupRef.current) {
      // Clear previous children
      while (activeGroupRef.current.children.length > 0) {
        const obj = activeGroupRef.current.children[0];
        activeGroupRef.current.remove(obj);
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      }
      buildThemeScene(activeGroupRef.current, currentTheme, streakCount, completedTodayCount, partnerCompletedTodayCount, unlockedDecorations, missionsDone);
    }
  }, [currentTheme, streakCount, completedTodayCount, partnerCompletedTodayCount, unlockedDecorations, missionsDone]);

  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      controlsRef.current.target.set(0, 1.2, 0);
    }
  };

  return (
    <div className="relative w-full h-[400px] md:h-[480px] rounded-3xl overflow-hidden bg-gradient-to-b from-stone-50 via-stone-100 to-amber-50/30 dark:from-stone-900 dark:via-stone-900/90 dark:to-stone-950 border border-stone-200/80 dark:border-stone-800">
      {/* Three.js canvas mount */}
      <div
        ref={mountRef}
        role="img"
        aria-label={`Taman pertumbuhan kalian: streak ${streakCount} hari, ${
          completedTodayCount + partnerCompletedTodayCount
        } kebiasaan tuntas hari ini, pohon punya ${craftOpen.length} dari ${
          TREE_PARTS.length
        } pelengkap setelah ${missionsDone} misi tuntas`}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Top Left Status Badge */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/85 dark:bg-stone-800/85 border border-stone-200/60 dark:border-stone-700/60 text-xs font-medium text-stone-700 dark:text-stone-200 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Taman Pertumbuhan Pasangan</span>
          <span className="text-stone-400">·</span>
          <span className="text-amber-600 dark:text-amber-400 font-semibold">{streakCount} Hari Streak</span>
        </div>
        <p className="text-[11px] text-stone-500 dark:text-stone-400 px-2">
          {completedTodayCount + partnerCompletedTodayCount} habit tuntas hari ini
        </p>
        <p
          data-craft={`${missionsDone} misi tuntas · ${craftOpen.length}/${TREE_PARTS.length} pelengkap`}
          className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 px-2"
        >
          {craftOpen.length}/{TREE_PARTS.length} pelengkap pohon · {missionsDone} misi tuntas
        </p>
      </div>

      {/* Top Right Quick Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
        <button type="button"
          onClick={resetCamera}
          aria-label="Reset sudut kamera taman"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-white/80 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white shadow-xs transition-colors"
          title="Reset Sudut Kamera"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
        </button>
        <button type="button"
          onClick={() => setIsRotating((prev) => !prev)}
          aria-pressed={isRotating}
          className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-medium border shadow-xs transition-colors ${
            isRotating
              ? 'bg-amber-500/10 border-amber-300 dark:border-amber-600 text-amber-800 dark:text-amber-200'
              : 'bg-white/80 dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
          }`}
        >
          {isRotating ? 'Auto Putar' : 'Jeda Putar'}
        </button>
      </div>

      {/* Collapsible Bottom Control Dock (Following Three.js & Mobile ergonomics) */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[92%] max-w-md transition-all duration-300 ${
          isCollapsed ? 'translate-y-12 opacity-80' : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="flex flex-col items-center">
          {/* Collapse/Expand Toggle Tab */}
          <button type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="flex items-center gap-1 min-h-[44px] px-3 py-1 rounded-t-lg bg-stone-900/90 dark:bg-stone-100/90 text-white dark:text-stone-900 text-[11px] font-medium shadow-sm transition-transform hover:scale-105"
          >
            {isCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span>{isCollapsed ? 'Pilihan Tema 3D' : 'Sembunyikan'}</span>
          </button>

          {/* Unified Bottom Control Bar */}
          {!isCollapsed && (
            <div className="w-full p-2 rounded-2xl bg-white/95 dark:bg-stone-900/95 border border-stone-200 dark:border-stone-800 shadow-xl flex items-center justify-between gap-1">
              <button type="button"
                onClick={() => setCurrentTheme('island')}
                className={`flex-1 flex items-center justify-center gap-1 min-h-[44px] py-2 px-2 rounded-xl text-xs font-medium transition-all ${
                  currentTheme === 'island'
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <Palmtree className="w-3.5 h-3.5" />
                <span>Pulau Kita</span>
              </button>

              <button type="button"
                onClick={() => setCurrentTheme('bonsai')}
                className={`flex-1 flex items-center justify-center gap-1 min-h-[44px] py-2 px-2 rounded-xl text-xs font-medium transition-all ${
                  currentTheme === 'bonsai'
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <TreeDeciduous className="w-3.5 h-3.5" />
                <span>Pohon Cinta</span>
              </button>

              <button type="button"
                onClick={() => setCurrentTheme('galaxy')}
                className={`flex-1 flex items-center justify-center gap-1 min-h-[44px] py-2 px-2 rounded-xl text-xs font-medium transition-all ${
                  currentTheme === 'galaxy'
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <Orbit className="w-3.5 h-3.5" />
                <span>Galaksi</span>
              </button>

              <button type="button"
                onClick={() => setCurrentTheme('desk')}
                className={`flex-1 flex items-center justify-center gap-1 min-h-[44px] py-2 px-2 rounded-xl text-xs font-medium transition-all ${
                  currentTheme === 'desk'
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Meja Belajar</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Procedural 3-12 Part Models Construction
function buildThemeScene(
  group: THREE.Group,
  theme: SceneTheme,
  streak: number,
  completedA: number,
  completedB: number,
  unlockedDecorations: IslandDecorationId[] = [],
  missions = 0
) {
  if (theme === 'island') {
    buildIslandScene(group, streak, completedA, completedB, unlockedDecorations, missions);
  } else if (theme === 'bonsai') {
    buildBonsaiTree(group, streak, completedA, completedB, missions);
  } else if (theme === 'galaxy') {
    buildGalaxyScene(group, streak, completedA, completedB);
  } else {
    buildCoupleDesk(group, streak, completedA, completedB);
  }
}

// 1. Procedural Bonsai Tree of Growth
function buildBonsaiTree(group: THREE.Group, streak: number, completedA: number, completedB: number, missions = 0) {
  // Pot (Primary Silhouette)
  const potGeo = new THREE.CylinderGeometry(0.85, 0.65, 0.6, 32);
  const potMat = new THREE.MeshStandardMaterial({
    color: 0x3d3632,
    roughness: 0.7,
    metalness: 0.1,
  });
  const pot = new THREE.Mesh(potGeo, potMat);
  pot.position.y = 0.3;
  pot.castShadow = true;
  pot.receiveShadow = true;
  group.add(pot);

  // Pot Rim Bevel
  const rimGeo = new THREE.TorusGeometry(0.86, 0.05, 16, 32);
  const rim = new THREE.Mesh(rimGeo, potMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.59;
  group.add(rim);

  // Soil
  const soilGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.08, 24);
  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x241e1a,
    roughness: 0.95,
  });
  const soil = new THREE.Mesh(soilGeo, soilMat);
  soil.position.y = 0.58;
  group.add(soil);

  // Main Trunk (Twisted procedural wood)
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.58, 0),
    new THREE.Vector3(0.1, 1.0, 0.05),
    new THREE.Vector3(-0.15, 1.45, -0.05),
    new THREE.Vector3(0.05, 1.85, 0.08),
  ]);
  const trunkGeo = new THREE.TubeGeometry(trunkCurve, 20, 0.14, 10, false);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x5a4435,
    roughness: 0.85,
    metalness: 0.05,
  });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.castShadow = true;
  group.add(trunk);

  // Branch Left (Rama Coral)
  const branch1Curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.05, 1.3, 0),
    new THREE.Vector3(-0.4, 1.55, 0.2),
    new THREE.Vector3(-0.7, 1.7, 0.3),
  ]);
  const branch1 = new THREE.Mesh(new THREE.TubeGeometry(branch1Curve, 12, 0.07, 8, false), trunkMat);
  branch1.castShadow = true;
  group.add(branch1);

  // Branch Right (Shinta Sage)
  const branch2Curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, 1.4, 0.02),
    new THREE.Vector3(0.45, 1.6, -0.2),
    new THREE.Vector3(0.75, 1.75, -0.25),
  ]);
  const branch2 = new THREE.Mesh(new THREE.TubeGeometry(branch2Curve, 12, 0.07, 8, false), trunkMat);
  branch2.castShadow = true;
  group.add(branch2);

  // Foliage Canopies (Varying in fullness based on streak)
  const foliageScale = Math.min(1.4, 0.85 + (streak * 0.04));
  const foliageMatSage = new THREE.MeshStandardMaterial({
    color: 0x4a826b,
    roughness: 0.6,
    flatShading: true,
  });
  const foliageMatCoral = new THREE.MeshStandardMaterial({
    color: 0xe06d53,
    roughness: 0.6,
    flatShading: true,
  });
  const foliageMatGreen = new THREE.MeshStandardMaterial({
    color: 0x3d7055,
    roughness: 0.65,
    flatShading: true,
  });

  // Top main crown
  const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 * foliageScale, 1), foliageMatGreen);
  crown.position.set(0.05, 2.05, 0.08);
  crown.castShadow = true;
  group.add(crown);

  // Left foliage cluster (Partner A - Coral Accent)
  const clumpLeft = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 * foliageScale, 1), foliageMatCoral);
  clumpLeft.position.set(-0.7, 1.75, 0.3);
  clumpLeft.castShadow = true;
  group.add(clumpLeft);

  // Right foliage cluster (Partner B - Sage Accent)
  const clumpRight = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 * foliageScale, 1), foliageMatSage);
  clumpRight.position.set(0.75, 1.8, -0.25);
  clumpRight.castShadow = true;
  group.add(clumpRight);

  // Blossoming Flowers based on today's habit completions
  const flowerCount = Math.max(1, completedA + completedB);
  const flowerMat = new THREE.MeshStandardMaterial({
    color: 0xffd166,
    roughness: 0.3,
    metalness: 0.2,
    emissive: 0xffb703,
    emissiveIntensity: 0.25,
  });

  for (let i = 0; i < flowerCount; i++) {
    const angle = (i / flowerCount) * Math.PI * 2;
    const flower = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), flowerMat);
    const radius = 0.65;
    flower.position.set(
      Math.cos(angle) * radius * 0.9,
      1.9 + Math.sin(i * 1.5) * 0.25,
      Math.sin(angle) * radius * 0.9
    );
    group.add(flower);
  }

  addCraftParts(group, openPartIds(missions), {
    groundY: 0.62,
    baseY: 0.58,
    groundR: 0.5,
    canopyX: 0.05,
    canopyY: 2.05,
    canopyZ: 0.08,
    canopyR: 0.6,
  });
}

// 2. Procedural Galaxy of Shared Moments
function buildGalaxyScene(group: THREE.Group, streak: number, completedA: number, completedB: number) {
  // Central Glowing Star of Shared Love
  const starGeo = new THREE.SphereGeometry(0.45, 32, 32);
  const starMat = new THREE.MeshStandardMaterial({
    color: 0xffe8aa,
    emissive: 0xffc43d,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.1,
  });
  const centralStar = new THREE.Mesh(starGeo, starMat);
  centralStar.position.y = 1.3;
  group.add(centralStar);

  // Inner Orbital Ring
  const ring1Geo = new THREE.TorusGeometry(1.2, 0.02, 16, 64);
  const ring1Mat = new THREE.MeshStandardMaterial({
    color: 0xff8a65,
    roughness: 0.4,
    metalness: 0.7,
  });
  const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
  ring1.position.y = 1.3;
  ring1.rotation.x = Math.PI / 3;
  group.add(ring1);

  // Outer Orbital Ring
  const ring2Geo = new THREE.TorusGeometry(1.7, 0.02, 16, 64);
  const ring2Mat = new THREE.MeshStandardMaterial({
    color: 0x5db093,
    roughness: 0.4,
    metalness: 0.7,
  });
  const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
  ring2.position.y = 1.3;
  ring2.rotation.x = -Math.PI / 4;
  ring2.rotation.y = Math.PI / 6;
  group.add(ring2);

  // Partner Planet 1 (Rama)
  const planet1 = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0xe06d53, roughness: 0.3, metalness: 0.2 })
  );
  planet1.position.set(Math.cos(0.8) * 1.2, 1.3 + Math.sin(0.8) * 0.5, Math.sin(0.8) * 1.2);
  group.add(planet1);

  // Partner Planet 2 (Shinta)
  const planet2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x4a826b, roughness: 0.3, metalness: 0.2 })
  );
  planet2.position.set(Math.cos(3.6) * 1.7, 1.3 + Math.sin(3.6) * 0.4, Math.sin(3.6) * 1.7);
  group.add(planet2);

  // Constellation Stars based on Streaks
  const starPoints = Math.min(30, 8 + streak);
  const starParticleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffd166,
    emissiveIntensity: 0.5,
  });
  for (let i = 0; i < starPoints; i++) {
    const star = new THREE.Mesh(new THREE.TetrahedronGeometry(0.04, 0), starParticleMat);
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * Math.PI * 0.8;
    const r = 2.0 + Math.random() * 0.8;
    star.position.set(
      r * Math.cos(phi) * Math.sin(theta),
      1.3 + r * Math.sin(phi),
      r * Math.cos(phi) * Math.cos(theta)
    );
    group.add(star);
  }
}

// 3. Procedural Cozy Couple Desk
function buildCoupleDesk(group: THREE.Group, streak: number, completedA: number, completedB: number) {
  // Wooden Desktop Table
  const tableGeo = new THREE.BoxGeometry(2.4, 0.1, 1.4);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x8a6a52,
    roughness: 0.7,
    metalness: 0.05,
  });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.y = 1.0;
  table.castShadow = true;
  table.receiveShadow = true;
  group.add(table);

  // 4 Table Legs
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 16);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.8 });
  const legPositions = [
    [-1.05, 0.5, -0.55],
    [1.05, 0.5, -0.55],
    [-1.05, 0.5, 0.55],
    [1.05, 0.5, 0.55],
  ];
  legPositions.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    group.add(leg);
  });

  // Partner A Book (Coral cover)
  const book1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.06, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xe06d53, roughness: 0.8 })
  );
  book1.position.set(-0.55, 1.08, 0.1);
  book1.rotation.y = 0.15;
  book1.castShadow = true;
  group.add(book1);

  // Partner B Laptop/Book (Sage cover)
  const book2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.06, 0.58),
    new THREE.MeshStandardMaterial({ color: 0x4a826b, roughness: 0.8 })
  );
  book2.position.set(0.55, 1.08, 0.05);
  book2.rotation.y = -0.12;
  book2.castShadow = true;
  group.add(book2);

  // Two Couple Mugs (side by side in center)
  const mugGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.18, 16);
  const mug1 = new THREE.Mesh(mugGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
  mug1.position.set(-0.08, 1.14, -0.2);
  mug1.castShadow = true;
  group.add(mug1);

  const mug2 = new THREE.Mesh(mugGeo, new THREE.MeshStandardMaterial({ color: 0xf5eedb, roughness: 0.3 }));
  mug2.position.set(0.12, 1.14, -0.22);
  mug2.castShadow = true;
  group.add(mug2);

  // Cozy Desk Lamp (Warm light)
  const lampBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.18, 0.04, 20),
    new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.4, metalness: 0.8 })
  );
  lampBase.position.set(-0.85, 1.07, -0.45);
  group.add(lampBase);

  const lampPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.65, 12),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.9 })
  );
  lampPole.position.set(-0.85, 1.38, -0.45);
  group.add(lampPole);

  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.22, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xfffaed, roughness: 0.4, side: THREE.DoubleSide })
  );
  lampShade.position.set(-0.85, 1.68, -0.45);
  lampShade.rotation.x = Math.PI;
  group.add(lampShade);
}

// 4. Procedural Signature Scene: Pulau Melayang "Taman Kita"
function buildIslandScene(
  group: THREE.Group,
  streak: number,
  completedA: number,
  completedB: number,
  unlockedDecorations: IslandDecorationId[] = [],
  missions = 0
) {
  // A. Floating Island Base
  // 1. Rocky Crags Cone (pointing down)
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x362f2d,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true,
  });
  const rockGeo = new THREE.ConeGeometry(2.0, 1.3, 18, 1, false, 0, Math.PI * 2);
  const rockBase = new THREE.Mesh(rockGeo, rockMat);
  rockBase.rotation.x = Math.PI;
  rockBase.position.y = 0.55;
  rockBase.castShadow = true;
  group.add(rockBase);

  // 2. Grassy Top Disk
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x487a5f,
    roughness: 0.65,
    metalness: 0.05,
    flatShading: true,
  });
  const grassGeo = new THREE.CylinderGeometry(2.05, 1.95, 0.22, 32);
  const grassTop = new THREE.Mesh(grassGeo, grassMat);
  grassTop.position.y = 0.66;
  grassTop.receiveShadow = true;
  group.add(grassTop);

  // 3. Floating Micro-rocks
  const microRockGeo = new THREE.DodecahedronGeometry(0.18, 0);
  const microRock1 = new THREE.Mesh(microRockGeo, rockMat);
  microRock1.position.set(-2.2, 0.3, 0.8);
  group.add(microRock1);

  const microRock2 = new THREE.Mesh(microRockGeo, rockMat);
  microRock2.position.set(2.1, 0.4, -0.9);
  group.add(microRock2);

  // B. Growth Tree in Center
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x5a4332,
    roughness: 0.85,
    metalness: 0.05,
  });

  // Jangkar tajuk pohon. Elemen pelengkap dari misi yang tuntas menempel di sini,
  // tiap tahap mengisi nilainya sendiri supaya akar, bunga, dan burung selalu
  // mengikuti ukuran pohon yang sedang tampil.
  const canopy = { x: 0, y: 1.28, z: 0, r: 0.3 };

  if (streak < 4) {
    // Stage 1: Sprout (Bibit Tunas)
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.77, 0),
      new THREE.Vector3(0.04, 1.05, 0.02),
      new THREE.Vector3(-0.02, 1.25, 0),
    ]);
    const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 10, 0.04, 8, false), woodMat);
    group.add(stem);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x68b984, roughness: 0.4 });
    const leafGeo = new THREE.SphereGeometry(0.12, 12, 8);
    leafGeo.scale(1.5, 0.4, 0.8);

    const leaf1 = new THREE.Mesh(leafGeo, leafMat);
    leaf1.position.set(-0.1, 1.28, 0.04);
    leaf1.rotation.z = 0.4;
    group.add(leaf1);

    const leaf2 = new THREE.Mesh(leafGeo, leafMat);
    leaf2.position.set(0.1, 1.26, -0.04);
    leaf2.rotation.z = -0.4;
    group.add(leaf2);
  } else if (streak < 9) {
    // Stage 2: Young Tree (Tunas Muda)
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.77, 0),
      new THREE.Vector3(0.08, 1.2, 0.04),
      new THREE.Vector3(-0.06, 1.6, -0.02),
    ]);
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 14, 0.09, 8, false), woodMat);
    trunk.castShadow = true;
    group.add(trunk);

    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x3d7055, roughness: 0.6, flatShading: true });
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), foliageMat);
    crown.position.set(-0.05, 1.85, 0);
    crown.castShadow = true;
    group.add(crown);
    canopy.x = -0.05;
    canopy.y = 1.85;
    canopy.r = 0.55;
  } else if (streak < 19) {
    // Stage 3: Lush Tree (Pohon Rimbun)
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.77, 0),
      new THREE.Vector3(0.12, 1.3, 0.08),
      new THREE.Vector3(-0.15, 1.7, -0.04),
      new THREE.Vector3(0.05, 2.1, 0.02),
    ]);
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 18, 0.15, 10, false), woodMat);
    trunk.castShadow = true;
    group.add(trunk);

    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x386641, roughness: 0.6, flatShading: true });
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 1), foliageMat);
    crown.position.set(0.05, 2.3, 0.02);
    crown.castShadow = true;
    group.add(crown);
    canopy.x = 0.05;
    canopy.y = 2.3;
    canopy.z = 0.02;
    canopy.r = 0.72;

    const foliageLeft = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 1), foliageMat);
    foliageLeft.position.set(-0.55, 1.95, 0.3);
    foliageLeft.castShadow = true;
    group.add(foliageLeft);

    const foliageRight = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 1), foliageMat);
    foliageRight.position.set(0.55, 2.05, -0.25);
    foliageRight.castShadow = true;
    group.add(foliageRight);
  } else {
    // Stage 4: Sacred Sakura Blossom Tree (Pohon Pusaka Sakura Berbunga)
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.77, 0),
      new THREE.Vector3(0.18, 1.3, 0.1),
      new THREE.Vector3(-0.2, 1.8, -0.08),
      new THREE.Vector3(0.1, 2.2, 0.05),
    ]);
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 20, 0.18, 10, false), woodMat);
    trunk.castShadow = true;
    group.add(trunk);

    const sakuraMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0xfb7185,
      emissiveIntensity: 0.25,
      roughness: 0.5,
      flatShading: true,
    });
    const sakuraGold = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.4,
      roughness: 0.4,
      flatShading: true,
    });

    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 1), sakuraMat);
    crown.position.set(0.1, 2.45, 0.05);
    crown.castShadow = true;
    group.add(crown);
    canopy.x = 0.1;
    canopy.y = 2.45;
    canopy.z = 0.05;
    canopy.r = 0.85;

    const crownL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 1), sakuraMat);
    crownL.position.set(-0.7, 2.1, 0.35);
    crownL.castShadow = true;
    group.add(crownL);

    const crownR = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 1), sakuraGold);
    crownR.position.set(0.7, 2.15, -0.3);
    crownR.castShadow = true;
    group.add(crownR);
  }

  // B2. Pelengkap pohon: satu bagian baru tiap ambang misi yang tuntas.
  addCraftParts(group, openPartIds(missions), {
    groundY: 0.77,
    baseY: 0.77,
    groundR: 1.35,
    canopyX: canopy.x,
    canopyY: canopy.y,
    canopyZ: canopy.z,
    canopyR: canopy.r,
  });

  // C. Two Interactive Couple Lanterns
  // 1. Partner A (Rama) Lantern - Left side (-1.3, 0.77, 0.3)
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });
  const lanternPostA = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.45, 12), stoneMat);
  lanternPostA.position.set(-1.3, 0.99, 0.3);
  group.add(lanternPostA);

  const isRamaLit = completedA > 0;
  const lanternMatA = new THREE.MeshStandardMaterial({
    color: isRamaLit ? 0xff7a64 : 0x777777,
    emissive: isRamaLit ? 0xff5733 : 0x000000,
    emissiveIntensity: isRamaLit ? 1.4 : 0,
    roughness: 0.3,
  });
  const lanternHeadA = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.2), lanternMatA);
  lanternHeadA.position.set(-1.3, 1.25, 0.3);
  group.add(lanternHeadA);

  if (isRamaLit) {
    const lightA = new THREE.PointLight(0xff7a64, 1.5, 3.5);
    lightA.position.set(-1.3, 1.3, 0.3);
    group.add(lightA);
  }

  // 2. Partner B (Shinta) Lantern - Right side (1.3, 0.77, 0.3)
  const lanternPostB = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.45, 12), stoneMat);
  lanternPostB.position.set(1.3, 0.99, 0.3);
  group.add(lanternPostB);

  const isShintaLit = completedB > 0;
  const lanternMatB = new THREE.MeshStandardMaterial({
    color: isShintaLit ? 0x2dd4bf : 0x777777,
    emissive: isShintaLit ? 0x14b8a6 : 0x000000,
    emissiveIntensity: isShintaLit ? 1.4 : 0,
    roughness: 0.3,
  });
  const lanternHeadB = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.2), lanternMatB);
  lanternHeadB.position.set(1.3, 1.25, 0.3);
  group.add(lanternHeadB);

  if (isShintaLit) {
    const lightB = new THREE.PointLight(0x2dd4bf, 1.5, 3.5);
    lightB.position.set(1.3, 1.3, 0.3);
    group.add(lightB);
  }

  // 3. High-Five Moment: Both completed today!
  if (isRamaLit && isShintaLit) {
    // Arch of golden light connecting both lanterns
    const archCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-1.3, 1.25, 0.3),
      new THREE.Vector3(0, 2.2, 0.5),
      new THREE.Vector3(1.3, 1.25, 0.3)
    );
    const archMat = new THREE.MeshBasicMaterial({ color: 0xffd166, wireframe: false });
    const arch = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 20, 0.02, 6, false), archMat);
    group.add(arch);

    // Sparkling fireflies
    for (let f = 0; f < 8; f++) {
      const flyMat = new THREE.MeshBasicMaterial({ color: 0xffe600 });
      const fly = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), flyMat);
      const angle = (f / 8) * Math.PI * 2;
      fly.position.set(Math.cos(angle) * 1.1, 1.4 + Math.sin(f * 2) * 0.4, Math.sin(angle) * 1.1);
      group.add(fly);
    }
  }

  // D. Unlocked Decorations
  // 1. Ayunan Kayu (Swing)
  if (unlockedDecorations.includes('swing')) {
    const swingWood = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.8 });
    const ropeMat = new THREE.MeshBasicMaterial({ color: 0xd4c29d });

    const rope1 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 6), ropeMat);
    rope1.position.set(-0.55, 1.55, 0.25);
    group.add(rope1);

    const rope2 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 6), ropeMat);
    rope2.position.set(-0.35, 1.55, 0.25);
    group.add(rope2);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.12), swingWood);
    seat.position.set(-0.45, 1.25, 0.25);
    group.add(seat);
  }

  // 2. Kolam Teratai Berbatu (Pond)
  if (unlockedDecorations.includes('pond')) {
    const pondRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.05, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x737373, roughness: 0.9 })
    );
    pondRing.rotation.x = Math.PI / 2;
    pondRing.position.set(0.85, 0.78, 0.75);
    group.add(pondRing);

    const water = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 16),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.5 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0.85, 0.785, 0.75);
    group.add(water);

    const lotus = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.05, 8),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 })
    );
    lotus.position.set(0.85, 0.82, 0.75);
    group.add(lotus);
  }

  // 3. Rumah Peri Mungil (Cottage)
  if (unlockedDecorations.includes('cottage')) {
    const houseBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.32, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xe5e5e5, roughness: 0.7 })
    );
    houseBody.position.set(-0.85, 0.93, -0.75);
    houseBody.castShadow = true;
    group.add(houseBody);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.25, 4),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 })
    );
    roof.position.set(-0.85, 1.2, -0.75);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
  }

  // 4. Lampion Bambu (Lanterns)
  if (unlockedDecorations.includes('lanterns')) {
    const bambooPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.8 })
    );
    bambooPost.position.set(0.2, 0.92, 1.3);
    group.add(bambooPost);

    const bambooLamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 0.9,
      })
    );
    bambooLamp.position.set(0.2, 1.08, 1.3);
    group.add(bambooLamp);
  }

  // 5. Kucing Oren (Cat)
  if (unlockedDecorations.includes('cat')) {
    const catMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.8 });
    const catBody = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), catMat);
    catBody.scale.set(1.4, 0.8, 1.0);
    catBody.position.set(0.45, 0.82, 0.35);
    catBody.castShadow = true;
    group.add(catBody);

    const catHead = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), catMat);
    catHead.position.set(0.56, 0.86, 0.35);
    group.add(catHead);
  }
}

interface CraftAnchor {
  groundY: number;
  baseY: number;
  // Jari-jari tanah tempat bagian berpijak — pot bonsai lebih sempit daripada pulau.
  groundR: number;
  canopyX: number;
  canopyY: number;
  canopyZ: number;
  canopyR: number;
}

/**
 * Elemen pelengkap pohon: tiap ambang misi yang tuntas menambah satu bagian.
 *
 * Semuanya diukur dari jangkar tajuk, jadi bibit setinggi dengkul dan sakura
 * pusaka menerima bagian yang sama di tempat yang wajar. Posisinya dihitung,
 * bukan acak — dua ponsel wajib melihat pohon yang persis sama.
 */
function addCraftParts(group: THREE.Group, open: TreePartId[], a: CraftAnchor) {
  const has = (id: TreePartId) => open.includes(id);
  const trunkY = (f: number) => a.baseY + (a.canopyY - a.baseY) * f;
  // Titik di kulit tajuk, tersebar merata lewat sudut emas.
  const shell = (i: number, n: number, scale = 1.03) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
    const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
    const r = a.canopyR * scale;
    return new THREE.Vector3(
      a.canopyX + r * Math.sin(phi) * Math.cos(theta),
      a.canopyY + r * Math.cos(phi),
      a.canopyZ + r * Math.sin(phi) * Math.sin(theta)
    );
  };
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });

  if (has('roots')) {
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + 0.5;
      const root = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), wood);
      root.scale.set(1.5, 0.35, 0.55);
      root.position.set(Math.cos(ang) * 0.26, a.groundY - 0.02, Math.sin(ang) * 0.26);
      root.rotation.y = -ang;
      group.add(root);
    }
  }

  if (has('moss')) {
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x5f8b63, roughness: 0.95, flatShading: true });
    for (const [f, dx, dz] of [[0.42, 0.09, 0.05], [0.55, -0.08, 0.04], [0.68, 0.03, -0.09]] as const) {
      const patch = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07, 0), mossMat);
      patch.scale.set(1.4, 0.5, 1);
      patch.position.set(dx, trunkY(f), dz);
      group.add(patch);
    }
  }

  if (has('sprigs')) {
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, trunkY(0.62), 0),
        new THREE.Vector3(side * 0.32, trunkY(0.74), 0.12),
        new THREE.Vector3(side * 0.6, trunkY(0.82), 0.2),
      ]);
      const branch = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.035, 6, false), wood);
      branch.castShadow = true;
      group.add(branch);
    }
  }

  if (has('leafTufts')) {
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0x6bb57e, roughness: 0.6, flatShading: true });
    for (const p of [
      new THREE.Vector3(-0.62, trunkY(0.84), 0.22),
      new THREE.Vector3(0.62, trunkY(0.86), -0.2),
      new THREE.Vector3(a.canopyX, a.canopyY + a.canopyR * 1.05, a.canopyZ),
    ]) {
      const tuft = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 1), tuftMat);
      tuft.position.copy(p);
      tuft.castShadow = true;
      group.add(tuft);
    }
  }

  if (has('blossoms')) {
    const bloomMat = new THREE.MeshStandardMaterial({
      color: 0xfff1d6,
      emissive: 0xf7c873,
      emissiveIntensity: 0.2,
      roughness: 0.45,
    });
    for (let i = 0; i < 12; i++) {
      const bloom = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), bloomMat);
      bloom.position.copy(shell(i, 12));
      group.add(bloom);
    }
  }

  if (has('fruits')) {
    const fruitMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x92400e,
      emissiveIntensity: 0.3,
      roughness: 0.4,
    });
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), fruitMat);
      fruit.position.set(
        a.canopyX + Math.cos(ang) * a.canopyR * 0.8,
        a.canopyY - a.canopyR * 0.72,
        a.canopyZ + Math.sin(ang) * a.canopyR * 0.8
      );
      group.add(fruit);
    }
  }

  if (has('nest')) {
    const nest = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.045, 8, 14), wood);
    nest.rotation.x = Math.PI / 2;
    nest.position.set(a.canopyX + a.canopyR * 0.72, a.canopyY - a.canopyR * 0.2, a.canopyZ + a.canopyR * 0.42);
    group.add(nest);
    const eggMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    for (let i = 0; i < 2; i++) {
      const egg = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eggMat);
      egg.position.set(nest.position.x + (i === 0 ? -0.045 : 0.045), nest.position.y + 0.05, nest.position.z);
      group.add(egg);
    }
  }

  if (has('vines')) {
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x3f7d58, roughness: 0.8 });
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + 0.9;
      const x = a.canopyX + Math.cos(ang) * a.canopyR * 0.88;
      const z = a.canopyZ + Math.sin(ang) * a.canopyR * 0.88;
      const topY = a.canopyY - a.canopyR * 0.3;
      const len = 0.45 + i * 0.14;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, topY, z),
        new THREE.Vector3(x + 0.08, topY - len * 0.6, z - 0.05),
        new THREE.Vector3(x - 0.04, topY - len, z + 0.06),
      ]);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.018, 6, false), vineMat));
    }
  }

  if (has('mushrooms')) {
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.7 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xe06d53, roughness: 0.6 });
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + 1.2;
      const dist = a.groundR * (0.85 + (i % 3) * 0.1);
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.1, 8), stemMat);
      stem.position.set(x, a.groundY + 0.04, z);
      group.add(stem);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.06, 10), capMat);
      cap.position.set(x, a.groundY + 0.12, z);
      group.add(cap);
    }
  }

  if (has('fireflies')) {
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const fly = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), glowMat);
      fly.position.set(
        a.canopyX + Math.cos(ang) * (a.canopyR + 0.45),
        a.canopyY + Math.sin(i * 1.7) * a.canopyR * 0.6,
        a.canopyZ + Math.sin(ang) * (a.canopyR + 0.45)
      );
      group.add(fly);
    }
    const glow = new THREE.PointLight(0xffe066, 0.6, 3);
    glow.position.set(a.canopyX, a.canopyY, a.canopyZ);
    group.add(glow);
  }

  if (has('birds')) {
    const perchY = a.canopyY + a.canopyR * 0.92;
    for (const b of [{ dx: -0.14, color: 0x60a5fa }, { dx: 0.16, color: 0xf59e0b }]) {
      const birdMat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.6 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), birdMat);
      body.scale.set(1.2, 0.9, 0.8);
      body.position.set(a.canopyX + b.dx, perchY, a.canopyZ);
      group.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), birdMat);
      head.position.set(a.canopyX + b.dx + (b.dx < 0 ? -0.06 : 0.06), perchY + 0.07, a.canopyZ);
      group.add(head);
      const beak = new THREE.Mesh(
        new THREE.ConeGeometry(0.018, 0.04, 6),
        new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.5 })
      );
      beak.rotation.z = b.dx < 0 ? Math.PI / 2 : -Math.PI / 2;
      beak.position.set(head.position.x + (b.dx < 0 ? -0.05 : 0.05), perchY + 0.07, a.canopyZ);
      group.add(beak);
    }
  }

  if (has('crown')) {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(a.canopyR * 0.78, 0.025, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.set(a.canopyX, a.canopyY + a.canopyR * 1.3, a.canopyZ);
    group.add(halo);
  }
}
