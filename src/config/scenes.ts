/** What the navigation bar shows for each scene, in scene order; `hash` is the address (/huy#nam-3). */
export const SCENE_LINKS = [
  { id: "prologue", hash: "khoi-dau", label: "Khởi đầu", glyph: "moon", short: "" },
  { id: "year1", hash: "nam-1", label: "Năm 1", glyph: "number", short: "1" },
  { id: "year2", hash: "nam-2", label: "Năm 2", glyph: "number", short: "2" },
  { id: "year3", hash: "nam-3", label: "Năm 3", glyph: "number", short: "3" },
  { id: "year4", hash: "nam-4", label: "Năm 4", glyph: "number", short: "4" },
  { id: "invitation", hash: "thu-moi", label: "Thư mời", glyph: "letter", short: "" },
] as const;
