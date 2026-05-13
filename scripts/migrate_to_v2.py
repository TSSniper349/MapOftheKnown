#!/usr/bin/env python3
"""
Migrate public/events.json from v1 schema to v2.

For every event, add:
  - locations: [{label, lat, lon}, ...]
  - concepts: ["concept-tag", ...]

Strategy:
  1. For the 33 anchor (seed) events, lift exact values from the v2 seed file.
  2. For ~150 other events, use hand-curated location + concept mappings below.
  3. For the remaining events, derive concepts heuristically from their label
     and key figures; leave `locations: []` to be filled in incrementally.

Also updates `_meta.version` to 0.4 and noting v2 schema.
"""

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVENTS_PATH = os.path.join(ROOT, 'public', 'events.json')

# -------- Hand-curated locations + concepts (extends seed) ----------

# The 33 seed event ids are already covered by SEED_OVERRIDES (verbatim from the v2 seed).
# This dictionary covers many more important events I added in the v1 expansion.

CURATED = {
    # ---- Prehistory additions ----
    "evt_lebombo_bone": {
        "locations": [{"label": "Lebombo Mountains, Eswatini", "lat": -27.0, "lon": 31.9}],
        "concepts": ["tally", "lunar-cycle", "notation"],
    },
    "evt_blombos_engravings": {
        "locations": [{"label": "Blombos Cave, South Africa", "lat": -34.42, "lon": 21.22}],
        "concepts": ["symbolic-thought", "abstraction", "visual-representation"],
    },
    "evt_ishango_bone": {
        "locations": [{"label": "Ishango, Democratic Republic of the Congo", "lat": -0.13, "lon": 29.42}],
        "concepts": ["tally", "arithmetic", "notation"],
    },
    "evt_dog_domestication": {
        "locations": [
            {"label": "Eurasian steppe", "lat": 50.0, "lon": 60.0},
        ],
        "concepts": ["domestication", "selection", "human-animal-partnership"],
    },
    "evt_pottery_origin": {
        "locations": [{"label": "Xianrendong, Jiangxi, China", "lat": 28.7, "lon": 116.3}],
        "concepts": ["ceramic", "high-temperature-processing", "material-transformation"],
    },
    "evt_gobekli_tepe": {
        "locations": [{"label": "Göbekli Tepe, Anatolia", "lat": 37.22, "lon": 38.92}],
        "concepts": ["monumental-architecture", "ritual", "neolithic"],
    },
    "evt_jericho_walls": {
        "locations": [{"label": "Jericho, Jordan Valley", "lat": 31.87, "lon": 35.45}],
        "concepts": ["fortification", "urbanism", "civic-engineering"],
    },
    "evt_metallurgy_copper": {
        "locations": [
            {"label": "Balkans (Vinča culture)", "lat": 44.5, "lon": 21.0},
            {"label": "Near East", "lat": 36.0, "lon": 38.0},
        ],
        "concepts": ["smelting", "metallurgy", "material-transformation"],
    },
    "evt_irrigation_mesopotamia": {
        "locations": [{"label": "Tigris-Euphrates floodplain", "lat": 32.0, "lon": 45.0}],
        "concepts": ["canal", "water-management", "landscape-engineering"],
    },
    "evt_bronze_age": {
        "locations": [
            {"label": "Anatolia / Near East", "lat": 38.5, "lon": 35.0},
            {"label": "Erlitou, China", "lat": 34.7, "lon": 112.7},
        ],
        "concepts": ["alloy", "metallurgy", "tin", "copper"],
    },
    "evt_wheel_transport": {
        "locations": [{"label": "Pontic-Caspian steppe", "lat": 47.0, "lon": 40.0}],
        "concepts": ["wheel", "transport", "axle"],
    },
    "evt_silk_production": {
        "locations": [{"label": "Yellow River basin, China", "lat": 34.7, "lon": 113.6}],
        "concepts": ["sericulture", "textile", "trade"],
    },

    # ---- Antiquity additions ----
    "evt_egyptian_hieroglyphs": {
        "locations": [{"label": "Egypt", "lat": 26.0, "lon": 31.0}],
        "concepts": ["writing", "logo-phonetic", "hieroglyph"],
    },
    "evt_indus_script": {
        "locations": [{"label": "Mohenjo-daro, Indus Valley", "lat": 27.33, "lon": 68.14}],
        "concepts": ["writing", "undeciphered", "indus-valley"],
    },
    "evt_proto_sinaitic_alphabet": {
        "locations": [{"label": "Serabit el-Khadim, Sinai", "lat": 29.04, "lon": 33.46}],
        "concepts": ["alphabet", "acrophony", "writing"],
    },
    "evt_pyramids_giza": {
        "locations": [{"label": "Giza, Egypt", "lat": 29.98, "lon": 31.13}],
        "concepts": ["monumental-architecture", "stone-engineering", "surveying"],
    },
    "evt_indus_drainage": {
        "locations": [
            {"label": "Mohenjo-daro, Indus Valley", "lat": 27.33, "lon": 68.14},
            {"label": "Harappa, Indus Valley", "lat": 30.63, "lon": 72.86},
        ],
        "concepts": ["urbanism", "sanitation", "public-engineering"],
    },
    "evt_iron_smelting": {
        "locations": [
            {"label": "Anatolia (Hittite Empire)", "lat": 39.94, "lon": 33.0},
            {"label": "West Africa (Nok culture)", "lat": 9.5, "lon": 8.5},
        ],
        "concepts": ["iron", "smelting", "bloomery"],
    },
    "evt_phoenician_alphabet": {
        "locations": [{"label": "Phoenicia (Lebanese coast)", "lat": 33.9, "lon": 35.5}],
        "concepts": ["alphabet", "writing", "consonantal-script"],
    },
    "evt_shang_oracle_bones": {
        "locations": [{"label": "Anyang, China (Shang capital)", "lat": 36.1, "lon": 114.4}],
        "concepts": ["chinese-script", "divination", "writing"],
    },
    "evt_olmec_writing": {
        "locations": [{"label": "Veracruz, Mesoamerica", "lat": 19.2, "lon": -96.1}],
        "concepts": ["writing", "mesoamerican", "proto-writing"],
    },
    "evt_greek_alphabet": {
        "locations": [{"label": "Greek city-states", "lat": 38.0, "lon": 23.7}],
        "concepts": ["alphabet", "vowel", "writing"],
    },
    "evt_aramaic_diffusion": {
        "locations": [
            {"label": "Mesopotamia", "lat": 33.3, "lon": 44.4},
            {"label": "Persepolis, Achaemenid Persia", "lat": 29.93, "lon": 52.89},
        ],
        "concepts": ["lingua-franca", "administration", "writing"],
    },
    "evt_panini_grammar": {
        "locations": [{"label": "Gandhara (Taxila/Shalatura)", "lat": 33.74, "lon": 72.83}],
        "concepts": ["grammar", "generative-rules", "phonology", "linguistics", "sanskrit"],
    },
    "evt_chinese_seal_script": {
        "locations": [{"label": "Xianyang, Qin China", "lat": 34.34, "lon": 108.71}],
        "concepts": ["chinese-script", "standardization", "writing"],
    },
    "evt_maya_script": {
        "locations": [{"label": "Maya region, Mesoamerica", "lat": 17.5, "lon": -89.0}],
        "concepts": ["logo-syllabic", "writing", "mesoamerican"],
    },
    "evt_babylonian_math": {
        "locations": [{"label": "Babylon, Mesopotamia", "lat": 32.54, "lon": 44.42}],
        "concepts": ["sexagesimal", "place-value", "arithmetic"],
    },
    "evt_egyptian_rhind_papyrus": {
        "locations": [{"label": "Thebes, Egypt", "lat": 25.7, "lon": 32.65}],
        "concepts": ["arithmetic", "fractions", "geometry"],
    },
    "evt_thales_theorem": {
        "locations": [{"label": "Miletus, Ionia", "lat": 37.53, "lon": 27.28}],
        "concepts": ["geometry", "deduction", "demonstrative-proof"],
    },
    "evt_pythagoras": {
        "locations": [
            {"label": "Samos, Greece", "lat": 37.75, "lon": 26.83},
            {"label": "Croton, Magna Graecia", "lat": 39.08, "lon": 17.13},
        ],
        "concepts": ["number-theory", "ratio", "geometry"],
    },
    "evt_zeno_paradoxes": {
        "locations": [{"label": "Elea, Magna Graecia", "lat": 40.16, "lon": 15.15}],
        "concepts": ["infinity", "motion", "paradox"],
    },
    "evt_archimedes": {
        "locations": [{"label": "Syracuse, Sicily", "lat": 37.07, "lon": 15.29}],
        "concepts": ["geometry", "method-of-exhaustion", "mechanics", "infinitesimal"],
    },
    "evt_apollonius_conics": {
        "locations": [{"label": "Perga, Pamphylia", "lat": 36.96, "lon": 30.85}],
        "concepts": ["geometry", "conic-section", "ellipse"],
    },
    "evt_hipparchus_trig": {
        "locations": [{"label": "Nicaea, Bithynia", "lat": 40.42, "lon": 29.72}],
        "concepts": ["trigonometry", "astronomy", "chord-table"],
    },
    "evt_diophantus": {
        "locations": [{"label": "Alexandria, Roman Egypt", "lat": 31.2, "lon": 29.92}],
        "concepts": ["algebra", "indeterminate-equation", "diophantine"],
    },
    "evt_aryabhata_zero": {
        "locations": [{"label": "Kusumapura (Pataliputra), India", "lat": 25.61, "lon": 85.14}],
        "concepts": ["trigonometry", "sine", "place-value", "astronomy"],
    },
    "evt_maya_zero_calendar": {
        "locations": [{"label": "Maya lowlands", "lat": 17.5, "lon": -89.0}],
        "concepts": ["zero", "place-value", "long-count", "mesoamerican"],
    },
    "evt_lao_zi_dao": {
        "locations": [{"label": "Zhou China", "lat": 34.5, "lon": 113.0}],
        "concepts": ["daoism", "metaphysics", "wu-wei"],
    },
    "evt_confucius_analects": {
        "locations": [{"label": "Lu (Qufu), China", "lat": 35.6, "lon": 116.99}],
        "concepts": ["ethics", "ritual", "confucianism", "virtue"],
    },
    "evt_buddha_dhamma": {
        "locations": [{"label": "Magadha, India", "lat": 25.0, "lon": 85.0}],
        "concepts": ["impermanence", "philosophy-of-mind", "buddhism", "causation"],
    },
    "evt_mozi_logic": {
        "locations": [{"label": "Warring States China", "lat": 35.0, "lon": 114.0}],
        "concepts": ["formal-logic", "disputation", "mohism"],
    },
    "evt_socratic_method": {
        "locations": [{"label": "Athens, Greece", "lat": 37.97, "lon": 23.72}],
        "concepts": ["elenchus", "dialogue", "ethics"],
    },
    "evt_plato_forms": {
        "locations": [{"label": "Athens (Academy), Greece", "lat": 37.99, "lon": 23.71}],
        "concepts": ["forms", "metaphysics", "idealism"],
    },
    "evt_aristotle_physics": {
        "locations": [{"label": "Athens (Lyceum), Greece", "lat": 37.97, "lon": 23.74}],
        "concepts": ["natural-philosophy", "teleology", "motion"],
    },
    "evt_aristotle_biology": {
        "locations": [{"label": "Lesbos, Greece", "lat": 39.10, "lon": 26.55}],
        "concepts": ["natural-history", "classification", "biology"],
    },
    "evt_theophrastus_botany": {
        "locations": [{"label": "Athens, Greece", "lat": 37.97, "lon": 23.72}],
        "concepts": ["botany", "classification", "natural-history"],
    },
    "evt_stoicism": {
        "locations": [{"label": "Athens (Stoa Poikile), Greece", "lat": 37.97, "lon": 23.72}],
        "concepts": ["ethics", "stoicism", "natural-law"],
    },
    "evt_epicurus_atomism": {
        "locations": [{"label": "Athens (Garden), Greece", "lat": 37.97, "lon": 23.72}],
        "concepts": ["atomism", "materialism", "ethics"],
    },
    "evt_nyaya_logic": {
        "locations": [{"label": "Mithila, India", "lat": 26.65, "lon": 85.92}],
        "concepts": ["formal-logic", "inference", "epistemology", "indian-philosophy"],
    },
    "evt_han_feizi_legalism": {
        "locations": [{"label": "Qin / Han Empire", "lat": 34.5, "lon": 109.0}],
        "concepts": ["political-theory", "legalism", "statecraft"],
    },
    "evt_augustine_confessions": {
        "locations": [{"label": "Hippo Regius, North Africa", "lat": 36.9, "lon": 7.77}],
        "concepts": ["theology", "introspection", "philosophy-of-mind"],
    },
    "evt_babylonian_astronomy": {
        "locations": [{"label": "Babylon, Mesopotamia", "lat": 32.54, "lon": 44.42}],
        "concepts": ["astronomy", "ephemeris", "observation"],
    },
    "evt_aristarchus_helio": {
        "locations": [{"label": "Samos, Greece", "lat": 37.75, "lon": 26.83}],
        "concepts": ["heliocentrism", "astronomy"],
    },
    "evt_eratosthenes_circumference": {
        "locations": [
            {"label": "Alexandria, Egypt", "lat": 31.2, "lon": 29.92},
            {"label": "Syene (Aswan), Egypt", "lat": 24.09, "lon": 32.9},
        ],
        "concepts": ["geodesy", "measurement", "geography"],
    },
    "evt_strabo_geography": {
        "locations": [{"label": "Amaseia, Pontus", "lat": 40.65, "lon": 35.83}],
        "concepts": ["geography", "ethnography", "cartography"],
    },
    "evt_ptolemy_almagest": {
        "locations": [{"label": "Alexandria, Roman Egypt", "lat": 31.2, "lon": 29.92}],
        "concepts": ["astronomy", "geocentric", "epicycle"],
    },
    "evt_zhang_heng_seismograph": {
        "locations": [{"label": "Luoyang, Han China", "lat": 34.62, "lon": 112.45}],
        "concepts": ["seismology", "instrumentation"],
    },
    "evt_chinese_supernova_185": {
        "locations": [{"label": "Han China (court observatory)", "lat": 34.62, "lon": 112.45}],
        "concepts": ["astronomy", "supernova", "observation"],
    },
    "evt_imhotep": {
        "locations": [{"label": "Memphis, Old Kingdom Egypt", "lat": 29.85, "lon": 31.25}],
        "concepts": ["clinical-medicine", "ancient-egypt"],
    },
    "evt_edwin_smith_papyrus": {
        "locations": [{"label": "Thebes, Egypt", "lat": 25.7, "lon": 32.65}],
        "concepts": ["surgery", "trauma", "clinical-medicine"],
    },
    "evt_sushruta_samhita": {
        "locations": [{"label": "Varanasi, India", "lat": 25.32, "lon": 82.97}],
        "concepts": ["surgery", "ayurveda", "anatomy"],
    },
    "evt_huangdi_neijing": {
        "locations": [{"label": "Han China", "lat": 34.62, "lon": 112.45}],
        "concepts": ["traditional-chinese-medicine", "qi", "acupuncture"],
    },
    "evt_charaka_samhita": {
        "locations": [{"label": "Northwest India", "lat": 32.0, "lon": 75.0}],
        "concepts": ["ayurveda", "internal-medicine", "pharmacology"],
    },
    "evt_dioscorides_materia_medica": {
        "locations": [{"label": "Anazarbus, Roman Empire", "lat": 37.27, "lon": 35.91}],
        "concepts": ["pharmacology", "materia-medica", "herbal"],
    },
    "evt_galen_anatomy": {
        "locations": [
            {"label": "Pergamon, Roman Empire", "lat": 39.13, "lon": 27.18},
            {"label": "Rome, Roman Empire", "lat": 41.9, "lon": 12.49},
        ],
        "concepts": ["anatomy", "physiology", "humoral-medicine"],
    },
    "evt_pliny_natural_history": {
        "locations": [{"label": "Rome, Roman Empire", "lat": 41.9, "lon": 12.49}],
        "concepts": ["natural-history", "encyclopedia"],
    },
    "evt_great_wall_qin": {
        "locations": [{"label": "Northern China", "lat": 40.43, "lon": 116.57}],
        "concepts": ["fortification", "logistics", "civic-engineering"],
    },
    "evt_aqueducts_rome": {
        "locations": [{"label": "Rome, Roman Republic", "lat": 41.9, "lon": 12.49}],
        "concepts": ["aqueduct", "concrete", "civic-engineering", "hydraulic"],
    },
    "evt_archimedes_screw": {
        "locations": [{"label": "Syracuse, Sicily", "lat": 37.07, "lon": 15.29}],
        "concepts": ["mechanical-engineering", "water-lifting", "mechanics"],
    },
    "evt_compass_lodestone": {
        "locations": [{"label": "Han China", "lat": 34.62, "lon": 112.45}],
        "concepts": ["compass", "magnetism", "navigation"],
    },
    "evt_sun_tzu_art_of_war": {
        "locations": [{"label": "Eastern Zhou China", "lat": 32.0, "lon": 119.0}],
        "concepts": ["strategy", "political-theory", "deception"],
    },
    "evt_chanakya_arthashastra": {
        "locations": [{"label": "Pataliputra, Mauryan India", "lat": 25.61, "lon": 85.14}],
        "concepts": ["statecraft", "political-economy", "intelligence"],
    },
    "evt_thucydides_history": {
        "locations": [{"label": "Athens, Greece", "lat": 37.97, "lon": 23.72}],
        "concepts": ["historiography", "political-realism"],
    },
    "evt_herodotus_histories": {
        "locations": [{"label": "Halicarnassus, Ionia", "lat": 37.04, "lon": 27.43}],
        "concepts": ["ethnography", "historiography"],
    },

    # ---- Medieval / Early Modern ----
    "evt_jabir_alchemy": {
        "locations": [{"label": "Baghdad, Abbasid Caliphate", "lat": 33.32, "lon": 44.42}],
        "concepts": ["alchemy", "distillation", "laboratory-practice"],
    },
    "evt_house_of_wisdom": {
        "locations": [{"label": "Baghdad, Abbasid Caliphate", "lat": 33.32, "lon": 44.42}],
        "concepts": ["translation-movement", "scholarship", "library"],
    },
    "evt_gunpowder_china": {
        "locations": [{"label": "Tang/Song China", "lat": 30.27, "lon": 120.16}],
        "concepts": ["explosive", "saltpeter", "rocket", "alchemy"],
    },
    "evt_al_razi_clinical": {
        "locations": [{"label": "Rayy / Baghdad, Abbasid Caliphate", "lat": 35.59, "lon": 51.43}],
        "concepts": ["clinical-medicine", "smallpox", "diagnosis"],
    },
    "evt_al_biruni_geology": {
        "locations": [{"label": "Ghaznavid Empire (Khwarazm)", "lat": 33.55, "lon": 68.42}],
        "concepts": ["geodesy", "mineralogy", "earth-sciences"],
    },
    "evt_avicenna_canon": {
        "locations": [{"label": "Bukhara, Samanid Empire", "lat": 39.78, "lon": 64.42}],
        "concepts": ["clinical-medicine", "synthesis", "diagnosis"],
    },
    "evt_avicenna_philosophy": {
        "locations": [{"label": "Bukhara / Hamadan", "lat": 34.8, "lon": 48.5}],
        "concepts": ["metaphysics", "essence-existence", "islamic-philosophy"],
    },
    "evt_song_supernova_1054": {
        "locations": [{"label": "Kaifeng, Song China", "lat": 34.8, "lon": 114.3}],
        "concepts": ["astronomy", "supernova", "observation"],
    },
    "evt_bi_sheng_movable_type": {
        "locations": [{"label": "Northern Song China", "lat": 34.8, "lon": 113.6}],
        "concepts": ["movable-type", "printing", "writing"],
    },
    "evt_su_song_water_clock": {
        "locations": [{"label": "Kaifeng, Northern Song China", "lat": 34.8, "lon": 114.3}],
        "concepts": ["mechanical-clock", "escapement", "astronomy"],
    },
    "evt_omar_khayyam_calendar": {
        "locations": [{"label": "Isfahan, Seljuk Empire", "lat": 32.65, "lon": 51.66}],
        "concepts": ["algebra", "calendar-reform", "cubic-equation"],
    },
    "evt_compass_navigation_song": {
        "locations": [{"label": "Song China", "lat": 30.27, "lon": 120.16}],
        "concepts": ["compass", "navigation", "magnetism"],
    },
    "evt_fibonacci_liber_abaci": {
        "locations": [{"label": "Pisa, Italy", "lat": 43.72, "lon": 10.4}],
        "concepts": ["arabic-numerals", "arithmetic", "merchant-math"],
    },
    "evt_ibn_al_nafis_pulmonary": {
        "locations": [{"label": "Cairo, Mamluk Sultanate", "lat": 30.05, "lon": 31.25}],
        "concepts": ["pulmonary-circulation", "anatomy", "physiology"],
    },
    "evt_aquinas_summa": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["scholasticism", "theology", "metaphysics"],
    },
    "evt_oresme_kinematics": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["kinematics", "mean-speed-theorem", "geometry"],
    },
    "evt_ibn_khaldun_muqaddimah": {
        "locations": [{"label": "Tunis / Cairo", "lat": 36.8, "lon": 10.18}],
        "concepts": ["sociology", "historiography", "asabiyyah"],
    },
    "evt_madhava_kerala_series": {
        "locations": [{"label": "Sangamagrama, Kerala, India", "lat": 10.85, "lon": 76.27}],
        "concepts": ["infinite-series", "calculus", "trigonometry"],
    },
    "evt_hangul_sejong": {
        "locations": [{"label": "Hanyang (Seoul), Joseon Korea", "lat": 37.57, "lon": 126.98}],
        "concepts": ["alphabet", "phonetic-writing", "writing"],
    },
    "evt_machiavelli_prince": {
        "locations": [{"label": "Florence, Italy", "lat": 43.77, "lon": 11.25}],
        "concepts": ["political-realism", "statecraft", "power"],
    },
    "evt_paracelsus_chemistry": {
        "locations": [{"label": "Basel, Switzerland", "lat": 47.56, "lon": 7.59}],
        "concepts": ["pharmacology", "iatrochemistry", "alchemy"],
    },
    "evt_vesalius_anatomy": {
        "locations": [{"label": "Padua, Republic of Venice", "lat": 45.41, "lon": 11.88}],
        "concepts": ["anatomy", "dissection", "illustration"],
    },
    "evt_pare_surgery": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["surgery", "ligature", "battlefield-medicine"],
    },
    "evt_tycho_brahe": {
        "locations": [{"label": "Hven (Uraniborg), Denmark", "lat": 55.91, "lon": 12.70}],
        "concepts": ["astronomy", "observation", "precision"],
    },
    "evt_bodin_political": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["sovereignty", "political-theory"],
    },
    "evt_galileo_telescope": {
        "locations": [{"label": "Padua, Italy", "lat": 45.41, "lon": 11.88}],
        "concepts": ["telescope", "astronomy", "experimental-method"],
    },
    "evt_kepler_laws": {
        "locations": [{"label": "Prague, Holy Roman Empire", "lat": 50.08, "lon": 14.43}],
        "concepts": ["planetary-motion", "ellipse", "astronomy"],
    },
    "evt_napier_logarithms": {
        "locations": [{"label": "Merchiston, Scotland", "lat": 55.93, "lon": -3.21}],
        "concepts": ["logarithm", "computation", "tables"],
    },
    "evt_grotius_law": {
        "locations": [{"label": "Delft, Dutch Republic", "lat": 52.01, "lon": 4.36}],
        "concepts": ["natural-law", "international-law", "political-theory"],
    },
    "evt_harvey_circulation": {
        "locations": [{"label": "London, England", "lat": 51.51, "lon": -0.13}],
        "concepts": ["circulation", "physiology", "quantitative-argument"],
    },
    "evt_descartes_analytic_geom": {
        "locations": [{"label": "Leiden, Dutch Republic", "lat": 52.16, "lon": 4.49}],
        "concepts": ["analytic-geometry", "coordinate-system", "algebra"],
    },
    "evt_descartes_meditations": {
        "locations": [{"label": "Leiden, Dutch Republic", "lat": 52.16, "lon": 4.49}],
        "concepts": ["cogito", "rationalism", "metaphysics", "dualism"],
    },
    "evt_pascal_mechanical_calc": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["mechanical-calculator", "computation"],
    },
    "evt_descartes_mechanism": {
        "locations": [{"label": "Stockholm / Amsterdam", "lat": 59.33, "lon": 18.07}],
        "concepts": ["mechanism", "vortex", "natural-philosophy"],
    },
    "evt_hobbes_leviathan": {
        "locations": [{"label": "London, England", "lat": 51.51, "lon": -0.13}],
        "concepts": ["social-contract", "sovereignty", "political-theory"],
    },
    "evt_pascal_fermat_probability": {
        "locations": [
            {"label": "Paris, France", "lat": 48.86, "lon": 2.35},
            {"label": "Toulouse, France", "lat": 43.6, "lon": 1.44},
        ],
        "concepts": ["probability", "expectation"],
    },
    "evt_huygens_pendulum": {
        "locations": [{"label": "The Hague, Dutch Republic", "lat": 52.07, "lon": 4.3}],
        "concepts": ["pendulum-clock", "instrumentation", "precision"],
    },
    "evt_boyle_sceptical_chymist": {
        "locations": [{"label": "London / Oxford, England", "lat": 51.75, "lon": -1.26}],
        "concepts": ["corpuscular-theory", "experimental-method", "chemistry"],
    },
    "evt_boyle_law": {
        "locations": [{"label": "Oxford, England", "lat": 51.75, "lon": -1.26}],
        "concepts": ["gas-law", "pressure", "volume", "thermodynamics"],
    },
    "evt_hooke_micrographia": {
        "locations": [{"label": "London, England", "lat": 51.51, "lon": -0.13}],
        "concepts": ["microscopy", "cell", "illustration"],
    },
    "evt_malpighi_microanatomy": {
        "locations": [{"label": "Bologna, Italy", "lat": 44.49, "lon": 11.34}],
        "concepts": ["microscopy", "capillary", "anatomy"],
    },
    "evt_steno_stratigraphy": {
        "locations": [{"label": "Florence, Tuscany", "lat": 43.77, "lon": 11.25}],
        "concepts": ["stratigraphy", "superposition", "fossil"],
    },
    "evt_grew_plant_anatomy": {
        "locations": [{"label": "London, England", "lat": 51.51, "lon": -0.13}],
        "concepts": ["botany", "microanatomy", "plant-tissue"],
    },
    "evt_leeuwenhoek_microbes": {
        "locations": [{"label": "Delft, Dutch Republic", "lat": 52.01, "lon": 4.36}],
        "concepts": ["microscopy", "microorganism", "single-lens"],
    },
    "evt_spinoza_ethics": {
        "locations": [{"label": "The Hague, Dutch Republic", "lat": 52.07, "lon": 4.3}],
        "concepts": ["monism", "metaphysics", "rationalism"],
    },
    "evt_sydenham_clinical": {
        "locations": [{"label": "London, England", "lat": 51.51, "lon": -0.13}],
        "concepts": ["clinical-medicine", "case-history", "nosology"],
    },
    "evt_locke_essay": {
        "locations": [{"label": "London, England", "lat": 51.51, "lon": -0.13}],
        "concepts": ["empiricism", "tabula-rasa", "epistemology"],
    },
    "evt_locke_government": {
        "locations": [{"label": "London, England", "lat": 51.51, "lon": -0.13}],
        "concepts": ["social-contract", "natural-rights", "liberalism"],
    },
    "evt_huygens_wave": {
        "locations": [{"label": "The Hague, Dutch Republic", "lat": 52.07, "lon": 4.3}],
        "concepts": ["wave-optics", "wavefront", "light"],
    },
    "evt_savery_steam_pump": {
        "locations": [{"label": "Modbury, England", "lat": 50.35, "lon": -3.89}],
        "concepts": ["steam-power", "vacuum", "mine-drainage"],
    },

    # ---- Modern (1700-1900) ----
    "evt_leibniz_binary": {
        "locations": [{"label": "Hanover, Holy Roman Empire", "lat": 52.37, "lon": 9.73}],
        "concepts": ["binary", "logic", "computation"],
    },
    "evt_linnaeus_systema": {
        "locations": [{"label": "Uppsala, Sweden", "lat": 59.86, "lon": 17.64}],
        "concepts": ["taxonomy", "binomial-nomenclature", "classification"],
    },
    "evt_euler_analysis": {
        "locations": [
            {"label": "Saint Petersburg, Russian Empire", "lat": 59.93, "lon": 30.36},
            {"label": "Berlin, Prussia", "lat": 52.52, "lon": 13.40},
        ],
        "concepts": ["analysis", "function", "notation"],
    },
    "evt_buffon_natural_history": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["natural-history", "encyclopedia", "deep-time"],
    },
    "evt_watt_steam_engine": {
        "locations": [{"label": "Birmingham, England", "lat": 52.48, "lon": -1.9}],
        "concepts": ["steam-engine", "separate-condenser", "industrial-revolution"],
    },
    "evt_priestley_oxygen": {
        "locations": [{"label": "Calne, England", "lat": 51.44, "lon": -2.01}],
        "concepts": ["oxygen", "gas", "combustion"],
    },
    "evt_kant_critique": {
        "locations": [{"label": "Königsberg, Prussia", "lat": 54.71, "lon": 20.51}],
        "concepts": ["transcendental", "epistemology", "synthetic-a-priori"],
    },
    "evt_hutton_deep_time": {
        "locations": [{"label": "Edinburgh, Scotland", "lat": 55.95, "lon": -3.19}],
        "concepts": ["deep-time", "uniformitarianism", "geology"],
    },
    "evt_lagrange_mechanics": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["analytical-mechanics", "variational-principle", "generalized-coordinates"],
    },
    "evt_jenner_smallpox_vaccine": {
        "locations": [{"label": "Berkeley, Gloucestershire, England", "lat": 51.69, "lon": -2.46}],
        "concepts": ["vaccination", "smallpox", "immunology"],
    },
    "evt_malthus_population": {
        "locations": [{"label": "Cambridge, England", "lat": 52.20, "lon": 0.12}],
        "concepts": ["population", "demography", "scarcity"],
    },
    "evt_volta_battery": {
        "locations": [{"label": "Pavia, Italy", "lat": 45.19, "lon": 9.16}],
        "concepts": ["battery", "electrochemistry", "current"],
    },
    "evt_young_double_slit": {
        "locations": [{"label": "London, England", "lat": 51.51, "lon": -0.13}],
        "concepts": ["interference", "wave-optics", "experiment"],
    },
    "evt_gauss_disquisitiones": {
        "locations": [{"label": "Göttingen, Kingdom of Hanover", "lat": 51.54, "lon": 9.93}],
        "concepts": ["number-theory", "modular-arithmetic", "quadratic-reciprocity"],
    },
    "evt_jacquard_loom": {
        "locations": [{"label": "Lyon, France", "lat": 45.76, "lon": 4.84}],
        "concepts": ["punched-card", "automation", "programmable"],
    },
    "evt_hegel_phenomenology": {
        "locations": [{"label": "Jena, Saxe-Weimar", "lat": 50.93, "lon": 11.59}],
        "concepts": ["dialectic", "idealism", "historical-process"],
    },
    "evt_dalton_atomic": {
        "locations": [{"label": "Manchester, England", "lat": 53.48, "lon": -2.24}],
        "concepts": ["atom", "atomic-weight", "chemistry"],
    },
    "evt_avogadro_molecules": {
        "locations": [{"label": "Turin, Kingdom of Sardinia", "lat": 45.07, "lon": 7.69}],
        "concepts": ["molecule", "mole", "gas"],
    },
    "evt_cuvier_paleontology": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["paleontology", "extinction", "comparative-anatomy"],
    },
    "evt_laplace_probability": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["probability", "celestial-mechanics", "central-limit"],
    },
    "evt_ricardo_political_economy": {
        "locations": [{"label": "London, England", "lat": 51.51, "lon": -0.13}],
        "concepts": ["political-economy", "comparative-advantage", "labor-theory-of-value"],
    },
    "evt_fourier_series": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["fourier-series", "heat-equation", "partial-differential-equation"],
    },
    "evt_babbage_difference_engine": {
        "locations": [{"label": "London, England", "lat": 51.51, "lon": -0.13}],
        "concepts": ["mechanical-computer", "programmable", "punched-card"],
    },
    "evt_braille": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["tactile-writing", "accessibility", "alphabet"],
    },
    "evt_carnot_thermodynamics": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["thermodynamics", "carnot-cycle", "heat-engine", "entropy"],
    },
    "evt_lyell_principles": {
        "locations": [{"label": "London, England", "lat": 51.51, "lon": -0.13}],
        "concepts": ["uniformitarianism", "deep-time", "geology"],
    },
    "evt_faraday_induction": {
        "locations": [{"label": "Royal Institution, London", "lat": 51.51, "lon": -0.14}],
        "concepts": ["electromagnetic-induction", "field", "electromagnetism"],
    },
    "evt_galois_groups": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["group-theory", "solvability", "abstract-algebra"],
    },
    "evt_comte_positivism": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["positivism", "sociology", "philosophy-of-science"],
    },
    "evt_non_euclidean_geometry": {
        "locations": [
            {"label": "Kazan, Russia", "lat": 55.78, "lon": 49.12},
            {"label": "Cluj, Transylvania", "lat": 46.77, "lon": 23.6},
        ],
        "concepts": ["geometry", "parallel-postulate", "axiom"],
    },
    "evt_schleiden_schwann_cell": {
        "locations": [
            {"label": "Jena, Saxony", "lat": 50.93, "lon": 11.59},
            {"label": "Berlin, Prussia", "lat": 52.52, "lon": 13.40},
        ],
        "concepts": ["cell-theory", "cytology"],
    },
    "evt_agassiz_ice_ages": {
        "locations": [{"label": "Neuchâtel, Switzerland", "lat": 46.99, "lon": 6.93}],
        "concepts": ["glaciation", "ice-age", "paleoclimate"],
    },
    "evt_daguerreotype": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["photography", "imaging", "silver-halide"],
    },
    "evt_ada_lovelace": {
        "locations": [{"label": "London, England", "lat": 51.51, "lon": -0.13}],
        "concepts": ["algorithm", "programmable-machine", "computation"],
    },
    "evt_telegraph_morse": {
        "locations": [{"label": "Washington-Baltimore, USA", "lat": 39.06, "lon": -76.81}],
        "concepts": ["telegraph", "morse-code", "long-distance-communication"],
    },
    "evt_humboldt_kosmos": {
        "locations": [{"label": "Berlin, Prussia", "lat": 52.52, "lon": 13.40}],
        "concepts": ["geography", "biogeography", "earth-system"],
    },
    "evt_morton_anesthesia": {
        "locations": [{"label": "Massachusetts General Hospital, Boston", "lat": 42.36, "lon": -71.07}],
        "concepts": ["anesthesia", "surgery", "ether"],
    },
    "evt_helmholtz_energy": {
        "locations": [{"label": "Berlin, Prussia", "lat": 52.52, "lon": 13.40}],
        "concepts": ["energy-conservation", "thermodynamics"],
    },
    "evt_semmelweis_handwashing": {
        "locations": [{"label": "Vienna, Austrian Empire", "lat": 48.21, "lon": 16.37}],
        "concepts": ["antisepsis", "public-health", "epidemiology"],
    },
    "evt_marx_capital": {
        "locations": [{"label": "London, England", "lat": 51.51, "lon": -0.13}],
        "concepts": ["political-economy", "labor-theory-of-value", "surplus-value", "capital"],
    },
    "evt_boole_logic": {
        "locations": [{"label": "Cork, Ireland", "lat": 51.9, "lon": -8.47}],
        "concepts": ["boolean-algebra", "logic", "binary"],
    },
    "evt_snow_cholera": {
        "locations": [{"label": "Soho, London", "lat": 51.514, "lon": -0.135}],
        "concepts": ["epidemiology", "spatial-statistics", "cholera"],
    },
    "evt_riemann_geometry": {
        "locations": [{"label": "Göttingen, Kingdom of Hanover", "lat": 51.54, "lon": 9.93}],
        "concepts": ["geometry", "manifold", "metric", "curvature"],
    },
    "evt_bessemer_steel": {
        "locations": [{"label": "Sheffield, England", "lat": 53.38, "lon": -1.47}],
        "concepts": ["steel", "bessemer-process", "industrial-revolution"],
    },
    "evt_nightingale_statistics": {
        "locations": [
            {"label": "Scutari (Üsküdar), Ottoman Empire", "lat": 41.02, "lon": 29.02},
            {"label": "London, England", "lat": 51.51, "lon": -0.13},
        ],
        "concepts": ["statistics", "nursing", "public-health"],
    },
    "evt_mill_liberty": {
        "locations": [{"label": "London, England", "lat": 51.51, "lon": -0.13}],
        "concepts": ["liberty", "utilitarianism", "liberalism"],
    },
    "evt_kekule_benzene": {
        "locations": [{"label": "Ghent, Belgium", "lat": 51.05, "lon": 3.72}],
        "concepts": ["organic-chemistry", "benzene", "structural-formula"],
    },
    "evt_mendel_genetics": {
        "locations": [{"label": "Brno, Moravia", "lat": 49.20, "lon": 16.61}],
        "concepts": ["genetics", "inheritance", "mendelian"],
    },
    "evt_clausius_entropy": {
        "locations": [{"label": "Zürich, Switzerland", "lat": 47.37, "lon": 8.54}],
        "concepts": ["entropy", "second-law", "thermodynamics"],
    },
    "evt_typewriter_sholes": {
        "locations": [{"label": "Milwaukee, USA", "lat": 43.04, "lon": -87.91}],
        "concepts": ["typewriter", "qwerty", "communication"],
    },
    "evt_cantor_set_theory": {
        "locations": [{"label": "Halle, Prussia", "lat": 51.48, "lon": 11.97}],
        "concepts": ["set-theory", "infinity", "cardinality"],
    },
    "evt_otto_internal_combustion": {
        "locations": [{"label": "Deutz, Germany", "lat": 50.94, "lon": 7.01}],
        "concepts": ["internal-combustion", "four-stroke", "engine"],
    },
    "evt_bell_telephone": {
        "locations": [{"label": "Boston, USA", "lat": 42.36, "lon": -71.06}],
        "concepts": ["telephone", "voice-transmission", "telecommunications"],
    },
    "evt_phonograph_edison": {
        "locations": [{"label": "Menlo Park, NJ, USA", "lat": 40.55, "lon": -74.33}],
        "concepts": ["sound-recording", "audio"],
    },
    "evt_edison_light": {
        "locations": [{"label": "Menlo Park, NJ, USA", "lat": 40.55, "lon": -74.33}],
        "concepts": ["incandescent-bulb", "electrification", "grid"],
    },
    "evt_frege_predicate_logic": {
        "locations": [{"label": "Jena, Germany", "lat": 50.93, "lon": 11.59}],
        "concepts": ["predicate-logic", "quantifier", "logic"],
    },
    "evt_pasteur_rabies_vaccine": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["vaccine", "attenuation", "rabies"],
    },
    "evt_michelson_morley": {
        "locations": [{"label": "Cleveland, USA", "lat": 41.5, "lon": -81.69}],
        "concepts": ["interferometer", "aether", "relativity"],
    },
    "evt_boas_anthropology": {
        "locations": [{"label": "New York, USA", "lat": 40.71, "lon": -74.01}],
        "concepts": ["cultural-anthropology", "fieldwork", "historical-particularism"],
    },
    "evt_tesla_ac": {
        "locations": [{"label": "Pittsburgh, USA", "lat": 40.44, "lon": -79.99}],
        "concepts": ["alternating-current", "electric-motor", "grid"],
    },
    "evt_cajal_neuron_doctrine": {
        "locations": [{"label": "Madrid, Spain", "lat": 40.41, "lon": -3.7}],
        "concepts": ["neuron-doctrine", "neuroscience", "synapse"],
    },
    "evt_william_james_psychology": {
        "locations": [{"label": "Cambridge, MA, USA", "lat": 42.37, "lon": -71.11}],
        "concepts": ["psychology", "stream-of-consciousness", "pragmatism"],
    },
    "evt_durkheim_division_labor": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["sociology", "solidarity", "anomie"],
    },
    "evt_roentgen_xrays": {
        "locations": [{"label": "Würzburg, German Empire", "lat": 49.79, "lon": 9.93}],
        "concepts": ["x-ray", "radiation", "imaging"],
    },
    "evt_becquerel_radioactivity": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["radioactivity", "uranium", "nuclear-physics"],
    },
    "evt_arrhenius_climate": {
        "locations": [{"label": "Stockholm, Sweden", "lat": 59.33, "lon": 18.07}],
        "concepts": ["climate-sensitivity", "co2", "greenhouse-effect"],
    },
    "evt_pavlov_conditioning": {
        "locations": [{"label": "Saint Petersburg, Russia", "lat": 59.93, "lon": 30.36}],
        "concepts": ["classical-conditioning", "psychology", "reflex"],
    },
    "evt_aspirin_bayer": {
        "locations": [{"label": "Wuppertal-Elberfeld, Germany", "lat": 51.26, "lon": 7.15}],
        "concepts": ["pharmacology", "acetylsalicylic-acid"],
    },
    "evt_curie_radium": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["radioactivity", "radium", "polonium", "radiochemistry"],
    },
    "evt_freud_interpretation_dreams": {
        "locations": [{"label": "Vienna, Austria-Hungary", "lat": 48.21, "lon": 16.37}],
        "concepts": ["psychoanalysis", "unconscious", "dream"],
    },
    "evt_planck_quantum": {
        "locations": [{"label": "Berlin, German Empire", "lat": 52.52, "lon": 13.40}],
        "concepts": ["quantization", "blackbody", "quantum-theory"],
    },

    # ---- Contemporary (1900-2026) ----
    "evt_wright_brothers": {
        "locations": [{"label": "Kitty Hawk, NC, USA", "lat": 36.06, "lon": -75.7}],
        "concepts": ["powered-flight", "aerodynamics", "aviation"],
    },
    "evt_einstein_special_relativity": {
        "locations": [{"label": "Bern, Switzerland", "lat": 46.95, "lon": 7.45}],
        "concepts": ["special-relativity", "speed-of-light", "spacetime"],
    },
    "evt_einstein_photoelectric": {
        "locations": [{"label": "Bern, Switzerland", "lat": 46.95, "lon": 7.45}],
        "concepts": ["photon", "quantum-theory", "photoelectric-effect"],
    },
    "evt_weber_protestant_ethic": {
        "locations": [{"label": "Heidelberg, German Empire", "lat": 49.41, "lon": 8.71}],
        "concepts": ["sociology", "capitalism", "religion"],
    },
    "evt_bakelite": {
        "locations": [{"label": "Yonkers, NY, USA", "lat": 40.93, "lon": -73.9}],
        "concepts": ["polymer", "synthetic-plastic", "phenol-formaldehyde"],
    },
    "evt_haber_bosch": {
        "locations": [{"label": "Karlsruhe / Ludwigshafen, Germany", "lat": 49.49, "lon": 8.43}],
        "concepts": ["ammonia-synthesis", "nitrogen-fixation", "industrial-chemistry", "fertilizer"],
    },
    "evt_russell_whitehead_principia": {
        "locations": [{"label": "Cambridge, England", "lat": 52.20, "lon": 0.12}],
        "concepts": ["logicism", "foundations-of-mathematics", "logic"],
    },
    "evt_rutherford_nucleus": {
        "locations": [{"label": "Manchester, England", "lat": 53.48, "lon": -2.24}],
        "concepts": ["nucleus", "atomic-physics", "alpha-scattering"],
    },
    "evt_wegener_continental_drift": {
        "locations": [{"label": "Marburg, Germany", "lat": 50.81, "lon": 8.77}],
        "concepts": ["continental-drift", "plate-tectonics", "geology"],
    },
    "evt_bohr_atom": {
        "locations": [{"label": "Copenhagen, Denmark", "lat": 55.68, "lon": 12.57}],
        "concepts": ["bohr-model", "quantum-theory", "atomic-physics"],
    },
    "evt_husserl_phenomenology": {
        "locations": [{"label": "Göttingen / Freiburg, Germany", "lat": 51.54, "lon": 9.93}],
        "concepts": ["phenomenology", "intentionality", "philosophy-of-mind"],
    },
    "evt_ford_assembly_line": {
        "locations": [{"label": "Highland Park, MI, USA", "lat": 42.41, "lon": -83.1}],
        "concepts": ["mass-production", "assembly-line", "manufacturing"],
    },
    "evt_morgan_chromosomes": {
        "locations": [{"label": "Columbia University, NY, USA", "lat": 40.81, "lon": -73.96}],
        "concepts": ["chromosome", "genetics", "drosophila"],
    },
    "evt_saussure_linguistics": {
        "locations": [{"label": "Geneva, Switzerland", "lat": 46.20, "lon": 6.14}],
        "concepts": ["structural-linguistics", "sign", "semiotics"],
    },
    "evt_keynes_consequences": {
        "locations": [{"label": "Cambridge, England", "lat": 52.20, "lon": 0.12}],
        "concepts": ["macroeconomics", "international-economics"],
    },
    "evt_hubble_expansion": {
        "locations": [{"label": "Mount Wilson Observatory, CA, USA", "lat": 34.22, "lon": -118.06}],
        "concepts": ["redshift", "cosmic-expansion", "cosmology"],
    },
    "evt_milankovitch_cycles": {
        "locations": [{"label": "Belgrade, Yugoslavia", "lat": 44.79, "lon": 20.45}],
        "concepts": ["orbital-forcing", "paleoclimate", "ice-age"],
    },
    "evt_television": {
        "locations": [{"label": "San Francisco, USA", "lat": 37.77, "lon": -122.42}],
        "concepts": ["television", "broadcast", "imaging"],
    },
    "evt_lemaitre_big_bang": {
        "locations": [{"label": "Leuven, Belgium", "lat": 50.88, "lon": 4.7}],
        "concepts": ["big-bang", "cosmology", "expansion"],
    },
    "evt_heidegger_being_time": {
        "locations": [{"label": "Freiburg, Germany", "lat": 47.99, "lon": 7.85}],
        "concepts": ["existential-philosophy", "dasein", "ontology"],
    },
    "evt_dirac_equation": {
        "locations": [{"label": "Cambridge, England", "lat": 52.20, "lon": 0.12}],
        "concepts": ["dirac-equation", "antimatter", "relativistic-quantum"],
    },
    "evt_fleming_penicillin": {
        "locations": [{"label": "St Mary's Hospital, London", "lat": 51.52, "lon": -0.17}],
        "concepts": ["antibiotic", "penicillin", "pharmacology"],
    },
    "evt_banting_insulin": {
        "locations": [{"label": "Toronto, Canada", "lat": 43.65, "lon": -79.38}],
        "concepts": ["insulin", "diabetes", "endocrinology"],
    },
    "evt_chandrasekhar_white_dwarf": {
        "locations": [{"label": "Cambridge, England", "lat": 52.20, "lon": 0.12}],
        "concepts": ["white-dwarf", "stellar-evolution", "chandrasekhar-limit"],
    },
    "evt_godel_incompleteness": {
        "locations": [{"label": "Vienna, Austria", "lat": 48.21, "lon": 16.37}],
        "concepts": ["incompleteness", "formal-system", "logic"],
    },
    "evt_zwicky_dark_matter": {
        "locations": [{"label": "Pasadena, CA, USA", "lat": 34.15, "lon": -118.14}],
        "concepts": ["dark-matter", "galactic-dynamics", "cosmology"],
    },
    "evt_popper_falsifiability": {
        "locations": [{"label": "Vienna, Austria", "lat": 48.21, "lon": 16.37}],
        "concepts": ["falsifiability", "philosophy-of-science", "demarcation"],
    },
    "evt_keynes_general_theory": {
        "locations": [{"label": "Cambridge, England", "lat": 52.20, "lon": 0.12}],
        "concepts": ["macroeconomics", "aggregate-demand", "fiscal-policy"],
    },
    "evt_piaget_developmental": {
        "locations": [{"label": "Geneva, Switzerland", "lat": 46.20, "lon": 6.14}],
        "concepts": ["developmental-psychology", "cognitive-stage"],
    },
    "evt_xerography": {
        "locations": [{"label": "Astoria, NY, USA", "lat": 40.77, "lon": -73.92}],
        "concepts": ["copying", "electrostatic", "office-automation"],
    },
    "evt_pauling_chemical_bond": {
        "locations": [{"label": "Caltech, Pasadena, CA, USA", "lat": 34.14, "lon": -118.12}],
        "concepts": ["chemical-bond", "quantum-chemistry", "electronegativity"],
    },
    "evt_jet_engine": {
        "locations": [
            {"label": "Cranwell, England", "lat": 53.04, "lon": -0.49},
            {"label": "Rostock, Germany", "lat": 54.09, "lon": 12.14},
        ],
        "concepts": ["jet-propulsion", "turbojet", "aerospace"],
    },
    "evt_modern_synthesis": {
        "locations": [{"label": "USA / Europe", "lat": 40.0, "lon": -74.0}],
        "concepts": ["modern-synthesis", "evolution", "population-genetics"],
    },
    "evt_fermi_chain_reaction": {
        "locations": [{"label": "University of Chicago, USA", "lat": 41.79, "lon": -87.60}],
        "concepts": ["fission", "chain-reaction", "nuclear-physics"],
    },
    "evt_von_neumann_game_theory": {
        "locations": [{"label": "Princeton, NJ, USA", "lat": 40.35, "lon": -74.66}],
        "concepts": ["game-theory", "expected-utility", "strategic-interaction"],
    },
    "evt_von_neumann_architecture": {
        "locations": [{"label": "Princeton, NJ, USA", "lat": 40.35, "lon": -74.66}],
        "concepts": ["stored-program", "computer-architecture", "edvac"],
    },
    "evt_eniac": {
        "locations": [{"label": "University of Pennsylvania, USA", "lat": 39.95, "lon": -75.19}],
        "concepts": ["vacuum-tube", "general-purpose-computer", "early-computing"],
    },
    "evt_radiocarbon_dating": {
        "locations": [{"label": "University of Chicago, USA", "lat": 41.79, "lon": -87.60}],
        "concepts": ["radiocarbon", "geochronology", "archaeology"],
    },
    "evt_arendt_origins": {
        "locations": [{"label": "New York, USA", "lat": 40.71, "lon": -74.01}],
        "concepts": ["totalitarianism", "political-theory"],
    },
    "evt_arrow_impossibility": {
        "locations": [{"label": "Stanford, CA, USA", "lat": 37.43, "lon": -122.17}],
        "concepts": ["social-choice", "voting", "impossibility-theorem"],
    },
    "evt_quine_two_dogmas": {
        "locations": [{"label": "Harvard, Cambridge, MA, USA", "lat": 42.37, "lon": -71.12}],
        "concepts": ["analytic-synthetic", "naturalized-epistemology"],
    },
    "evt_skinner_operant": {
        "locations": [{"label": "Harvard, Cambridge, MA, USA", "lat": 42.37, "lon": -71.12}],
        "concepts": ["operant-conditioning", "behaviorism", "reinforcement"],
    },
    "evt_polio_vaccine": {
        "locations": [{"label": "Pittsburgh / Cincinnati, USA", "lat": 40.44, "lon": -79.99}],
        "concepts": ["polio-vaccine", "immunology", "public-health"],
    },
    "evt_levi_strauss_structuralism": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["structuralism", "anthropology", "myth"],
    },
    "evt_chomsky_syntactic_structures": {
        "locations": [{"label": "MIT, Cambridge, MA, USA", "lat": 42.36, "lon": -71.09}],
        "concepts": ["generative-grammar", "syntax", "linguistics", "universal-grammar"],
    },
    "evt_sputnik": {
        "locations": [{"label": "Baikonur, Soviet Union", "lat": 45.92, "lon": 63.34}],
        "concepts": ["satellite", "space-age", "rocketry"],
    },
    "evt_fortran": {
        "locations": [{"label": "IBM, NY, USA", "lat": 41.11, "lon": -73.72}],
        "concepts": ["high-level-language", "compiler", "scientific-computing"],
    },
    "evt_keeling_curve": {
        "locations": [{"label": "Mauna Loa Observatory, Hawai'i", "lat": 19.54, "lon": -155.58}],
        "concepts": ["co2", "climate", "anthropogenic-warming"],
    },
    "evt_lisp_mccarthy": {
        "locations": [{"label": "MIT, Cambridge, MA, USA", "lat": 42.36, "lon": -71.09}],
        "concepts": ["lisp", "symbolic-computing", "ai", "recursion"],
    },
    "evt_integrated_circuit": {
        "locations": [
            {"label": "Texas Instruments, Dallas, USA", "lat": 32.95, "lon": -96.83},
            {"label": "Fairchild, Mountain View, CA, USA", "lat": 37.42, "lon": -122.08},
        ],
        "concepts": ["integrated-circuit", "semiconductor", "moores-law"],
    },
    "evt_oral_contraceptive": {
        "locations": [{"label": "Worcester, MA, USA", "lat": 42.26, "lon": -71.8}],
        "concepts": ["contraception", "hormonal-therapy", "reproductive-health"],
    },
    "evt_jacob_monod_operon": {
        "locations": [{"label": "Pasteur Institute, Paris", "lat": 48.84, "lon": 2.31}],
        "concepts": ["gene-regulation", "operon", "molecular-biology"],
    },
    "evt_milgram_obedience": {
        "locations": [{"label": "Yale University, USA", "lat": 41.31, "lon": -72.93}],
        "concepts": ["social-psychology", "obedience", "authority"],
    },
    "evt_kuhn_paradigm_shifts": {
        "locations": [{"label": "Berkeley, CA, USA", "lat": 37.87, "lon": -122.26}],
        "concepts": ["paradigm-shift", "philosophy-of-science", "scientific-revolution"],
    },
    "evt_silent_spring": {
        "locations": [{"label": "Springdale, PA, USA", "lat": 40.55, "lon": -79.78}],
        "concepts": ["ecology", "pesticide", "environmental-movement"],
    },
    "evt_cmb_penzias_wilson": {
        "locations": [{"label": "Holmdel, NJ, USA", "lat": 40.39, "lon": -74.18}],
        "concepts": ["cmb", "big-bang", "cosmology"],
    },
    "evt_foucault_archaeology": {
        "locations": [{"label": "Paris, France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["power-knowledge", "discourse", "genealogy"],
    },
    "evt_first_heart_transplant": {
        "locations": [{"label": "Groote Schuur Hospital, Cape Town", "lat": -33.94, "lon": 18.46}],
        "concepts": ["transplantation", "surgery", "immunosuppression"],
    },
    "evt_apollo_moon": {
        "locations": [
            {"label": "Cape Kennedy, FL, USA", "lat": 28.48, "lon": -80.55},
            {"label": "Sea of Tranquility, Moon", "lat": 0.67, "lon": 23.47},
        ],
        "concepts": ["space-program", "moon-landing", "aerospace"],
    },
    "evt_unix_operating_system": {
        "locations": [{"label": "Bell Labs, Murray Hill, NJ, USA", "lat": 40.68, "lon": -74.40}],
        "concepts": ["unix", "operating-system", "portable"],
    },
    "evt_codd_relational_db": {
        "locations": [{"label": "IBM San Jose, CA, USA", "lat": 37.24, "lon": -121.79}],
        "concepts": ["relational-model", "database", "query-language"],
    },
    "evt_optical_fiber_communications": {
        "locations": [{"label": "Corning, NY, USA", "lat": 42.14, "lon": -77.05}],
        "concepts": ["optical-fiber", "telecommunications", "low-loss"],
    },
    "evt_microprocessor_4004": {
        "locations": [{"label": "Intel, Santa Clara, CA, USA", "lat": 37.35, "lon": -121.96}],
        "concepts": ["microprocessor", "cpu", "integrated-circuit"],
    },
    "evt_email_tomlinson": {
        "locations": [{"label": "BBN, Cambridge, MA, USA", "lat": 42.39, "lon": -71.14}],
        "concepts": ["email", "arpanet", "messaging"],
    },
    "evt_ct_scan": {
        "locations": [{"label": "EMI, London", "lat": 51.51, "lon": -0.13}],
        "concepts": ["computed-tomography", "imaging", "x-ray"],
    },
    "evt_ethernet": {
        "locations": [{"label": "Xerox PARC, Palo Alto, CA, USA", "lat": 37.40, "lon": -122.15}],
        "concepts": ["local-area-network", "ethernet", "csma-cd"],
    },
    "evt_diffie_hellman_publickey": {
        "locations": [{"label": "Stanford, CA, USA", "lat": 37.43, "lon": -122.17}],
        "concepts": ["public-key", "cryptography", "key-exchange"],
    },
    "evt_personal_computer_apple_ii": {
        "locations": [{"label": "Cupertino, CA, USA", "lat": 37.32, "lon": -122.03}],
        "concepts": ["personal-computer", "consumer-electronics"],
    },
    "evt_first_test_tube_baby": {
        "locations": [{"label": "Oldham, England", "lat": 53.54, "lon": -2.12}],
        "concepts": ["ivf", "reproductive-medicine", "fertility"],
    },
    "evt_kahneman_tversky_prospect": {
        "locations": [
            {"label": "Hebrew University, Jerusalem", "lat": 31.78, "lon": 35.2},
            {"label": "Stanford, CA, USA", "lat": 37.43, "lon": -122.17},
        ],
        "concepts": ["behavioral-economics", "prospect-theory", "decision-making"],
    },
    "evt_smallpox_eradication": {
        "locations": [{"label": "World Health Organization", "lat": 46.23, "lon": 6.13}],
        "concepts": ["eradication", "vaccine", "public-health"],
    },
    "evt_alvarez_chicxulub": {
        "locations": [{"label": "Berkeley, CA, USA", "lat": 37.87, "lon": -122.26}, {"label": "Chicxulub crater, Yucatán", "lat": 21.4, "lon": -89.5}],
        "concepts": ["impact-event", "extinction", "iridium"],
    },
    "evt_inflation_guth": {
        "locations": [{"label": "MIT, Cambridge, MA, USA", "lat": 42.36, "lon": -71.09}],
        "concepts": ["inflation", "cosmology", "early-universe"],
    },
    "evt_internet_protocol_tcpip": {
        "locations": [{"label": "Stanford / ARPA, USA", "lat": 37.43, "lon": -122.17}],
        "concepts": ["tcp-ip", "internet", "protocol"],
    },
    "evt_pcr_mullis": {
        "locations": [{"label": "Cetus Corp, Emeryville, CA, USA", "lat": 37.83, "lon": -122.28}],
        "concepts": ["pcr", "amplification", "molecular-biology"],
    },
    "evt_hiv_aids_discovery": {
        "locations": [
            {"label": "Pasteur Institute, Paris", "lat": 48.84, "lon": 2.31},
            {"label": "NIH, Bethesda, MD, USA", "lat": 38.99, "lon": -77.10},
        ],
        "concepts": ["hiv", "aids", "virology", "retrovirus"],
    },
    "evt_dna_fingerprinting": {
        "locations": [{"label": "University of Leicester, England", "lat": 52.62, "lon": -1.13}],
        "concepts": ["dna-fingerprinting", "minisatellite", "forensics"],
    },
    "evt_helicobacter_ulcers": {
        "locations": [{"label": "Perth, Australia", "lat": -31.95, "lon": 115.86}],
        "concepts": ["microbiology", "ulcer", "etiology"],
    },
    "evt_3d_printing_emergence": {
        "locations": [{"label": "Valencia, CA, USA", "lat": 34.44, "lon": -118.56}],
        "concepts": ["additive-manufacturing", "stereolithography", "3d-printing"],
    },
    "evt_ozone_hole_discovery": {
        "locations": [{"label": "Halley Research Station, Antarctica", "lat": -75.6, "lon": -26.5}],
        "concepts": ["ozone-depletion", "cfc", "atmospheric-chemistry"],
    },
    "evt_buckminsterfullerene": {
        "locations": [{"label": "Rice University, Houston, USA", "lat": 29.72, "lon": -95.40}],
        "concepts": ["fullerene", "nanocarbon", "allotrope"],
    },
    "evt_amartya_sen_capabilities": {
        "locations": [
            {"label": "Cambridge, MA, USA", "lat": 42.37, "lon": -71.12},
            {"label": "Delhi, India", "lat": 28.61, "lon": 77.21},
        ],
        "concepts": ["capability-approach", "welfare", "development"],
    },
    "evt_world_wide_web": {
        "locations": [{"label": "CERN, Geneva, Switzerland", "lat": 46.23, "lon": 6.05}],
        "concepts": ["web", "http", "hypertext"],
    },
    "evt_gene_therapy_first": {
        "locations": [{"label": "NIH, Bethesda, MD, USA", "lat": 38.99, "lon": -77.10}],
        "concepts": ["gene-therapy", "ada-scid", "retroviral-vector"],
    },
    "evt_fmri": {
        "locations": [{"label": "Bell Labs, Murray Hill, NJ, USA", "lat": 40.68, "lon": -74.40}],
        "concepts": ["fmri", "bold", "neuroimaging"],
    },
    "evt_ipcc_first_report": {
        "locations": [{"label": "IPCC (UN/WMO)", "lat": 46.23, "lon": 6.13}],
        "concepts": ["climate-change", "policy", "assessment"],
    },
    "evt_linux_open_source": {
        "locations": [{"label": "Helsinki, Finland", "lat": 60.17, "lon": 24.94}],
        "concepts": ["linux", "open-source", "operating-system"],
    },
    "evt_lithium_ion_battery": {
        "locations": [
            {"label": "Sony, Tokyo", "lat": 35.68, "lon": 139.65},
            {"label": "Oxford, England", "lat": 51.75, "lon": -1.26},
        ],
        "concepts": ["battery", "lithium-ion", "electrochemistry"],
    },
    "evt_snowball_earth": {
        "locations": [{"label": "Caltech, Pasadena, CA, USA", "lat": 34.14, "lon": -118.12}],
        "concepts": ["snowball-earth", "paleoclimate", "glaciation"],
    },
    "evt_shor_quantum": {
        "locations": [{"label": "Bell Labs, Murray Hill, NJ, USA", "lat": 40.68, "lon": -74.40}],
        "concepts": ["shors-algorithm", "quantum-computing", "factoring"],
    },
    "evt_gps_operational": {
        "locations": [{"label": "US Department of Defense", "lat": 38.88, "lon": -77.0}],
        "concepts": ["gps", "navigation", "satellite"],
    },
    "evt_dolly_clone": {
        "locations": [{"label": "Roslin Institute, Scotland", "lat": 55.87, "lon": -3.18}],
        "concepts": ["cloning", "somatic-cell-nuclear-transfer", "reprogramming"],
    },
    "evt_diamond_guns_germs": {
        "locations": [{"label": "UCLA, Los Angeles, USA", "lat": 34.07, "lon": -118.44}],
        "concepts": ["world-history", "geography", "ecology"],
    },
    "evt_pagerank_google": {
        "locations": [{"label": "Stanford, CA, USA", "lat": 37.43, "lon": -122.17}],
        "concepts": ["pagerank", "information-retrieval", "search"],
    },
    "evt_anthropocene_concept": {
        "locations": [{"label": "Mainz / Cambridge", "lat": 49.99, "lon": 8.27}],
        "concepts": ["anthropocene", "earth-system", "geological-epoch"],
    },
    "evt_putnam_bowling_alone": {
        "locations": [{"label": "Harvard, Cambridge, MA, USA", "lat": 42.37, "lon": -71.12}],
        "concepts": ["social-capital", "civic-society", "sociology"],
    },
    "evt_human_genome": {
        "locations": [
            {"label": "NIH, Bethesda, MD, USA", "lat": 38.99, "lon": -77.10},
            {"label": "Celera, Rockville, MD, USA", "lat": 39.08, "lon": -77.16},
        ],
        "concepts": ["human-genome", "sequencing", "genomics"],
    },
    "evt_wikipedia": {
        "locations": [{"label": "Wikimedia Foundation, San Francisco", "lat": 37.77, "lon": -122.42}],
        "concepts": ["wiki", "open-knowledge", "encyclopedia"],
    },
    "evt_facebook_social_graph": {
        "locations": [{"label": "Menlo Park, CA, USA", "lat": 37.45, "lon": -122.18}],
        "concepts": ["social-graph", "platform", "network"],
    },
    "evt_graphene": {
        "locations": [{"label": "University of Manchester, England", "lat": 53.47, "lon": -2.23}],
        "concepts": ["graphene", "two-dimensional-material", "nanocarbon"],
    },
    "evt_optogenetics": {
        "locations": [{"label": "Stanford, CA, USA", "lat": 37.43, "lon": -122.17}],
        "concepts": ["optogenetics", "channelrhodopsin", "neuroscience"],
    },
    "evt_yamanaka_ips": {
        "locations": [{"label": "Kyoto University, Japan", "lat": 35.03, "lon": 135.78}],
        "concepts": ["ips-cells", "reprogramming", "stem-cells"],
    },
    "evt_aws_cloud": {
        "locations": [{"label": "Amazon, Seattle, USA", "lat": 47.61, "lon": -122.34}],
        "concepts": ["cloud-computing", "iaas", "elastic-compute"],
    },
    "evt_iphone_smartphone": {
        "locations": [{"label": "Apple, Cupertino, CA, USA", "lat": 37.33, "lon": -122.03}],
        "concepts": ["smartphone", "mobile", "touchscreen"],
    },
    "evt_microbiome_studies": {
        "locations": [{"label": "NIH-HMP / MetaHIT (EU)", "lat": 50.0, "lon": 5.0}],
        "concepts": ["microbiome", "16s-rrna", "metagenomics"],
    },
    "evt_bitcoin_blockchain": {
        "locations": [{"label": "Internet (pseudonymous)", "lat": 0.0, "lon": 0.0}],
        "concepts": ["blockchain", "cryptocurrency", "proof-of-work"],
    },
    "evt_imagenet_dataset": {
        "locations": [{"label": "Stanford / Princeton, USA", "lat": 37.43, "lon": -122.17}],
        "concepts": ["dataset", "image-classification", "supervised-learning"],
    },
    "evt_immunotherapy_checkpoint": {
        "locations": [
            {"label": "MD Anderson, Houston, USA", "lat": 29.71, "lon": -95.40},
            {"label": "Kyoto University, Japan", "lat": 35.03, "lon": 135.78},
        ],
        "concepts": ["immunotherapy", "checkpoint-inhibitor", "oncology"],
    },
    "evt_higgs_boson": {
        "locations": [{"label": "CERN LHC, Geneva", "lat": 46.23, "lon": 6.05}],
        "concepts": ["higgs-boson", "particle-physics", "standard-model"],
    },
    "evt_ligo_gravitational_waves": {
        "locations": [
            {"label": "LIGO Hanford, WA, USA", "lat": 46.45, "lon": -119.41},
            {"label": "LIGO Livingston, LA, USA", "lat": 30.56, "lon": -90.77},
        ],
        "concepts": ["gravitational-wave", "interferometer", "general-relativity"],
    },
    "evt_alphago": {
        "locations": [{"label": "DeepMind, London", "lat": 51.53, "lon": -0.13}],
        "concepts": ["reinforcement-learning", "monte-carlo-tree-search", "deep-learning"],
    },
    "evt_neural_machine_translation": {
        "locations": [{"label": "Google, Mountain View, CA, USA", "lat": 37.42, "lon": -122.08}],
        "concepts": ["machine-translation", "sequence-to-sequence", "deep-learning"],
    },
    "evt_reusable_rocket": {
        "locations": [{"label": "SpaceX, Hawthorne, CA, USA", "lat": 33.92, "lon": -118.33}],
        "concepts": ["reusable-rocket", "vertical-landing", "aerospace"],
    },
    "evt_quantum_supremacy": {
        "locations": [{"label": "Google, Santa Barbara, CA, USA", "lat": 34.42, "lon": -119.7}],
        "concepts": ["quantum-supremacy", "quantum-computing", "sycamore"],
    },
    "evt_mrna_covid_vaccine": {
        "locations": [
            {"label": "BioNTech, Mainz, Germany", "lat": 49.99, "lon": 8.27},
            {"label": "Moderna, Cambridge, MA, USA", "lat": 42.37, "lon": -71.10},
        ],
        "concepts": ["mrna-vaccine", "covid-19", "vaccinology"],
    },
    "evt_alphafold": {
        "locations": [{"label": "DeepMind, London", "lat": 51.53, "lon": -0.13}],
        "concepts": ["protein-structure", "deep-learning", "attention", "structural-biology"],
    },
    "evt_diffusion_image_models": {
        "locations": [{"label": "Stability AI / OpenAI", "lat": 37.77, "lon": -122.42}],
        "concepts": ["diffusion-model", "generative-ai", "image-synthesis"],
    },
    "evt_chatgpt": {
        "locations": [{"label": "OpenAI, San Francisco, USA", "lat": 37.77, "lon": -122.42}],
        "concepts": ["llm", "chat-interface", "instruction-tuning"],
    },
    "evt_multimodal_foundation_models": {
        "locations": [{"label": "OpenAI / Anthropic / Google", "lat": 37.77, "lon": -122.42}],
        "concepts": ["multimodal", "foundation-model", "deep-learning"],
    },
    "evt_agentic_ai": {
        "locations": [{"label": "frontier AI labs (SF / London)", "lat": 37.77, "lon": -122.42}],
        "concepts": ["ai-agent", "tool-use", "planning"],
    },
    "evt_quantum_error_correction": {
        "locations": [
            {"label": "Google Quantum, Santa Barbara, USA", "lat": 34.42, "lon": -119.7},
            {"label": "Quantinuum / IBM Quantum", "lat": 41.11, "lon": -73.72},
        ],
        "concepts": ["quantum-error-correction", "surface-code", "fault-tolerance"],
    },
    "evt_glp1_obesity": {
        "locations": [
            {"label": "Novo Nordisk, Denmark", "lat": 55.79, "lon": 12.51},
            {"label": "Eli Lilly, Indianapolis, USA", "lat": 39.77, "lon": -86.16},
        ],
        "concepts": ["glp1", "obesity", "endocrinology"],
    },
    "evt_base_editing_prime": {
        "locations": [{"label": "Broad Institute, Cambridge, MA, USA", "lat": 42.36, "lon": -71.10}],
        "concepts": ["base-editing", "prime-editing", "crispr"],
    },
    "evt_paabo_paleogenomics": {
        "locations": [{"label": "Max Planck Institute, Leipzig, Germany", "lat": 51.34, "lon": 12.37}],
        "concepts": ["paleogenomics", "neanderthal", "ancient-dna"],
    },
    "evt_brain_computer_interfaces": {
        "locations": [
            {"label": "Neuralink, Fremont, CA, USA", "lat": 37.55, "lon": -121.99},
            {"label": "Synchron, Brooklyn, NY, USA", "lat": 40.68, "lon": -73.95},
        ],
        "concepts": ["brain-computer-interface", "neural-prosthetic", "neuroengineering"],
    },
    "evt_unicode": {
        "locations": [{"label": "Unicode Consortium, Mountain View, USA", "lat": 37.42, "lon": -122.08}],
        "concepts": ["unicode", "encoding", "writing"],
    },
    "evt_fusion_ignition": {
        "locations": [{"label": "Lawrence Livermore NIF, USA", "lat": 37.69, "lon": -121.71}],
        "concepts": ["fusion", "inertial-confinement", "ignition"],
    },
    "evt_carbon_capture_scaling": {
        "locations": [
            {"label": "Climeworks Mammoth, Iceland", "lat": 64.07, "lon": -21.40},
        ],
        "concepts": ["direct-air-capture", "climate-tech", "carbon-removal"],
    },
    "evt_perelman_poincare": {
        "locations": [{"label": "Saint Petersburg, Russia", "lat": 59.93, "lon": 30.36}],
        "concepts": ["poincare-conjecture", "topology", "ricci-flow"],
    },
    "evt_wiles_fermat": {
        "locations": [{"label": "Princeton, NJ, USA", "lat": 40.35, "lon": -74.66}],
        "concepts": ["fermats-last-theorem", "modularity", "elliptic-curves"],
    },
    "evt_friedman_monetarism": {
        "locations": [{"label": "University of Chicago, USA", "lat": 41.79, "lon": -87.60}],
        "concepts": ["monetarism", "natural-rate", "macroeconomics"],
    },
    "evt_rawls_justice": {
        "locations": [{"label": "Harvard, Cambridge, MA, USA", "lat": 42.37, "lon": -71.12}],
        "concepts": ["justice", "veil-of-ignorance", "political-philosophy"],
    },
    "evt_nash_equilibrium": {
        "locations": [{"label": "Princeton, NJ, USA", "lat": 40.35, "lon": -74.66}],
        "concepts": ["nash-equilibrium", "game-theory", "non-cooperative-game"],
    },
    "evt_eo_wilson_sociobiology": {
        "locations": [{"label": "Harvard, Cambridge, MA, USA", "lat": 42.37, "lon": -71.12}],
        "concepts": ["sociobiology", "evolution", "behavior"],
    },
    "evt_dawkins_selfish_gene": {
        "locations": [{"label": "Oxford, England", "lat": 51.75, "lon": -1.26}],
        "concepts": ["selfish-gene", "evolution", "meme"],
    },
    "evt_csikszentmihalyi_flow": {
        "locations": [{"label": "University of Chicago, USA", "lat": 41.79, "lon": -87.60}],
        "concepts": ["flow", "psychology", "positive-psychology"],
    },
    "evt_dijkstra_algorithms": {
        "locations": [{"label": "Eindhoven, Netherlands", "lat": 51.44, "lon": 5.48}],
        "concepts": ["shortest-path", "algorithm", "structured-programming"],
    },
    "evt_streaming_video": {
        "locations": [
            {"label": "Netflix, Los Gatos, CA, USA", "lat": 37.23, "lon": -121.97},
            {"label": "YouTube, San Bruno, CA, USA", "lat": 37.62, "lon": -122.42},
        ],
        "concepts": ["streaming", "video", "media"],
    },
}


# Verbatim from v2 seed file (the 33 anchor events)
SEED_OVERRIDES = {
    "evt_001_language": {
        "locations": [{"label": "East Africa (probable origin region)", "lat": 4.0, "lon": 36.0}],
        "concepts": ["language", "recursion", "symbolic-thought"],
    },
    "evt_002_cave_art": {
        "locations": [
            {"label": "Chauvet Cave, France", "lat": 44.39, "lon": 4.42},
            {"label": "Leang Tedongnge, Sulawesi, Indonesia", "lat": -5.0, "lon": 119.7},
        ],
        "concepts": ["visual-representation", "symbol", "abstraction"],
    },
    "evt_003_agriculture": {
        "locations": [
            {"label": "Fertile Crescent (Levant)", "lat": 33.5, "lon": 36.3},
            {"label": "Yangtze River basin, China", "lat": 30.6, "lon": 114.3},
            {"label": "Tehuacán Valley, Mesoamerica", "lat": 18.5, "lon": -97.4},
        ],
        "concepts": ["domestication", "agriculture", "surplus", "sedentism"],
    },
    "evt_004_cuneiform": {
        "locations": [{"label": "Uruk, Sumer", "lat": 31.32, "lon": 45.64}],
        "concepts": ["writing", "notation", "record-keeping"],
    },
    "evt_005_euclid": {
        "locations": [{"label": "Alexandria, Ptolemaic Egypt", "lat": 31.20, "lon": 29.92}],
        "concepts": ["geometry", "axiom", "proof", "deduction"],
    },
    "evt_006_aristotle_logic": {
        "locations": [{"label": "Athens, Classical Greece", "lat": 37.97, "lon": 23.72}],
        "concepts": ["syllogism", "deduction", "predicate", "categorical-logic"],
    },
    "evt_007_hippocrates": {
        "locations": [{"label": "Kos, Classical Greece", "lat": 36.89, "lon": 27.29}],
        "concepts": ["clinical-observation", "naturalistic-disease", "medical-ethics"],
    },
    "evt_008_paper_china": {
        "locations": [{"label": "Luoyang, Han China", "lat": 34.62, "lon": 112.45}],
        "concepts": ["paper", "text-reproduction", "durable-medium"],
    },
    "evt_009_zero_brahmagupta": {
        "locations": [{"label": "Bhinmal, Rajasthan, India", "lat": 25.00, "lon": 72.27}],
        "concepts": ["zero", "place-value", "decimal-system"],
    },
    "evt_010_alkhwarizmi_algebra": {
        "locations": [{"label": "Baghdad, Abbasid Caliphate", "lat": 33.32, "lon": 44.42}],
        "concepts": ["algebra", "equation", "algorithm"],
    },
    "evt_011_alhazen_optics": {
        "locations": [{"label": "Cairo, Fatimid Caliphate", "lat": 30.05, "lon": 31.25}],
        "concepts": ["light", "vision", "optics", "experimental-method"],
    },
    "evt_012_printing_press": {
        "locations": [{"label": "Mainz, Holy Roman Empire", "lat": 49.99, "lon": 8.27}],
        "concepts": ["movable-type", "mass-reproduction", "vernacular-literacy"],
    },
    "evt_013_heliocentrism": {
        "locations": [{"label": "Frombork, Polish-Lithuanian Commonwealth", "lat": 54.36, "lon": 19.68}],
        "concepts": ["heliocentrism", "planetary-motion"],
    },
    "evt_014_scientific_method": {
        "locations": [
            {"label": "London, England", "lat": 51.51, "lon": -0.13},
            {"label": "Padua, Republic of Venice", "lat": 45.41, "lon": 11.88},
        ],
        "concepts": ["induction", "experimental-method", "empiricism"],
    },
    "evt_015_calculus": {
        "locations": [
            {"label": "Cambridge, England", "lat": 52.20, "lon": 0.12},
            {"label": "Hanover, Holy Roman Empire", "lat": 52.37, "lon": 9.73},
        ],
        "concepts": ["derivative", "integral", "infinitesimal", "limit"],
    },
    "evt_016_principia": {
        "locations": [{"label": "Cambridge, England", "lat": 52.20, "lon": 0.12}],
        "concepts": ["force", "gravity", "motion", "classical-mechanics"],
    },
    "evt_017_smith_wealth": {
        "locations": [{"label": "Edinburgh, Scotland", "lat": 55.95, "lon": -3.19}],
        "concepts": ["market", "division-of-labor", "invisible-hand"],
    },
    "evt_018_lavoisier": {
        "locations": [{"label": "Paris, Kingdom of France", "lat": 48.86, "lon": 2.35}],
        "concepts": ["conservation-of-mass", "oxidation", "element"],
    },
    "evt_019_darwin_origin": {
        "locations": [
            {"label": "Down House, Kent, England", "lat": 51.33, "lon": 0.06},
            {"label": "Malay Archipelago (Wallace's field site)", "lat": 0.0, "lon": 120.0},
        ],
        "concepts": ["natural-selection", "evolution", "common-descent"],
    },
    "evt_020_maxwell_em": {
        "locations": [{"label": "London, United Kingdom", "lat": 51.51, "lon": -0.13}],
        "concepts": ["electromagnetic-field", "wave-equation", "field"],
    },
    "evt_021_mendeleev_periodic": {
        "locations": [{"label": "Saint Petersburg, Russian Empire", "lat": 59.93, "lon": 30.36}],
        "concepts": ["periodicity", "element", "atomic-weight"],
    },
    "evt_022_germ_theory": {
        "locations": [
            {"label": "Paris, France", "lat": 48.86, "lon": 2.35},
            {"label": "Berlin, Prussia", "lat": 52.52, "lon": 13.40},
            {"label": "Glasgow, Scotland", "lat": 55.86, "lon": -4.25},
        ],
        "concepts": ["microorganism", "infection", "antisepsis"],
    },
    "evt_023_general_relativity": {
        "locations": [{"label": "Berlin, German Empire", "lat": 52.52, "lon": 13.40}],
        "concepts": ["spacetime-curvature", "equivalence-principle", "field"],
    },
    "evt_024_quantum_mechanics": {
        "locations": [
            {"label": "Goettingen, Germany", "lat": 51.54, "lon": 9.93},
            {"label": "Zurich, Switzerland", "lat": 47.37, "lon": 8.54},
            {"label": "Cambridge, England", "lat": 52.20, "lon": 0.12},
        ],
        "concepts": ["wave-function", "uncertainty", "superposition", "quantization"],
    },
    "evt_025_turing_computability": {
        "locations": [{"label": "Cambridge, England", "lat": 52.20, "lon": 0.12}],
        "concepts": ["computability", "universal-machine", "halting-problem"],
    },
    "evt_026_transistor": {
        "locations": [{"label": "Bell Labs, Murray Hill, NJ, USA", "lat": 40.68, "lon": -74.40}],
        "concepts": ["semiconductor", "switching", "amplification"],
    },
    "evt_027_shannon_information": {
        "locations": [{"label": "Bell Labs, Murray Hill, NJ, USA", "lat": 40.68, "lon": -74.40}],
        "concepts": ["information", "entropy", "channel-capacity", "bit"],
    },
    "evt_028_dna_structure": {
        "locations": [
            {"label": "Cavendish Laboratory, Cambridge, England", "lat": 52.21, "lon": 0.09},
            {"label": "King's College London, England", "lat": 51.51, "lon": -0.12},
        ],
        "concepts": ["double-helix", "base-pairing", "genetic-code"],
    },
    "evt_029_plate_tectonics": {
        "locations": [
            {"label": "Princeton, NJ, USA", "lat": 40.35, "lon": -74.66},
            {"label": "Toronto, Canada", "lat": 43.65, "lon": -79.38},
        ],
        "concepts": ["lithospheric-plate", "seafloor-spreading", "paleomagnetism"],
    },
    "evt_030_arpanet": {
        "locations": [
            {"label": "UCLA, Los Angeles, CA, USA", "lat": 34.07, "lon": -118.44},
            {"label": "SRI, Menlo Park, CA, USA", "lat": 37.45, "lon": -122.18},
        ],
        "concepts": ["packet-switching", "tcp-ip", "distributed-network"],
    },
    "evt_031_alexnet_dl": {
        "locations": [{"label": "University of Toronto, Canada", "lat": 43.66, "lon": -79.40}],
        "concepts": ["deep-learning", "convolutional-network", "gpu-training"],
    },
    "evt_032_crispr": {
        "locations": [
            {"label": "UC Berkeley, CA, USA", "lat": 37.87, "lon": -122.26},
            {"label": "Umea University, Sweden", "lat": 63.82, "lon": 20.31},
        ],
        "concepts": ["genome-editing", "guide-rna", "crispr-cas9"],
    },
    "evt_033_transformer": {
        "locations": [{"label": "Google Brain, Mountain View, CA, USA", "lat": 37.42, "lon": -122.08}],
        "concepts": ["attention", "self-attention", "transformer", "deep-learning"],
    },
}


# Common stop words for label-derived concepts
STOP = {
    "a", "an", "the", "of", "and", "or", "on", "in", "to", "for", "as", "by", "at",
    "from", "via", "with", "is", "as", "first", "early", "modern", "ancient",
    "new", "primary", "into", "made", "this", "that", "his", "her",
}


def label_to_concepts(label: str) -> list[str]:
    """Heuristic concept extraction from event labels."""
    # Strip parens, drop possessives
    s = re.sub(r"[\(\)]", "", label)
    s = s.replace("'s ", " ").replace("'", "")
    # Split on whitespace and non-alpha
    parts = re.split(r"[^A-Za-z0-9]+", s)
    parts = [p.lower() for p in parts if p]
    parts = [p for p in parts if p not in STOP and len(p) > 2]
    # Deduplicate while preserving order
    out: list[str] = []
    seen = set()
    for p in parts:
        if p in seen:
            continue
        seen.add(p)
        out.append(p)
    return out[:4]


def main() -> None:
    with open(EVENTS_PATH) as f:
        doc = json.load(f)
    # Update meta
    meta = doc.get("_meta", {})
    meta["version"] = "0.4-v2"
    meta["description"] = (
        "v2 schema: each event has locations[] and concepts[]. Edge type "
        "vocabulary expanded to five types (enables, refines, influences, "
        "synthesizes, parallel). Synthesizes edges may use sources: [a, b]."
    )
    schema_notes = meta.setdefault("schemaNotes", {})
    schema_notes["locations"] = (
        "Array of {label, lat, lon}. Empty array allowed for events with no meaningful geographic anchor."
    )
    schema_notes["concepts"] = (
        "Controlled vocabulary tags. Lowercased, hyphenated for multi-word. Exact-match canonicalization across events."
    )
    schema_notes["edges.type"] = "enables | refines | influences | synthesizes | parallel"
    doc["_meta"] = meta

    seen_ids: set[str] = set()
    updated = 0
    derived = 0
    for ev in doc["nodes"]:
        ev_id = ev["id"]
        seen_ids.add(ev_id)
        # Prefer seed override, then curated, then heuristic
        override = SEED_OVERRIDES.get(ev_id) or CURATED.get(ev_id)
        if override:
            ev["locations"] = override["locations"]
            ev["concepts"] = override["concepts"]
            updated += 1
        else:
            # Heuristic: concepts from label, locations stay empty
            ev["locations"] = []
            ev["concepts"] = label_to_concepts(ev["label"])
            derived += 1

    # Sanity: ensure every node has the new fields
    for ev in doc["nodes"]:
        ev.setdefault("locations", [])
        ev.setdefault("concepts", [])

    with open(EVENTS_PATH, "w") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)

    total = len(doc["nodes"])
    print(f"Migrated {total} events: {updated} curated, {derived} heuristic.")


if __name__ == "__main__":
    main()
