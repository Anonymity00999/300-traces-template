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
  { id: "film-one", titleZh: "蓝调时刻纯享", titleEn: "Blue hour, uninterrupted", kind: "external", url: "" },
  { id: "film-two", titleZh: "在海边哼歌 (⁄ ⁄•⁄ω⁄•⁄ ⁄)", titleEn: "Humming by the sea (⁄ ⁄•⁄ω⁄•⁄ ⁄)", kind: "external", url: "" },
];

export function revealedScratchFilm(readIds: ReadonlySet<string>): ScratchFilm | undefined {
  for (const key of readIds) {
    const film = SCRATCH_FILMS.find((item) => key === `film-${item.id}`);
    if (film) return film;
  }
}
