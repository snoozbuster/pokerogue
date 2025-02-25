import {SimpleTranslationEntries} from "#app/interfaces/locales";

// Titles of special trainers like gym leaders, elite four, and the champion
export const titles: SimpleTranslationEntries = {
  "elite_four": "Alto Mando",
  "elite_four_female": "Alto Mando",
  "gym_leader": "Líder de gimnasio",
  "gym_leader_female": "Líder de gimnasio",
  "gym_leader_double": "Líderes de Gimnasio",
  "champion": "Campeón",
  "champion_female": "Campeona",
  "champion_double": "Campeones",
  "rival": "Rival",
  "professor": "Profesor",
  "frontier_brain": "As del Frente Batalla",
  // Maybe if we add the evil teams we can add "Team Rocket" and "Team Aqua" etc. here as well as "Team Rocket Boss" and "Team Aqua Admin" etc.
} as const;

// Titles of trainers like "Youngster" or "Lass"
export const trainerClasses: SimpleTranslationEntries = {
  "ace_trainer": "Entrenador Guay",
  "ace_trainer_female": "Entrenadora Guay",
  "ace_duo": "Pareja Guay",
  "artist": "Artista",
  "artist_female": "Artista",
  "backers": "Hinchas",
  "backpacker": "Mochilero",
  "backpacker_female": "Mochilera",
  "backpackers": "Mochileros",
  "baker": "Pastelera",
  "battle_girl": "Luchadora",
  "beauty": "Modelo",
  "beginners": "Principiantes",
  "biker": "Motorista",
  "black_belt": "Karateka",
  "breeder": "Criapokémon",
  "breeder_female": "Criapokémon",
  "breeders": "Criadores",
  "clerk": "Empresario",
  "clerk_female": "Oficinista",
  "colleagues": "Colegas Oficina",
  "crush_kin": "Luchadores",
  "cyclist": "Ciclista",
  "cyclist_female": "Ciclista",
  "cyclists": "Ciclistas",
  "dancer": "Breakdancer",
  "dancer_female": "Bailarina",
  "depot_agent": "Ferroviario",
  "doctor": "Enfermero",
  "doctor_female": "Enfermera",
  "firebreather": "Comefuegos",
  "fisherman": "Pescador",
  "fisherman_female": "Pescadora",
  "gentleman": "Aristócrata",
  "guitarist": "Guitarrista",
  "guitarist_female": "Guitarrista",
  "harlequin": "Arlequín",
  "hiker": "Montañero",
  "hooligans": "Pandilleros",
  "hoopster": "Pívot",
  "infielder": "Pitcher",
  "janitor": "Limpiador",
  "lady": "Damisela",
  "lass": "Chica",
  "linebacker": "Quarterback",
  "maid": "Criada",
  "madame": "Señora",
  "medical_team": "Equipo Médico",
  "musician": "Cantautor",
  "hex_maniac": "Bruja",
  "nurse": "Enfermera",
  "nursery_aide": "Seño",
  "officer": "Policía",
  "parasol_lady": "Dama Parasol",
  "pilot": "Piloto",
  "pokéfan": "Pokéfan",
  "pokéfan_female": "Pokéfan",
  "pokéfan_family": "Pareja de Pokéfans",
  "preschooler": "Preescolar",
  "preschooler_female": "Preescolar",
  "preschoolers": "Preescolares",
  "psychic": "Médium",
  "psychic_female": "Mentalista",
  "psychics": "Pareja Médium",
  "pokémon_ranger": "Pokémon Ranger",
  "pokémon_rangers": "Pokémon Ranger",
  "ranger": "Ranger",
  "restaurant_staff": "Personal Restaurante",
  "rich": "Bien",
  "rich_female": "Bien",
  "rich_boy": "Niño Bien",
  "rich_couple": "Pareja Bien",
  "rich_kid": "Niño Bien",
  "rich_kid_female": "Niña Bien",
  "rich_kids": "Niños Bien",
  "roughneck": "Calvo",
  "sailor": "Marinero",
  "scientist": "Científico",
  "scientist_female": "Científica",
  "scientists": "Científicos",
  "smasher": "Tenista",
  "snow_worker": "Operario Nieve",
  "snow_worker_female": "Operaria Nieve",
  "striker": "Delantero",
  "school_kid": "Colegial",
  "school_kid_female": "Colegial",
  "school_kids": "Colegiales",
  "swimmer": "Nadador",
  "swimmer_female": "Nadadora",
  "swimmers": "Nadadores",
  "twins": "Gemelas",
  "veteran": "Veterano",
  "veteran_female": "Veterana",
  "veteran_duo": "Dúo Veterano",
  "waiter": "Camarero",
  "waitress": "Camarera",
  "worker": "Operario",
  "worker_female": "Operaria",
  "workers": "Operarios",
  "youngster": "Joven",
  "rocket_grunt": "Rocket Grunt",
  "rocket_grunts": "Rocket Grunts",
  "rocket_grunt_female": "Rocket Grunt",
  "magma_grunt": "Magma Grunt",
  "magma_grunt_female": "Magma Grunt",
  "magma_grunts": "Magma Grunts",
  "aqua_grunt": "Aqua Grunt",
  "aqua_grunt_female": "Aqua Grunt",
  "aqua_grunts": "Aqua Grunts",
  "galactic_grunt": "Galactic Grunt",
  "galactic_grunt_female": "Galactic Grunt",
  "galactic_grunts": "Galactic Grunts",
  "plasma_grunt": "Plasma Grunt",
  "plasma_grunt_female": "Plasma Grunt",
  "plasma_grunts": "Plasma Grunts",
  "flare_grunt": "Flare Grunt",
  "flare_grunt_female": "Flare Grunt",
  "flare_grunts": "Flare Grunts",
} as const;

