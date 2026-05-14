export interface StorylineStep {
  /** Event id from events.json */
  eventId: string;
  /** Editorial gloss explaining why this step matters in this story. */
  note: string;
}

export interface Storyline {
  id: string;
  title: string;
  subtitle: string;
  steps: StorylineStep[];
}

/**
 * Curated narrative tours through the influence graph. Each step lands on a real
 * event id; playback selects it and pans time to its year. Stories trace how
 * an idea propagates across centuries and disciplines.
 */
export const STORYLINES: Storyline[] = [
  {
    id: 'geometry_to_computing',
    title: 'From geometry to computing',
    subtitle: 'A 2,300-year chain that ends in the machine',
    steps: [
      {
        eventId: 'evt_005_euclid',
        note: 'Geometry becomes the first system proved from axioms. The template of mathematics.',
      },
      {
        eventId: 'evt_010_alkhwarizmi_algebra',
        note: 'Algebra arrives as a procedure — a recipe. Latinized, his name becomes "algorithm".',
      },
      {
        eventId: 'evt_descartes_analytic_geom',
        note: 'Descartes welds algebra to geometry. Curves get equations; equations get shapes.',
      },
      {
        eventId: 'evt_015_calculus',
        note: 'Newton and Leibniz make change itself computable.',
      },
      {
        eventId: 'evt_boole_logic',
        note: 'Boole reduces logic to algebra. Truth becomes arithmetic.',
      },
      {
        eventId: 'evt_godel_incompleteness',
        note: 'Gödel proves that no system can prove all the truths inside it.',
      },
      {
        eventId: 'evt_025_turing_computability',
        note: 'Turing defines computation itself — and what no machine can decide.',
      },
      {
        eventId: 'evt_027_shannon_information',
        note: 'Shannon quantifies information. The bit is born; channels get capacity limits.',
      },
      {
        eventId: 'evt_026_transistor',
        note: 'The transistor lets switching circuits be small, fast, and cheap.',
      },
      {
        eventId: 'evt_von_neumann_architecture',
        note: 'Programs become data. The stored-program machine arrives.',
      },
    ],
  },
  {
    id: 'microbes_to_mrna',
    title: 'Microbes to mRNA',
    subtitle: 'How medicine learned to see the invisible',
    steps: [
      {
        eventId: 'evt_007_hippocrates',
        note: 'Medicine breaks from divine punishment. Observation and prognosis enter the clinic.',
      },
      {
        eventId: 'evt_avicenna_canon',
        note: 'Avicenna codifies a millennium of Greek-Islamic medical practice.',
      },
      {
        eventId: 'evt_jenner_smallpox_vaccine',
        note: 'Vaccination as a concept — long before anyone knew what a virus was.',
      },
      {
        eventId: 'evt_022_germ_theory',
        note: 'Pasteur, Koch, and Lister show that disease is caused by living organisms.',
      },
      {
        eventId: 'evt_pasteur_rabies_vaccine',
        note: 'Attenuated pathogens turn into deliberate vaccines.',
      },
      {
        eventId: 'evt_028_dna_structure',
        note: 'The double helix gives heredity a chemical structure.',
      },
      {
        eventId: 'evt_032_crispr',
        note: 'A bacterial immune system becomes a programmable scalpel for DNA.',
      },
      {
        eventId: 'evt_mrna_covid_vaccine',
        note: 'mRNA vaccines — designed in days, deployed in months.',
      },
    ],
  },
  {
    id: 'sky_to_universe',
    title: 'From the sky to the universe',
    subtitle: 'Cosmology, in seven moves',
    steps: [
      {
        eventId: 'evt_013_heliocentrism',
        note: 'Copernicus moves the Sun to the center and demotes Earth to a planet.',
      },
      {
        eventId: 'evt_galileo_telescope',
        note: 'Galileo turns the telescope skyward. The Aristotelian cosmos cracks.',
      },
      {
        eventId: 'evt_016_principia',
        note: 'Newton unifies the heavens and the Earth under one gravitational law.',
      },
      {
        eventId: 'evt_023_general_relativity',
        note: 'Einstein recasts gravity as the geometry of spacetime.',
      },
      {
        eventId: 'evt_lemaitre_big_bang',
        note: 'Lemaître proposes a "primeval atom" — the universe has a history.',
      },
      {
        eventId: 'evt_hubble_expansion',
        note: 'Hubble sees galaxies receding. The cosmos is expanding.',
      },
      {
        eventId: 'evt_higgs_boson',
        note: 'The Higgs boson confirms why fundamental particles have mass.',
      },
    ],
  },
  {
    id: 'internet_emergence',
    title: 'The Internet, before & after',
    subtitle: 'Logic, switching, packets, links — and finally a web',
    steps: [
      {
        eventId: 'evt_027_shannon_information',
        note: 'Shannon defines the bit and bounds what any channel can carry.',
      },
      {
        eventId: 'evt_026_transistor',
        note: 'Cheap, reliable switching becomes physically possible.',
      },
      {
        eventId: 'evt_030_arpanet',
        note: 'ARPANET — packet switching for a network that survives partial failure.',
      },
      {
        eventId: 'evt_internet_protocol_tcpip',
        note: 'TCP/IP becomes the universal handshake between networks of networks.',
      },
      {
        eventId: 'evt_world_wide_web',
        note: 'Berners-Lee adds the hyperlink and the browser. Information becomes navigable.',
      },
      {
        eventId: 'evt_031_alexnet_dl',
        note: 'On that infrastructure, deep learning finally has the data and compute it needed.',
      },
      {
        eventId: 'evt_033_transformer',
        note: 'The Transformer — and with it, the foundation-model era.',
      },
    ],
  },
  {
    id: 'earth_in_motion',
    title: 'Earth in motion',
    subtitle: 'How geology let the continents move',
    steps: [
      {
        eventId: 'evt_wegener_continental_drift',
        note: 'Wegener proposes the continents were once joined. The geological establishment recoils.',
      },
      {
        eventId: 'evt_029_plate_tectonics',
        note: 'Seafloor spreading and transform faults make drift mechanically inevitable.',
      },
    ],
  },
];

export const STORYLINE_BY_ID = new Map(STORYLINES.map((s) => [s.id, s]));
