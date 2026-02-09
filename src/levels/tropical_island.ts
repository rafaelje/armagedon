const levelData = {
  // Metadata
  name: "Isla del Huevo Errante",
  theme: "tropical",
  waterLevel: 580, // posición Y del agua (parte inferior del canvas)

  // Dimensiones del mundo
  worldBounds: { width: 2400, height: 600 },

  // Plataforma Izquierda
  platformLeft: {
    // Array de polígonos que definen el terreno sólido (coordenadas x, y)
    terrain: [
      { x: 0, y: 600 },
      { x: 0, y: 420 },
      { x: 50, y: 400 },
      { x: 120, y: 350 },
      { x: 200, y: 360 },
      { x: 280, y: 310 },
      { x: 350, y: 330 },
      { x: 450, y: 260 },
      { x: 550, y: 280 },
      { x: 650, y: 340 },
      { x: 750, y: 370 },
      { x: 850, y: 410 },
      { x: 900, y: 450 },
      { x: 900, y: 600 }
    ],
    // Zonas de escondite dentro de esta plataforma
    hideouts: [
      {
        type: "cave", // "cave" | "overhang" | "trench"
        bounds: { x: 100, y: 360, width: 70, height: 40 },
        sealed: false // true = requiere destruir terreno para acceder
      },
      {
        type: "overhang",
        bounds: { x: 420, y: 270, width: 100, height: 35 },
        sealed: false
      },
      {
        type: "trench",
        bounds: { x: 280, y: 310, width: 60, height: 25 },
        sealed: false
      },
      {
        type: "cave",
        bounds: { x: 600, y: 350, width: 80, height: 50 },
        sealed: true
      }
    ],
    // Posiciones de spawn sugeridas para el equipo 1
    spawnPoints: [
      { x: 150, y: 340 },
      { x: 450, y: 250 },
      { x: 750, y: 360 }
    ]
  },

  // Plataforma Derecha
  platformRight: {
    terrain: [
      { x: 1500, y: 600 },
      { x: 1500, y: 440 },
      { x: 1600, y: 390 },
      { x: 1700, y: 350 },
      { x: 1800, y: 280 },
      { x: 1950, y: 250 },
      { x: 2100, y: 290 },
      { x: 2250, y: 360 },
      { x: 2350, y: 390 },
      { x: 2400, y: 410 },
      { x: 2400, y: 600 }
    ],
    hideouts: [
      {
        type: "cave",
        bounds: { x: 2150, y: 350, width: 70, height: 45 },
        sealed: false
      },
      {
        type: "overhang",
        bounds: { x: 1800, y: 280, width: 110, height: 40 },
        sealed: false
      },
      {
        type: "trench",
        bounds: { x: 1950, y: 255, width: 65, height: 30 },
        sealed: false
      },
      {
        type: "cave",
        bounds: { x: 1650, y: 380, width: 75, height: 50 },
        sealed: true
      }
    ],
    // Posiciones de spawn para el equipo 2
    spawnPoints: [
      { x: 1550, y: 400 },
      { x: 1950, y: 240 },
      { x: 2250, y: 350 }
    ]
  },

  // Espacio entre plataformas (gap)
  gap: {
    startX: 900,  // donde termina la plataforma izquierda
    endX: 1500,   // donde empieza la plataforma derecha
    // Elementos opcionales dentro del gap
    floatingDebris: [
      { x: 1100, y: 480, width: 50, height: 30 },
      { x: 1300, y: 460, width: 40, height: 40 }
    ]
  },

  // Decoraciones (no colisionables)
  decorations: [
    { type: "palm_tree", x: 120, y: 350 },
    { type: "palm_tree", x: 450, y: 260 },
    { type: "rock", x: 750, y: 370 },
    { type: "palm_tree", x: 1800, y: 280 },
    { type: "palm_tree", x: 2100, y: 290 },
    { type: "shell", x: 1550, y: 440 }
  ],

  // Color/gradiente del fondo según el tema
  background: {
    skyColor: "#87CEEB",
    waterColor: "#1a6b8a",
    waterSurfaceColor: "#2d9bc4"
  }
};

export default levelData;
