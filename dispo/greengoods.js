import { LUCID_MAP } from './dictionary.js';

export const greenGoodsConfig = {
    url: "https://dmerch.iheartjane.com/v2/multi?jdm_api_key=ce5f15c9-3d09-441d-9bfd-26e87aff5925&jdm_source=monolith&jdm_version=2.16.0",
    payload: { "app_mode": "framelessEmbed", "jane_device_id": "LUCID_SERVER", "num_columns": 1, "search_attributes": ["*"], "store_id": 3812, "placements": [{"disable_ads": false, "page_size": 1000, "placement": "menu_inline_table", "search_filter": "", "search_sort": "recommendation"}], "type": "custom" }
};

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseWeightToGrams(amountStr, arrayWeights) {
    if (Array.isArray(arrayWeights)) {
        if (arrayWeights.includes("eighth") || arrayWeights.includes("eighth ounce")) return 3.5;
        if (arrayWeights.includes("quarter") || arrayWeights.includes("quarter ounce")) return 7.0;
        if (arrayWeights.includes("half") || arrayWeights.includes("half ounce")) return 14.0;
        if (arrayWeights.includes("ounce")) return 28.0;
        if (arrayWeights.includes("gram") || arrayWeights.includes("one gram")) return 1.0;
        if (arrayWeights.includes("half gram")) return 0.5;
        if (arrayWeights.includes("two gram")) return 2.0;
    }

    if (!amountStr) return null;
    const str = String(amountStr).toLowerCase();
    const parsed = parseFloat(str);
    if (isNaN(parsed)) return null; 

    if (str.includes("mg")) return parsed / 1000;
    if (str.includes("oz")) return parsed * 28.35;
    if (str.includes("g")) return parsed;
    return null;
}

