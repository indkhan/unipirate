// Pure reviewed catalogue. Sources checked 2026-10-07; not a publication record.
// DAAD lists classify examination subjects, never programme-title proxies.
export const GCE_SOURCES = { A: 'https://www.daad.de/en/studying-in-germany/requirements/gce-list-a/', B: 'https://www.daad.de/en/studying-in-germany/requirements/gce-list-b/', C: 'https://www.daad.de/en/studying-in-germany/requirements/gce-list-c/' } as const;
type Category = 'language' | 'history' | 'geography' | 'social_studies' | 'economics' | 'math' | 'biology' | 'chemistry' | 'physics' | 'computer_science' | 'other';
export type GceCatalogEntry = {
    id: string;
    label: string;
    category: Category;
    list: 'A' | 'B' | 'C' | 'unrecognized';
    area: string;
    excludes?: readonly string[];
    bodies?: readonly string[];
    consultation?: boolean;
    sourceUrl: string;
};
const entry = (id: string, label: string, category: Category, list: 'A' | 'B' | 'C', area = id, excludes: readonly string[] = [], consultation = false, bodies?: readonly string[]): GceCatalogEntry => ({ id, label, category, list, area, excludes, consultation, bodies, sourceUrl: GCE_SOURCES[list] });
export const GCE_SUBJECTS: readonly GceCatalogEntry[] = [
    entry('mathematics', "Mathematics", 'math', 'A', 'math'),
    entry('mathematics_a', "Mathematics A", 'math', 'A', 'math'),
    entry('mathematics_b_mei', "Mathematics B (MEI)", 'math', 'A', 'math'),
    entry('further_mathematics', "Further Mathematics", 'math', 'A', 'math'),
    entry('further_mathematics_a', "Further Mathematics A", 'math', 'A', 'math'),
    entry('further_mathematics_b_mei', "Further Mathematics B (MEI)", 'math', 'A', 'math'),
    entry('pure_mathematics', "Pure Mathematics", 'math', 'A', 'math'),
    entry('physics', "Physics", 'physics', 'A', 'physics'),
    entry('physics_a', "Physics A", 'physics', 'A', 'physics'),
    entry('physics_b_advancing_physics', "Physics B (Advancing Physics)", 'physics', 'A', 'physics'),
    entry('chemistry', "Chemistry", 'chemistry', 'A', 'chemistry'),
    entry('chemistry_a', "Chemistry A", 'chemistry', 'A', 'chemistry'),
    entry('chemistry_b_salters', "Chemistry B (Salters)", 'chemistry', 'A', 'chemistry'),
    entry('biology', "Biology", 'biology', 'A', 'biology'),
    entry('biology_a', "Biology A", 'biology', 'A', 'biology'),
    entry('biology_a_salters_nuffield', "Biology A (Salters-Nuffield)", 'biology', 'A', 'biology'),
    entry('biology_b', "Biology B", 'biology', 'A', 'biology'),
    entry('biology_b_advancing_biology', "Biology B (Advancing Biology)", 'biology', 'A', 'biology'),
    entry('computer_science', "Computer Science", 'computer_science', 'A', 'computer_science'),
    entry('information_and_communication_technology_ict', "Information and Communication Technology (ICT)", 'computer_science', 'A', 'computer_science'),
    entry('information_technology', "Information Technology", 'computer_science', 'A', 'computer_science'),
    entry('history', "History", 'history', 'A', 'history'),
    entry('history_a', "History A", 'history', 'A', 'history'),
    entry('geography', "Geography", 'geography', 'A', 'geography'),
    entry('politics', "Politics", 'social_studies', 'A', 'social_studies'),
    entry('sociology', "Sociology", 'social_studies', 'A', 'social_studies'),
    entry('government_and_politics', "Government and Politics", 'social_studies', 'A', 'social_studies'),
    entry('economics', "Economics", 'economics', 'A', 'economics'),
    entry('economics_a', "Economics A", 'economics', 'A', 'economics'),
    entry('economics_b', "Economics B", 'economics', 'A', 'economics'),
    entry('arabic_listening_reading_and_writing', "Arabic (listening, reading and writing)", 'language', 'A'),
    entry('bengali', "Bengali", 'language', 'A'),
    entry('biblical_hebrew', "Biblical Hebrew", 'language', 'A'),
    entry('classical_greek', "Classical Greek", 'language', 'A'),
    entry('chinese_spoken_mandarin_spoken_cantonese', "Chinese (spoken Mandarin/spoken Cantonese)", 'language', 'A'),
    entry('english_language', "English Language", 'language', 'A'),
    entry('english_language_and_literature', "English Language and Literature", 'language', 'A'),
    entry('english_language_and_literature_emc', "English Language and Literature (EMC)", 'language', 'A'),
    entry('english_literature', "English Literature", 'language', 'A'),
    entry('english_literature_a', "English Literature A", 'language', 'A'),
    entry('english_literature_b', "English Literature B", 'language', 'A'),
    entry('french', "French", 'language', 'A'),
    entry('german', "German", 'language', 'A'),
    entry('greek', "Greek", 'language', 'A'),
    entry('gujarati', "Gujarati", 'language', 'A'),
    entry('hindi', "Hindi", 'language', 'A'),
    entry('irish', "Irish", 'language', 'A'),
    entry('italian', "Italian", 'language', 'A'),
    entry('japanese', "Japanese", 'language', 'A'),
    entry('latin', "Latin", 'language', 'A'),
    entry('modern_hebrew', "Modern Hebrew", 'language', 'A'),
    entry('panjabi', "Panjabi", 'language', 'A'),
    entry('persian', "Persian", 'language', 'A'),
    entry('polish', "Polish", 'language', 'A'),
    entry('portuguese', "Portuguese", 'language', 'A'),
    entry('russian', "Russian", 'language', 'A'),
    entry('spanish', "Spanish", 'language', 'A'),
    entry('tamil', "Tamil", 'language', 'A'),
    entry('turkish', "Turkish", 'language', 'A'),
    entry('urdu', "Urdu", 'language', 'A'),
    entry('art_and_design', "Art and Design", 'other', 'B', 'art_and_design', [], false, undefined),
    entry('ancient_history', "Ancient History", 'other', 'B', 'ancient_history', ["history"], false, undefined),
    entry('classical_civilisation', "Classical Civilisation", 'other', 'B', 'classical_civilisation', ["history", "classical_greek", "greek", "latin"], false, undefined),
    entry('classical_studies', "Classical Studies", 'other', 'B', 'classical_civilisation', ["history", "classical_greek", "greek", "latin"], false, undefined),
    entry('drama_and_theatre', "Drama and Theatre", 'other', 'B', 'drama_and_theatre', [], false, undefined),
    entry('geology', "Geology", 'other', 'B', 'geology', ["geography"], false, undefined),
    entry('history_of_art', "History of Art", 'other', 'B', 'history_of_art', ["history"], false, undefined),
    entry('life_and_health_sciences', "Life and Health Sciences", 'other', 'B', 'life_and_health_sciences', ["biology", "chemistry"], false, undefined),
    entry('marine_science', "Marine Science", 'other', 'B', 'marine_science', ["biology", "chemistry", "physics"], false, ['caie']),
    entry('music', "Music", 'other', 'B', 'music', [], false, undefined),
    entry('nutrition_and_food_science', "Nutrition and Food Science", 'other', 'B', 'nutrition_and_food_science', ["biology", "chemistry"], false, undefined),
    entry('philosophy', "Philosophy", 'other', 'B', 'philosophy', [], false, undefined),
    entry('physical_education', "Physical Education", 'other', 'B', 'physical_education', [], false, undefined),
    entry('environmental_science', "Environmental Science", 'other', 'B', 'environmental_science', ["biology", "chemistry", "physics"], false, undefined),
    entry('psychology', "Psychology", 'other', 'B', 'psychology', [], false, undefined),
    entry('religious_studies', "Religious Studies", 'other', 'B', 'religious_studies', [], false, undefined),
    entry('statistics', "Statistics", 'other', 'B', 'statistics', ["math"], false, undefined),
    entry('business', "Business", 'other', 'C', 'business', ["economics"], false),
    entry('business_studies', "Business Studies", 'other', 'C', 'business', ["economics"], false),
    entry('design_and_technology', "Design and Technology", 'other', 'C', 'design_and_technology', [], false),
    entry('technology_and_design', "Technology and Design", 'other', 'C', 'technology_and_design', [], false),
    entry('design_and_textiles', "Design and Textiles", 'other', 'C', 'design_and_textiles', [], false),
    entry('digital_technology', "Digital Technology", 'other', 'C', 'digital_technology', [], true),
    entry('digital_media_and_design', "Digital Media and Design", 'other', 'C', 'digital_media_and_design', [], true),
    entry('electronics', "Electronics", 'other', 'C', 'electronics', ["physics"], false),
    entry('environmental_technology', "Environmental Technology", 'other', 'C', 'environmental_technology', [], true),
    entry('film_studies', "Film Studies", 'other', 'C', 'film_studies', [], false),
    entry('health_and_social_care', "Health and Social Care", 'other', 'C', 'health_and_social_care', [], true),
    entry('journalism_in_the_media_and_communications_industry', "Journalism in the Media and Communications Industry", 'other', 'C', 'journalism_in_the_media_and_communications_industry', ["language"], true),
    entry('law', "Law", 'other', 'C', 'law', ["history", "social_studies"], false),
    entry('media_studies', "Media Studies", 'other', 'C', 'media_studies', [], true),
    entry('music_technology', "Music Technology", 'other', 'C', 'music_technology', [], false),
    entry('software_systems_development', "Software Systems Development", 'other', 'C', 'software_systems_development', ["computer_science"], false),
    entry('sports_science_and_the_active_leisure_industry', "Sports Science and the Active Leisure Industry", 'other', 'C', 'sports_science_and_the_active_leisure_industry', [], false),
    entry('travel_and_tourism', "Travel and Tourism", 'other', 'C', 'travel_and_tourism', ["economics", "geography"], false),
    { id: 'unlisted', label: 'Another / discontinued / uncertain subject', category: 'other', list: 'unrecognized', area: 'unlisted', sourceUrl: GCE_SOURCES.A },
];
export function gceEntry(id: string, body: string): GceCatalogEntry | undefined {
    // Explicit source alias; do not guess the identity of other variants.
    const canonical = id === 'literature_in_english' ? 'english_literature' : id;
    const raw = GCE_SUBJECTS.find(s => s.id === canonical);
    // Same-language syllabus variants/aliases require identity confirmation rather
    // than automatically counting duplicate examinations as distinct languages.
    const e = raw?.id.startsWith('english_') ? { ...raw, area: 'english' } : raw;
    return e && (!e.bodies || e.bodies.includes(body)) ? e : undefined;
}
export function gceIndependent(a: GceCatalogEntry, b: GceCatalogEntry): boolean {
    if (a.id === b.id || a.area === b.area)
        return false;
    return !a.excludes?.some(x => x === b.area || x === b.category || x === b.id) && !b.excludes?.some(x => x === a.area || x === a.category || x === a.id);
}
export function triples<T>(items: readonly T[]): T[][] {
    const result: T[][] = [];
    for (let a = 0; a < items.length; a++)
        for (let b = a + 1; b < items.length; b++)
            for (let c = b + 1; c < items.length; c++)
                result.push([items[a], items[b], items[c]]);
    return result;
}
