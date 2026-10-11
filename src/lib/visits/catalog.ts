// Procedures discussed at a visit, by area, and the clinical-evaluation areas
// (design/Visit.dc.html, SPEC §4 Visit). PROCEDURE_AREAS is the starting catalogue: each
// company's own copy lives in the database and is edited in Settings → Επεμβάσεις
// (catalog-db.ts). Visits store the keys, so renaming a label never breaks a record.

export type Label = { el: string; en: string };
// hidden: no longer offered for new visits; old visits still show it.
export type Sub = Label & { key: string; hidden?: boolean };
export type Procedure = Label & { key: string; nonSurgical?: boolean; hidden?: boolean; subs?: Sub[] };
export type ProcedureArea = Label & { key: string; procedures: Procedure[] };
export type Catalog = ProcedureArea[];

const p = (key: string, el: string, en: string, extra: Partial<Procedure> = {}): Procedure => ({ key, el, en, ...extra });
const s = (key: string, el: string, en: string) => ({ key, el, en });

export const PROCEDURE_AREAS: ProcedureArea[] = [
  {
    key: "face",
    el: "Πρόσωπο",
    en: "Face",
    procedures: [
      p("facelift", "Lifting προσώπου", "Facelift", {
        subs: [
          s("deepPlane", "Deep plane", "Deep plane"), s("deepNeck", "Deep neck", "Deep neck"), s("temporalMore", "Temporal MORE", "Temporal MORE"),
          s("nanofat", "Nanofat", "Nanofat"), s("eyelids", "Βλέφαρα", "Eyelids"), s("miniLift", "Mini lift", "Mini lift"),
          s("midface", "Μέσο τρίτο", "Midface"), s("endoBrow", "Ενδοσκοπικό φρυδιών", "Endoscopic brow"), s("foreheadLift", "Lifting μετώπου", "Forehead lift"),
          s("smg", "Μείωση υπογνάθιων αδένων (SMG)", "Submandibular gland reduction"), s("platysmaplasty", "Πλατυσματοπλαστική", "Platysmaplasty"), s("fat", "Λίπος", "Fat grafting"),
        ],
      }),
      p("blephUpper", "Βλεφαροπλαστική άνω", "Upper blepharoplasty", {
        subs: [s("skinOnly", "Μόνο δέρμα", "Skin only"), s("muscle", "Μυς", "Muscle"), s("fat", "Λίπος", "Fat"), s("ptosis", "Διόρθωση βλεφαρόπτωσης", "Ptosis repair")],
      }),
      p("blephLower", "Βλεφαροπλαστική κάτω", "Lower blepharoplasty", {
        subs: [s("transconj", "Διεπιπεφυκοτική", "Transconjunctival"), s("transcut", "Διαδερμική", "Transcutaneous"), s("fatReposition", "Επανατοποθέτηση λίπους", "Fat repositioning"), s("canthopexy", "Κανθοπηξία", "Canthopexy")],
      }),
      p("rhinoplasty", "Ρινοπλαστική", "Rhinoplasty", {
        subs: [
          s("open", "Ανοιχτή", "Open"), s("closed", "Κλειστή", "Closed"), s("preservation", "Preservation", "Preservation"), s("revision", "Αναθεώρηση", "Revision"),
          s("septoplasty", "Διαφραγματοπλαστική", "Septoplasty"), s("spreader", "Spreader grafts", "Spreader grafts"), s("septalExtension", "Septal extension graft", "Septal extension graft"),
          s("columellarStrut", "Columellar strut", "Columellar strut"), s("alarRim", "Alar rim grafts (articulated)", "Alar rim grafts (articulated)"),
          s("dicedCartilage", "Free / diced cartilage", "Free / diced cartilage"), s("ribCartilage", "Πλευρικός χόνδρος", "Rib cartilage"), s("earCartilage", "Χόνδρος αυτιού", "Ear cartilage"),
          s("osteotomies", "Οστεοτομίες", "Osteotomies"), s("baseReduction", "Μείωση βάσης", "Alar base reduction"), s("turbinates", "Κόγχες", "Turbinates"),
        ],
      }),
      p("endoBrow", "Ενδοσκοπική ανόρθωση φρυδιών", "Endoscopic brow lift"),
      p("foreheadLift", "Lifting μετώπου", "Forehead lift"),
      p("midfaceLift", "Lifting μέσου τρίτου", "Midface lift"),
      p("temporalLift", "Κροταφικό lifting", "Temporal lift"),
      p("bichat", "Αφαίρεση λίπους Bichat", "Buccal fat removal"),
      p("facialImplants", "Εμφυτεύματα προσώπου", "Facial implants", {
        subs: [s("chin", "Πηγούνι", "Chin"), s("jawAngle", "Γωνία γνάθου", "Jaw angle"), s("cheeks", "Ζυγωματικά", "Cheeks")],
      }),
      p("faceFat", "Μεταμόσχευση λίπους προσώπου", "Facial fat grafting"),
      p("submentalLipo", "Λιποαναρρόφηση υπογενείου", "Submental liposuction"),
      p("lipLift", "Lip lift", "Lip lift"),
      p("ffs", "FFS", "FFS", {
        subs: [
          s("foreheadSinus", "Μέτωπο / κόλπος", "Forehead / sinus"), s("hairline", "Γραμμή μαλλιών", "Hairline"), s("brows", "Φρύδια", "Brows"),
          s("rhinoplasty", "Ρινοπλαστική", "Rhinoplasty"), s("cheeks", "Ζυγωματικά", "Cheeks"), s("lipLift", "Lip lift", "Lip lift"),
          s("jawAngle", "Γωνία γνάθου", "Jaw angle"), s("chin", "Πηγούνι", "Chin"), s("trachealShave", "Tracheal shave", "Tracheal shave"),
        ],
      }),
      p("trachealShave", "Tracheal shave", "Tracheal shave"),
      p("otoplasty", "Ωτοπλαστική", "Otoplasty"),
    ],
  },
  {
    key: "breast",
    el: "Μαστός",
    en: "Breast",
    procedures: [
      p("augmentation", "Αυξητική μαστού", "Breast augmentation"),
      p("mastopexy", "Ανόρθωση μαστού", "Mastopexy"),
      p("augMastopexy", "Αυξητική-ανορθωτική", "Augmentation-mastopexy"),
      p("reduction", "Μειωτική μαστού", "Breast reduction"),
      p("reconstruction", "Αποκατάσταση μαστού", "Breast reconstruction"),
      p("implantExchange", "Αφαίρεση/αλλαγή ενθεμάτων", "Implant removal / exchange"),
      p("invertedNipple", "Εισολκή θηλής", "Inverted nipple"),
      p("tuberous", "Σωληνοειδείς μαστοί", "Tuberous breasts"),
      p("deformity", "Παραμόρφωση μαστού", "Breast deformity"),
      p("gynaecomastia", "Γυναικομαστία", "Gynaecomastia"),
      p("topSurgery", "Top surgery", "Top surgery"),
      p("breastFat", "Λίπος στους μαστούς", "Breast fat grafting"),
    ],
  },
  {
    key: "body",
    el: "Σώμα",
    en: "Body",
    procedures: [
      p("lipo", "Λιποαναρρόφηση", "Liposuction"),
      p("lipoedema", "Λιποαναρρόφηση λιποιδήματος", "Lipoedema liposuction"),
      p("abdominoplasty", "Κοιλιοπλαστική", "Abdominoplasty"),
      p("miniAbdo", "Mini κοιλιοπλαστική", "Mini abdominoplasty"),
      p("lipoAbdo", "Λιπο-κοιλιοπλαστική", "Lipoabdominoplasty"),
      p("thighLift", "Ανόρθωση μηρών", "Thigh lift"),
      p("armLift", "Ανόρθωση βραχιόνων", "Arm lift"),
      p("backLift", "Ανόρθωση πλάτης", "Back lift"),
      p("buttockLift", "Ανόρθωση γλουτών", "Buttock lift"),
      p("bbl", "Μεταμόσχευση λίπους γλουτών", "Buttock fat grafting (BBL)"),
      p("buttockImplants", "Ενθέματα γλουτών", "Buttock implants"),
      p("bodyLift", "Body lift", "Body lift"),
      p("gynaeLipo", "Γυναικομαστία (λιπο)", "Gynaecomastia (liposuction)"),
    ],
  },
  {
    key: "genital",
    el: "Γεννητικά",
    en: "Genital",
    procedures: [
      p("vaginoplastyMtf", "Κολποπλαστική MtF", "Vaginoplasty (MtF)"),
      p("labiaplasty", "Χειλεοπλαστική", "Labiaplasty"),
      p("monsLipo", "Λιποαναρρόφηση εφηβαίου", "Mons pubis liposuction"),
    ],
  },
  {
    key: "other",
    el: "Άλλο",
    en: "Other",
    procedures: [
      p("skinLesion", "Αφαίρεση βλάβης δέρματος", "Skin lesion removal"),
      p("scarRevision", "Διόρθωση ουλής", "Scar revision"),
      p("botox", "Αλλαντική τοξίνη", "Botulinum toxin", { nonSurgical: true }),
      p("filler", "Υαλουρονικό", "Hyaluronic acid filler", { nonSurgical: true }),
      p("laser", "Laser", "Laser", { nonSurgical: true }),
    ],
  },
];

// Clinical evaluation: one section per area of interest; each has a structured
// examination (lib/visits/exams/areas.ts).
export const EXAM_AREAS: (Label & { key: string })[] = [
  { key: "breast", el: "Μαστός / θώρακας", en: "Breast / chest" },
  { key: "face", el: "Πρόσωπο", en: "Face" },
  { key: "nose", el: "Μύτη", en: "Nose" },
  { key: "body", el: "Σώμα", en: "Body" },
  { key: "genital", el: "Γεννητικά", en: "Genital" },
  { key: "other", el: "Άλλο", en: "Other" },
];

export function findIn(catalog: Catalog, key: string): Procedure | undefined {
  for (const a of catalog) for (const pr of a.procedures) if (pr.key === key) return pr;
  return undefined;
}
// "Αυξητική μαστού (…)" names for lists, from a catalogue.
export const procedureNames = (catalog: Catalog) => Object.fromEntries(catalog.flatMap((a) => a.procedures.map((pr) => [pr.key, pr.el])));
export const EXAM_AREA_KEYS = new Set(EXAM_AREAS.map((a) => a.key));
