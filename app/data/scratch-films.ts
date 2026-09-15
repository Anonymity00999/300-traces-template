export type ScratchFilm = {
  id: string;
  titleZh: string;
  titleEn: string;
  // Bilibili pages open only after the surface is revealed.
  kind: "external";
  url: string;
};

// Empty URLs intentionally reserve the Bilibili entrances until supplied.
export const SCRATCH_FILMS_ENABLED = true;
export const SCRATCH_FILMS: readonly ScratchFilm[] = [
  { id: "film-one", titleZh: "影像 01", titleEn: "Film 01", kind: "external", url: "" },
  { id: "film-two", titleZh: "影像 02", titleEn: "Film 02", kind: "external", url: "" },
];