// Names of special trainers like gym leaders, elite four, and the champion
export const trainerNames: SimpleTranslationEntries = {
  "brock": "Brock",
  "misty": "Misty",
  "lt_surge": "Tt. Surge",
  "erika": "Erika",
  "janine": "Sachiko",
  "sabrina": "Sabrina",
  "blaine": "Blaine",
  "giovanni": "Giovanni",
  "falkner": "Pegaso",
  "bugsy": "Antón",
  "whitney": "Blanca",
  "morty": "Morti",
  "chuck": "Aníbal",
  "jasmine": "Yasmina",
  "pryce": "Fredo",
  "clair": "Débora",
  "roxanne": "Petra",
  "brawly": "Marcial",
  "wattson": "Erico",
  "flannery": "Candela",
  "norman": "Norman",
  "winona": "Alana",
  "tate": "Vito",
  "liza": "Leti",
  "juan": "Galán",
  "roark": "Roco",
  "gardenia": "Gardenia",
  "maylene": "Brega",
  "crasher_wake": "Mananti",
  "fantina": "Fantina",
  "byron": "Acerón",
  "candice": "Inverna",
  "volkner": "Lectro",
  "cilan": "Millo",
  "chili": "Zeo",
  "cress": "Maiz",
  "cheren": "Cheren",
  "lenora": "Aloe",
  "roxie": "Hiedra",
  "burgh": "Camus",
  "elesa": "Camila",
  "clay": "Yakón",
  "skyla": "Gerania",
  "brycen": "Junco",
  "drayden": "Lirio",
  "marlon": "Ciprián",
  "viola": "Violeta",
  "grant": "Lino",
  "korrina": "Corelia",
  "ramos": "Amaro",
  "clemont": "Lem",
  "valerie": "Valeria",
  "olympia": "Ástrid",
  "wulfric": "Édel",
  "milo": "Percy",
  "nessa": "Cathy",
  "kabu": "Naboru",
  "bea": "Judith",
  "allister": "Allistair",
  "opal": "Sally",
  "bede": "Berto",
  "gordie": "Morris",
  "melony": "Mel",
  "piers": "Nerio",
  "marnie": "Roxy",
  "raihan": "Roy",
  "katy": "Araceli",
  "brassius": "Brais",
  "iono": "e-Nigma",
  "kofu": "Fuco",
  "larry": "Laureano",
  "ryme": "Lima",
  "tulip": "Tuli",
  "grusha": "Grusha",
  "lorelei": "Lorelei",
  "bruno": "Bruno",
  "agatha": "Agatha",
  "lance": "Lance",
  "will": "Mento",
  "koga": "Koga",
  "karen": "Karen",
  "sidney": "Sixto",
  "phoebe": "Fátima",
  "glacia": "Nívea",
  "drake": "Dracón",
  "aaron": "Alecrán",
  "bertha": "Gaia",
  "flint": "Fausto",
  "lucian": "Delos",
  "shauntal": "Anís",
  "marshal": "Lotto",
  "grimsley": "Aza",
  "caitlin": "Catleya",
  "malva": "Malva",
  "siebold": "Narciso",
  "wikstrom": "Tileo",
  "drasna": "Drácena",
  "hala": "Kaudan",
  "molayne": "Lario",
  "olivia": "Mayla",
  "acerola": "Zarala",
  "kahili": "Kahili",
  "rika": "Cayena",
  "poppy": "Pola",
  "hassel": "Hesperio",
  "crispin": "Denis",
  "amarys": "Nerina",
  "lacey": "Aroa",
  "drayton": "Levi",
  "blue": "Azul",
  "red": "Rojo",
  "steven": "Máximo",
  "wallace": "Plubio",
  "cynthia": "Cintia",
  "alder": "Mirto",
  "iris": "Iris",
  "diantha": "Dianta",
  "hau": "Tilo",
  "geeta": "Ságita",
  "nemona": "Mencía",
  "kieran": "Cass",
  "leon": "Lionel",
  "rival": "Finn",
  "rival_female": "Ivy",

  // Double Names
  "blue_red_double": "Azul y Rojo",
  "red_blue_double": "Rojo y Azul",
  "tate_liza_double": "Vito y Leti",
  "liza_tate_double": "Leti y Vito",
  "steven_wallace_double": "Máximo y Plubio",
  "wallace_steven_double": "Plubio y Máximo",
  "alder_iris_double": "Mirto e Iris",
  "iris_alder_double": "Iris y Mirto",
  "marnie_piers_double": "Roxy y Nerio",
  "piers_marnie_double": "Nerio y Roxy",
} as const;