const generateSlug = (brand, strain) => {
    return `${brand}-${strain}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
};

export function normalizeGreenGoods(data) {
    const arr = data.placements?.[0]?.products.map(p => p.search_attributes).filter(Boolean) || [];
    if (arr.length === 0) throw new Error("Green Goods dataset is empty.");

    return arr.map(item => {
        // Defensive Coercion
        let finalStrainName = item.strain ? String(item.strain) : null;
        if (!finalStrainName || finalStrainName.toLowerCase() === "no strain" || finalStrainName.toLowerCase() === "none") {
            finalStrainName = item.name ? String(item.name) : "Unknown Product";
        }
        if (finalStrainName.toLowerCase() === "no strain") {
            finalStrainName = "Unknown Product";
        }

        const brand = item.brand ? String(item.brand).trim() : "Unknown";
        
        // ==========================================
        // THE PREFIX NUKE
        // ==========================================
        if (brand !== "Unknown") {
            const brandRegex = new RegExp(`^${escapeRegExp(brand)}\\s*-?\\s*`, 'i');
            finalStrainName = finalStrainName.replace(brandRegex, '').trim();
        }

        const slug = generateSlug(brand, finalStrainName);
        const dictEntry = LUCID_MAP[slug];

        // ==========================================
        // TIER 1: The Golden Map Override
        // ==========================================
        if (dictEntry) {
            return buildFinalObject(item, finalStrainName, brand, dictEntry.t1 || "Other", dictEntry.t2 || "Unknown", dictEntry.type || "Hybrid", slug, dictEntry);
        }

        // ==========================================
        // TIER 2: The Brand Matrix Override
        // ==========================================
        const kind = (item.kind || "").toLowerCase();
        const brandLow = brand.toLowerCase();
        
        // The Pure Gear Matrix
        const pureAccessories = ['grav', 'flower mill', 'k. haring', 'marley natural', 'puffco', 'randy\'s', 'revelry supply', 'ozium', 'sireel', 'bic', 'bud bud supply', 'clipper'];
        const purePapers = ['blazy susan', 'houseplant', 'king palm', 'ocb', 'raw', 'vibes', 'zig-zag', 'flower by edie parker', 'smoke temple'];
        
        if (pureAccessories.includes(brandLow)) return buildFinalObject(item, finalStrainName, brand, "Gear", "Accessories", "N/A", slug, null);
        if (purePapers.includes(brandLow)) return buildFinalObject(item, finalStrainName, brand, "Gear", "Papers / Wraps", "N/A", slug, null);

        // Green Goods Specific Matrix
        if (brandLow.includes("simple") && kind === "vape") return buildFinalObject(item, finalStrainName, brand, "Vape", "Resin Vape", extractType(item), slug, null);
        if (brandLow.includes("boundary waters") && kind === "vape") return buildFinalObject(item, finalStrainName, brand, "Vape", "Distillate Vape", extractType(item), slug, null);
        if (brandLow.includes("vireo") && kind === "vape") return buildFinalObject(item, finalStrainName, brand, "Vape", "Distillate Vape", extractType(item), slug, null);

        // ==========================================
        // TIER 3: The Omni-String Waterfall
        // ==========================================
        const desc = item.store_notes || item.description || "";
        const rootStr = (Array.isArray(item.root_types) ? item.root_types : [item.root_types]).filter(Boolean).join(" ").toLowerCase();
        const omni = `${finalStrainName} ${brand} ${kind} ${item.category} ${rootStr} ${desc}`.toLowerCase();

        let t1 = "Other";
        if (kind === "flower" || rootStr.includes("flower")) t1 = "Flower";
        else if (kind === "vape" || rootStr.includes("vape")) t1 = "Vape";
        else if (kind === "extract" || kind === "concentrate" || rootStr.includes("extract")) t1 = "Extract";
        else if (kind === "preroll" || kind === "pre-roll" || rootStr.includes("pre-roll")) t1 = "Pre-Roll";
        else if (kind === "edible" || rootStr.includes("edible")) t1 = "Edible";
        else if (kind === "topical" || rootStr.includes("topical")) t1 = "Topical";
        else if (kind === "tincture" || rootStr.includes("tincture")) t1 = "Tincture";
        else if (kind === "gear" || kind === "merch" || rootStr.includes("gear") || rootStr.includes("merch")) t1 = "Gear";
        
        if (t1 === "Other") {
            if (omni.includes("flower")) t1 = "Flower";
            else if (omni.includes("vape") || omni.includes("cartridge") || /\bpen\b/.test(omni)) t1 = "Vape"; 
            else if (omni.includes("extract") || omni.includes("concentrate") || omni.includes("rosin") || omni.includes("resin") || omni.includes("shatter")) t1 = "Extract";
            else if (omni.includes("preroll") || omni.includes("pre-roll") || omni.includes("pre roll")) t1 = "Pre-Roll";
            else if (omni.includes("edible") || omni.includes("gummy") || omni.includes("chocolate") || omni.includes("beverage")) t1 = "Edible";
            else if (omni.includes("topical") || omni.includes("lotion") || omni.includes("balm") || omni.includes("salve")) t1 = "Topical";
            else if (omni.includes("tincture") || omni.includes("drops")) t1 = "Tincture";
            else if (omni.includes("gear") || omni.includes("apparel") || omni.includes("paper") || omni.includes("lighter") || omni.includes("glass") || omni.includes("battery") || omni.includes("clothing") || omni.includes("stash") || omni.includes("pouch") || omni.includes("bowl") || omni.includes("tin") || omni.includes("flask") || omni.includes("tube") || omni.includes("sweatshirt") || omni.includes("cone") || omni.includes("tray")) t1 = "Gear";
        }

        let t2 = t1;
        if (t1 === "Vape") {
            if (omni.includes("rosin") || omni.includes("solventless")) t2 = "Rosin Vape";
            else if (omni.includes("live resin") || omni.includes("cured resin") || omni.includes("llr")) t2 = "Resin Vape";
            else if (omni.includes("distillate") || omni.includes("botanical") || omni.includes("bdt")) t2 = "Distillate Vape";
            else t2 = "Standard Vape";
        } else if (t1 === "Flower") {
            if (finalStrainName.toLowerCase().includes("shake") || finalStrainName.toLowerCase().includes("trim") || finalStrainName.toLowerCase().includes("ground")) t2 = "Shake / Trim";
            else t2 = "Premium / Smalls";
        } else if (t1 === "Pre-Roll") {
            if (omni.includes("infused") || omni.includes("diamond") || omni.includes("hash hole")) t2 = "Infused Pre-Roll";
            else t2 = "Standard Pre-Roll";
        } else if (t1 === "Extract") {
            if (omni.includes("rosin") || omni.includes("solventless")) t2 = "Live Rosin";
            else t2 = "Standard Extract";
        } else if (t1 === "Gear") {
            if (omni.includes("apparel") || omni.includes("shirt") || omni.includes("hat") || omni.includes("hoodie") || omni.includes("crewneck") || omni.includes("clothing") || omni.includes("sweatshirt")) t2 = "Apparel";
            else if (omni.includes("paper") || omni.includes("wrap") || omni.includes("cone")) t2 = "Papers / Wraps";
            else t2 = "Accessories";
        }

        return buildFinalObject(item, finalStrainName, brand, t1, t2, extractType(item), slug, null);
    });
}

function extractType(item) {
    const brand = item.brand ? String(item.brand) : "";
    const desc = item.store_notes || item.description || "";
    const kind = (item.kind || "").toLowerCase();
    
    const rootStr = (Array.isArray(item.root_types) ? item.root_types : [item.root_types]).filter(Boolean).join(" ").toLowerCase();
    const omni = `${brand} ${kind} ${item.category} ${rootStr} ${desc}`.toLowerCase();
    
    if (omni.includes("indica") && !omni.includes("sativa")) return "Indica";
    if (omni.includes("sativa") && !omni.includes("indica")) return "Sativa";
    return "Hybrid";
}

function buildFinalObject(item, strain, brand, t1, t2, type, slug, dictEntry) {
    const regex = /\s*[-|\[|\(]?\s*(\d+\.?\d*\s*(?:mg|g|pk|oz|ct))\s*[\]|\)]?$/i;
    const match = strain.match(regex);
    let apiExtractedSize = match ? match[1] : (item.amount || "");
    let cleanStrain = match ? strain.replace(regex, '').trim() : strain;

    let finalCount = 1;
    let finalSize = apiExtractedSize;

    if (dictEntry) {
        if (dictEntry.unitCount !== "" && dictEntry.unitCount !== undefined && dictEntry.unitCount !== null) {
            finalCount = parseInt(dictEntry.unitCount) || 1;
        }
        if (dictEntry.unitSize !== "" && dictEntry.unitSize !== undefined && dictEntry.unitSize !== null) {
            finalSize = dictEntry.unitSize;
        }
    }

    const price = parseFloat(item.bucket_price || item.price || 0);

    let perUnitGrams = parseWeightToGrams(finalSize, item.available_weights);
    let totalWeightGrams = perUnitGrams ? (perUnitGrams * finalCount) : null;

    // FIX: If API hid the weight in an array, map it to a readable string before the heuristic
    if ((!finalSize || finalSize === "") && perUnitGrams) {
        if (perUnitGrams === 3.5) finalSize = "3.5g";
        else if (perUnitGrams === 7.0) finalSize = "7g";
        else if (perUnitGrams === 14.0) finalSize = "14g";
        else if (perUnitGrams === 28.0) finalSize = "28g";
        else if (perUnitGrams === 1.0) finalSize = "1g";
        else if (perUnitGrams === 0.5) finalSize = "0.5g";
        else finalSize = `${perUnitGrams}g`;
    }

    // THE FLOWER HEURISTIC 
    if ((t1 || "").toLowerCase() === "flower" && (!totalWeightGrams || totalWeightGrams <= 0)) {
        if (price >= 160) { finalSize = "28g"; totalWeightGrams = 28.0; }
        else if (price >= 100) { finalSize = "14g"; totalWeightGrams = 14.0; }
        else if (price >= 60) { finalSize = "7g"; totalWeightGrams = 7.0; }
        else if (price >= 26) { finalSize = "3.5g"; totalWeightGrams = 3.5; }
    }

    let ppg = 0;
    if (price > 0 && totalWeightGrams && totalWeightGrams > 0) ppg = price / totalWeightGrams;

    const desc = item.store_notes || item.description || "";
    let thcNum = 0;
    if (item.percent_thc) thcNum = parseFloat(item.percent_thc);
    else if (item.product_percent_thc) thcNum = parseFloat(item.product_percent_thc);
    else {
      const matchTHC = desc.match(/THC\s*:?\s*([\d.]+)/i);
      if (matchTHC && matchTHC[1]) thcNum = parseFloat(matchTHC[1]);
    }

    const badges = [...new Set((item.compound_names || []).map(c => c.value).filter(Boolean))];
    const cbdNum = parseFloat(item.percent_cbd || item.product_percent_cbd || 0);
    if (cbdNum > 0) badges.unshift(`CBD: ${cbdNum}%`); 

    const hasDeepData = badges.length > 0 || desc.length > 20;
    const safeRoots = (Array.isArray(item.root_types) ? item.root_types : [item.root_types]).filter(Boolean).join(" ");
    const omni = `${cleanStrain} ${brand} ${item.kind} ${item.category} ${safeRoots} ${desc}`.toLowerCase();

    return {
      strain: cleanStrain, brand: brand,
      t1: t1, t2: t2, type: type,
      count: finalCount, size: finalSize, weight: totalWeightGrams,
      thcNum: thcNum, thcDisplay: thcNum > 0 ? `${thcNum}%` : "N/A",
      priceNum: price, priceDisplay: price > 0 ? `$${price}` : "N/A",
      ppgNum: ppg, ppgDisplay: ppg > 0 ? `$${ppg.toFixed(2)}/g` : "N/A",
      omni: omni, slug: slug,
      deepData: { has: hasDeepData, desc: desc, terps: badges }
    };
}
