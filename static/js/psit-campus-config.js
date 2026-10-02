/**
 * PSIT CampusVision AI — Central PSIT Campus Configuration
 * Standardized Digital Twin Project Mapping for PSIT Kanpur
 *
 * Project Room-ID Convention:
 * - XX-1Y : Ground Floor (e.g. A-11, A-12, A-13, A-14, A-15)
 * - XX-2Y : First Floor (e.g. A-21, A-22, A-23, A-24, A-25)
 * - XX-3Y : Second Floor (e.g. A-31, A-32, A-33, A-34, A-35)
 */

window.PSIT_CAMPUS_CONFIG = {
  campus_name: "Pranveer Singh Institute of Technology (PSIT)",
  location: "Kanpur, Uttar Pradesh, India",
  convention_note: "PROJECT ROOM-ID CONVENTION: BLOCK-FLOOR+ROOM (XX-1Y: Ground, XX-2Y: First, XX-3Y: Second). Standardized representation for Digital Twin.",
  floors: [
    { index: 0, name: "Ground Floor", code: "G", prefix_digit: "1" },
    { index: 1, name: "First Floor", code: "1F", prefix_digit: "2" },
    { index: 2, name: "Second Floor", code: "2F", prefix_digit: "3" }
  ],
  landmarks: [
    {
      id: "PSIT_TOWER",
      name: "PSIT Tower",
      type: "landmark",
      category: "Central Tower & T&P Hub",
      pos: [0, 11, 28],
      size: [18, 22, 18],
      color: "#1e3a8a",
      desc: "Iconic multi-story central landmark housing Placement Cell, Innovation Hub & Central Library."
    },
    {
      id: "TOWN_HALL",
      name: "Administration / Town Hall",
      type: "admin",
      category: "Administrative Headquarters",
      pos: [-32, 5, 28],
      size: [22, 10, 14],
      color: "#1e293b",
      desc: "Dean Secretariat, Registrar Office, Surveillance Operations & Town Hall."
    },
    {
      id: "RANG_MANCH",
      name: "Rang Manch",
      type: "auditorium",
      category: "Open-Air Amphitheatre & Cultural Stage",
      pos: [32, 3, 28],
      size: [22, 6, 18],
      color: "#7c2d12",
      desc: "Open-air amphitheatre and cultural arena for major campus fests and conclaves."
    },
    {
      id: "CENTRAL_QUAD",
      name: "Central Campus Lawn & Assembly Quad",
      type: "quad",
      category: "Assembly & Egress Quad",
      pos: [0, 0.1, 2],
      size: [36, 0.2, 26],
      color: "#064e3b",
      desc: "Primary open-air muster point and designated emergency evacuation quad."
    }
  ],
  academic_blocks: [
    {
      id: "A",
      name: "Academic Block A",
      dept: "Computer Science & Engineering / ECE",
      pos: [-56, 4.5, 12],
      size: [22, 9, 12],
      color: "#0284c7",
      rooms_per_floor: 5,
      default_capacity: 60,
      primary_camera: "Camera-01",
      rooms: {
        0: ["A-11", "A-12", "A-13", "A-14", "A-15"],
        1: ["A-21", "A-22", "A-23", "A-24", "A-25"],
        2: ["A-31", "A-32", "A-33", "A-34", "A-35"]
      }
    },
    {
      id: "B",
      name: "Academic Block B",
      dept: "Information Technology / CSE",
      pos: [-86, 4.5, 12],
      size: [22, 9, 12],
      color: "#0369a1",
      rooms_per_floor: 4,
      default_capacity: 60,
      primary_camera: "Camera-04",
      rooms: {
        0: ["B-11", "B-12", "B-13", "B-14"],
        1: ["B-21", "B-22", "B-23", "B-24"],
        2: ["B-31", "B-32", "B-33", "B-34"]
      }
    },
    {
      id: "C",
      name: "Academic Block C",
      dept: "Applied Sciences & Humanities (1st Year)",
      pos: [-56, 4.5, -18],
      size: [22, 9, 12],
      color: "#0d9488",
      rooms_per_floor: 4,
      default_capacity: 60,
      primary_camera: "CAM-C11",
      rooms: {
        0: ["C-11", "C-12", "C-13", "C-14"],
        1: ["C-21", "C-22", "C-23", "C-24"],
        2: ["C-31", "C-32", "C-33", "C-34"]
      }
    },
    {
      id: "D",
      name: "Academic Block D",
      dept: "Mechanical & Civil Engineering",
      pos: [-86, 4.5, -18],
      size: [22, 9, 12],
      color: "#0f766e",
      rooms_per_floor: 4,
      default_capacity: 60,
      primary_camera: "CAM-D11",
      rooms: {
        0: ["D-11", "D-12", "D-13", "D-14"],
        1: ["D-21", "D-22", "D-23", "D-24"],
        2: ["D-31", "D-32", "D-33", "D-34"]
      }
    },
    {
      id: "E",
      name: "Academic Block E",
      dept: "Pharmacy & Bio-Technology",
      pos: [56, 4.5, 12],
      size: [22, 9, 12],
      color: "#16a34a",
      rooms_per_floor: 4,
      default_capacity: 60,
      primary_camera: "Camera-05",
      rooms: {
        0: ["E-11", "E-12", "E-13", "E-14"],
        1: ["E-21", "E-22", "E-23", "E-24"],
        2: ["E-31", "E-32", "E-33", "E-34"]
      }
    },
    {
      id: "F",
      name: "Academic Block F",
      dept: "Department of Management Studies (MBA)",
      pos: [86, 4.5, 12],
      size: [22, 9, 12],
      color: "#15803d",
      rooms_per_floor: 5,
      default_capacity: 60,
      primary_camera: "Camera-06",
      rooms: {
        0: ["F-11", "F-12", "F-13", "F-14", "F-15"],
        1: ["F-21", "F-22", "F-23", "F-24", "F-25"],
        2: ["F-31", "F-32", "F-33", "F-34", "F-35"]
      }
    },
    {
      id: "G",
      name: "Academic Block G",
      dept: "Computer Applications (BBA / BCA)",
      pos: [56, 4.5, -18],
      size: [22, 9, 12],
      color: "#65a30d",
      rooms_per_floor: 4,
      default_capacity: 60,
      primary_camera: "CAM-G11",
      rooms: {
        0: ["G-11", "G-12", "G-13", "G-14"],
        1: ["G-21", "G-22", "G-23", "G-24"],
        2: ["G-31", "G-32", "G-33", "G-34"]
      }
    },
    {
      id: "AA",
      name: "Academic Block AA",
      dept: "Higher Research & Seminar Complex",
      pos: [86, 4.5, -18],
      size: [22, 9, 12],
      color: "#4d7c0f",
      rooms_per_floor: 3,
      default_capacity: 75,
      primary_camera: "CAM-AA11",
      rooms: {
        0: ["AA-11", "AA-12", "AA-13"],
        1: ["AA-21", "AA-22", "AA-23"],
        2: ["AA-31", "AA-32", "AA-33"]
      }
    },
    {
      id: "J",
      name: "Academic Block J",
      dept: "Computer Applications & Software Labs",
      pos: [-60, 4.5, -48],
      size: [20, 9, 12],
      color: "#6366f1",
      rooms_per_floor: 4,
      default_capacity: 60,
      primary_camera: "CAM-J11",
      rooms: {
        0: ["J-11", "J-12", "J-13", "J-14"],
        1: ["J-21", "J-22", "J-23", "J-24"],
        2: ["J-31", "J-32", "J-33", "J-34"]
      }
    },
    {
      id: "K",
      name: "Academic Block K",
      dept: "Electronics & Embedded Systems",
      pos: [-30, 4.5, -48],
      size: [20, 9, 12],
      color: "#4f46e5",
      rooms_per_floor: 4,
      default_capacity: 60,
      primary_camera: "CAM-K11",
      rooms: {
        0: ["K-11", "K-12", "K-13", "K-14"],
        1: ["K-21", "K-22", "K-23", "K-24"],
        2: ["K-31", "K-32", "K-33", "K-34"]
      }
    },
    {
      id: "L",
      name: "Academic Block L",
      dept: "Electrical & Instrumentation Engineering",
      pos: [0, 4.5, -48],
      size: [20, 9, 12],
      color: "#7c3aed",
      rooms_per_floor: 4,
      default_capacity: 60,
      primary_camera: "CAM-L11",
      rooms: {
        0: ["L-11", "L-12", "L-13", "L-14"],
        1: ["L-21", "L-22", "L-23", "L-24"],
        2: ["L-31", "L-32", "L-33", "L-34"]
      }
    },
    {
      id: "M",
      name: "Academic Block M",
      dept: "Applied Computing & Computational Math",
      pos: [30, 4.5, -48],
      size: [20, 9, 12],
      color: "#8b5cf6",
      rooms_per_floor: 4,
      default_capacity: 60,
      primary_camera: "CAM-M11",
      rooms: {
        0: ["M-11", "M-12", "M-13", "M-14"],
        1: ["M-21", "M-22", "M-23", "M-24"],
        2: ["M-31", "M-32", "M-33", "M-34"]
      }
    },
    {
      id: "N",
      name: "Academic Block N",
      dept: "AI, Machine Learning & Data Analytics",
      pos: [60, 4.5, -48],
      size: [20, 9, 12],
      color: "#a855f7",
      rooms_per_floor: 4,
      default_capacity: 60,
      primary_camera: "CAM-N11",
      rooms: {
        0: ["N-11", "N-12", "N-13", "N-14"],
        1: ["N-21", "N-22", "N-23", "N-24"],
        2: ["N-31", "N-32", "N-33", "N-34"]
      }
    },
    {
      id: "P",
      name: "Academic Block P",
      dept: "Robotics, Mechatronics & IoT Lab",
      pos: [-42, 4.5, -76],
      size: [22, 9, 12],
      color: "#d946ef",
      rooms_per_floor: 4,
      default_capacity: 55,
      primary_camera: "CAM-P11",
      rooms: {
        0: ["P-11", "P-12", "P-13", "P-14"],
        1: ["P-21", "P-22", "P-23", "P-24"],
        2: ["P-31", "P-32", "P-33", "P-34"]
      }
    },
    {
      id: "Q",
      name: "Academic Block Q",
      dept: "Cyber Security & Cloud Computing Hub",
      pos: [0, 4.5, -76],
      size: [22, 9, 12],
      color: "#c026d3",
      rooms_per_floor: 4,
      default_capacity: 55,
      primary_camera: "CAM-Q11",
      rooms: {
        0: ["Q-11", "Q-12", "Q-13", "Q-14"],
        1: ["Q-21", "Q-22", "Q-23", "Q-24"],
        2: ["Q-31", "Q-32", "Q-33", "Q-34"]
      }
    },
    {
      id: "R",
      name: "Academic Block R",
      dept: "Innovation, Incubation & Startup Cell",
      pos: [42, 4.5, -76],
      size: [22, 9, 12],
      color: "#9333ea",
      rooms_per_floor: 4,
      default_capacity: 55,
      primary_camera: "CAM-R11",
      rooms: {
        0: ["R-11", "R-12", "R-13", "R-14"],
        1: ["R-21", "R-22", "R-23", "R-24"],
        2: ["R-31", "R-32", "R-33", "R-34"]
      }
    }
  ],
  interconnected_corridors: [
    {
      id: "CORR_AB",
      name: "Skywalk Corridor A ↔ B",
      type: "block_connector",
      from_block: "A",
      to_block: "B",
      pos: [-71, 1.5, 12],
      size: [8, 3, 4],
      camera: "CAM-CORR-AB",
      status: "ONLINE"
    },
    {
      id: "CORR_CD",
      name: "Skywalk Corridor C ↔ D",
      type: "block_connector",
      from_block: "C",
      to_block: "D",
      pos: [-71, 1.5, -18],
      size: [8, 3, 4],
      camera: "CAM-CORR-CD",
      status: "ONLINE"
    },
    {
      id: "CORR_AC",
      name: "North-South Corridor A ↔ C",
      type: "block_connector",
      from_block: "A",
      to_block: "C",
      pos: [-56, 1.5, -3],
      size: [4, 3, 18],
      camera: "CAM-CORR-AC",
      status: "ONLINE"
    },
    {
      id: "CORR_EF",
      name: "Skywalk Corridor E ↔ F",
      type: "block_connector",
      from_block: "E",
      to_block: "F",
      pos: [71, 1.5, 12],
      size: [8, 3, 4],
      camera: "CAM-CORR-EF",
      status: "ONLINE"
    },
    {
      id: "CORR_GAA",
      name: "Skywalk Corridor G ↔ AA",
      type: "block_connector",
      from_block: "G",
      to_block: "AA",
      pos: [71, 1.5, -18],
      size: [8, 3, 4],
      camera: "CAM-CORR-GAA",
      status: "ONLINE"
    },
    {
      id: "CORR_EG",
      name: "North-South Corridor E ↔ G",
      type: "block_connector",
      from_block: "E",
      to_block: "G",
      pos: [56, 1.5, -3],
      size: [4, 3, 18],
      camera: "CAM-CORR-EG",
      status: "ONLINE"
    },
    {
      id: "SPINE_WEST",
      name: "Central West Spine Concourse",
      type: "main_spine",
      pos: [-27, 0.4, 5],
      size: [36, 0.8, 4],
      camera: "Camera-01-SPINE-W",
      status: "ONLINE"
    },
    {
      id: "SPINE_EAST",
      name: "Central East Spine Concourse",
      type: "main_spine",
      pos: [27, 0.4, 5],
      size: [36, 0.8, 4],
      camera: "Camera-01-SPINE-E",
      status: "ONLINE"
    },
    {
      id: "SPINE_NORTH",
      name: "Academic Spine J-K-L-M-N",
      type: "main_spine",
      pos: [0, 0.4, -48],
      size: [140, 0.8, 4],
      camera: "CAM-NORTH-SPINE",
      status: "ONLINE"
    },
    {
      id: "CENTRAL_AVENUE",
      name: "PSIT Central Grand Avenue",
      type: "avenue",
      pos: [0, 0.3, -20],
      size: [6, 0.6, 52],
      camera: "Camera-07",
      status: "OFFLINE"
    },
    {
      id: "INNOVATION_SPINE",
      name: "Innovation Concourse P-Q-R",
      type: "main_spine",
      pos: [0, 0.4, -76],
      size: [108, 0.8, 4],
      camera: "CAM-INNOV-SPINE",
      status: "ONLINE"
    }
  ]
};
