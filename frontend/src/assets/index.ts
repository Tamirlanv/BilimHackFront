export const assetPaths = {
  logo: {
    png: "/assets/logo/logo.png",
    svg: "/assets/logo/logo.svg",
  },
  icons: {
    wand: "/assets/icons/wand.svg",
    book: "/assets/icons/book.svg",
    spark: "/assets/icons/spark.svg",
    text: "/assets/icons/si_text-fill.svg",
    headphones: "/assets/icons/ic_round-headphones.svg",
    microphone: "/assets/icons/tabler_microphone-filled.svg",
    math: "/assets/icons/tabler_math-symbols.svg",
    algebra: "/assets/icons/tabler_math.svg",
    geometry: "/assets/icons/tabler_geometry.svg",
    physics: "/assets/icons/streamline-plump_atom-remix.svg",
    english: "/assets/icons/meteor-icons_language.svg",
    russian: "/assets/icons/material-symbols_dictionary-rounded.svg",
    history: "/assets/icons/material-symbols_history-edu-rounded.svg",
    biology: "/assets/icons/streamline_bacteria-virus-cells-biology-solid.svg",
    chemistry: "/assets/icons/material-symbols_biotech-rounded.svg",
    informatics: "/assets/icons/solar_cpu-bold.svg",
    soon: "/assets/icons/solar_server-square-update-outline.svg",
  },
  images: {
    parchment: "/assets/images/bg-parchment.svg",
    arcaneFrame: "/assets/images/arcane-frame.svg",
  },
  illustrations: {
    owl: "/assets/illustrations/illus-owl.svg",
    constellation: "/assets/illustrations/illus-constellation.svg",
  },
  audio: {
    placeholder: "/assets/audio/.gitkeep",
  },
} as const;

export type AssetPaths = typeof assetPaths;
