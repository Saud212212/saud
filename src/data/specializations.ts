export type Specialization = {
  id: string;
  name: string;
  english: string;
  icon: string;
  color: string;
  standards: string[];
  tools: string[];
  count: number;
};

export const SPECIALIZATIONS: Specialization[] = [
  {
    id: "civil",
    name: "مدني / إنشائي",
    english: "Civil / Structural",
    icon: "🏗️",
    color: "from-engineering-700 to-engineering-900",
    standards: ["ACI 318-19", "AISC 360-16", "Eurocode 2/3", "SBC 304"],
    tools: ["ETABS", "SAP2000", "SAFE", "CSI Bridge", "MIDAS Civil"],
    count: 12500
  },
  {
    id: "architectural",
    name: "معماري",
    english: "Architectural",
    icon: "🏛️",
    color: "from-gold-700 to-gold-800",
    standards: ["NBC", "IBC", "ADA", "NFPA 101"],
    tools: ["Revit", "ArchiCAD", "SketchUp", "Rhino", "Forma"],
    count: 8400
  },
  {
    id: "mechanical",
    name: "ميكانيكي",
    english: "Mechanical",
    icon: "⚙️",
    color: "from-engineering-600 to-engineering-800",
    standards: ["ASME BPVC VIII", "ISO 9001", "Shigley's MD"],
    tools: ["SolidWorks", "CATIA", "Creo", "ANSYS Mechanical"],
    count: 9800
  },
  {
    id: "electrical",
    name: "كهربائي",
    english: "Electrical",
    icon: "⚡",
    color: "from-engineering-500 to-engineering-700",
    standards: ["NEC 2023", "IEC 60364", "IEEE 519"],
    tools: ["ETAP", "DIgSILENT", "SKM PowerTools", "AutoCAD Elec."],
    count: 7600
  },
  {
    id: "chemical",
    name: "كيميائي",
    english: "Chemical",
    icon: "🧪",
    color: "from-gold-600 to-gold-800",
    standards: ["Perry's CEH", "Coulson & Richardson"],
    tools: ["Aspen Plus", "HYSYS", "ChemCAD", "DWSIM"],
    count: 5400
  },
  {
    id: "industrial",
    name: "صناعي",
    english: "Industrial",
    icon: "🏭",
    color: "from-engineering-600 to-engineering-900",
    standards: ["Operations Research", "Lean Six Sigma"],
    tools: ["Arena", "FlexSim", "Plant Simulation", "LINDO"],
    count: 4200
  },
  {
    id: "software",
    name: "حاسوب / برمجيات",
    english: "Software",
    icon: "💻",
    color: "from-engineering-700 to-engineering-900",
    standards: ["SWEBOK", "ISO/IEC 25010", "CMMI", "IEEE 830"],
    tools: ["Git", "Jira", "Docker", "Kubernetes"],
    count: 6800
  },
  {
    id: "petroleum",
    name: "بترولي / نفط",
    english: "Petroleum",
    icon: "🛢️",
    color: "from-ink-800 to-engineering-900",
    standards: ["Petroleum Engineering Handbook", "API"],
    tools: ["PIPESIM", "OLGA", "Eclipse", "Petrel", "IPM Suite"],
    count: 5100
  },
  {
    id: "environmental",
    name: "بيئي",
    english: "Environmental",
    icon: "🌱",
    color: "from-engineering-600 to-engineering-800",
    standards: ["EPA Methods", "ISO 14001", "LCA"],
    tools: ["GaBi", "SimaPro"],
    count: 3200
  },
  {
    id: "mechatronics",
    name: "ميكاترونكس",
    english: "Mechatronics",
    icon: "🤖",
    color: "from-engineering-700 to-engineering-900",
    standards: ["Mechatronics System Design"],
    tools: ["MATLAB/Simulink", "ROS", "LabVIEW", "Arduino", "PLC"],
    count: 4500
  },
  {
    id: "aerospace",
    name: "فضاء / طيران",
    english: "Aerospace",
    icon: "🚀",
    color: "from-engineering-800 to-ink-900",
    standards: ["NASA-STD-5012", "ECSS"],
    tools: ["STK", "OpenVSP", "XFLR5", "ANSYS Fluent CFD"],
    count: 3800
  },
  {
    id: "nuclear",
    name: "نووي",
    english: "Nuclear",
    icon: "☢️",
    color: "from-gold-700 to-engineering-900",
    standards: ["10 CFR 50", "IAEA Safety Standards"],
    tools: ["MCNP", "RELAP5", "SCALE", "PARCS"],
    count: 2100
  }
];
