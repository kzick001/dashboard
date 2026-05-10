import { LUCID_MAP } from './dictionary.js';

export const greenGoodsConfig = {
    url: "https://dmerch.iheartjane.com/v2/multi?jdm_api_key=ce5f15c9-3d09-441d-9bfd-26e87aff5925&jdm_source=monolith&jdm_version=2.16.0",
    payload: { "app_mode": "framelessEmbed", "jane_device_id": "iYQZXwVq21hz9ZKd3VYgM", "num_columns": 1, "search_attributes": ["*"], "store_id": 3812, "placements": [{"disable_ads": false, "page_size": 1000, "placement": "menu_inline_table", "search_filter": "", "search_sort": "recommendation"}], "type": "custom" }
};

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
        // Defensive Coercion: Force strain names into strings to prevent integer crashes
        let finalStrainName = item.strain ? String(item.strain) : null;
        if (!finalStrainName || finalStrainName.toLowerCase() === "no strain" || finalStrainName.toLowerCase() === "none") {
            finalStrainName = item.name ? String(item.name) : "Unknown Product";
        }
        if (finalStrainName.toLowerCase() === "no strain") {
            finalStrainName = "Unknown Product";
        }

        const brand = item.brand ? String(item.brand) : "Unknown";
        const slug = generateSlug(brand, finalStrainName);

        // ==========================================
        // TIER 1: The Golden Map Override
        // ==========================================
        if (LUCID_MAP[slug]) {
            const mapData = LUCID_MAP[slug];
            // Protective Fallback: Inject safe defaults if you left a field blank in the Forge
            return buildFinalObject(item, finalStrainName, brand, mapData.t1 || "Other", mapData.t2 || "Unknown", mapData.type || "Hybrid", slug);
        }

        // ==========================================
        // TIER 2: The Brand Matrix Override (Green Goods)
        // ==========================================
        const kind = (item.kind || "").toLowerCase();
        const brandLow = brand.toLowerCase();
        
        if (brandLow.includes("simple") && kind === "vape") return buildFinalObject(item, finalStrainName, brand, "Vape", "Resin Vape", extractType(item), slug);
        if (brandLow.includes("boundary waters") && kind === "vape") return buildFinalObject(item, finalStrainName, brand, "Vape", "Distillate Vape", extractType(item), slug);
        if (brandLow.includes("vireo") && kind === "vape") return buildFinalObject(item, finalStrainName, brand, "Vape", "Distillate Vape", extractType(item), slug);

        // ==========================================
        // TIER 3: The Omni-String Waterfall (Fallback)
        // ==========================================
        const desc = item.store_notes || item.description || "";
        
        // Defensive Coercion: Force root_types into an array before filtering and joining
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

        return buildFinalObject(item, finalStrainName, brand, t1, t2, extractType(item), slug);
    });
}

// --- HELPER FUNCTIONS ---
function extractType(item) {
    const brand = item.brand ? String(item.brand) : "";
    const desc = item.store_notes || item.description || "";
    const kind = (item.kind || "").toLowerCase();
    
    // Defensive Coercion
    const rootStr = (Array.isArray(item.root_types) ? item.root_types : [item.root_types]).filter(Boolean).join(" ").toLowerCase();
    const omni = `${brand} ${kind} ${item.category} ${rootStr} ${desc}`.toLowerCase();
    
    if (omni.includes("indica") && !omni.includes("sativa")) return "Indica";
    if (omni.includes("sativa") && !omni.includes("indica")) return "Sativa";
    return "Hybrid";
}

function buildFinalObject(item, strain, brand, t1, t2, type, slug) {
    const sizeFallbackMatch = strain.match(/(?:\[|\()?(\d*\.?\d+\s*(?:g|mg|oz|pk))(?:\]|\))?/i);
    const amountStr = item.amount || (sizeFallbackMatch ? sizeFallbackMatch[1] : null);
    const weightGrams = parseWeightToGrams(amountStr, item.available_weights);
    
    let sizesDisplay = "N/A";
    if (weightGrams) sizesDisplay = `${weightGrams}g`; 
    else if (amountStr) sizesDisplay = String(amountStr); 

    // Redundant lexicon overrides removed. 
    // parseWeightToGrams handles this logic upstream natively now.

    const price = parseFloat(item.bucket_price || item.price || 0);
    let ppg = 0;
    if (price > 0 && weightGrams && weightGrams > 0) ppg = price / weightGrams;

    const desc = item.store_notes || item.description || "";
    let thcNum = 0;
    if (item.percent_thc) thcNum = parseFloat(item.percent_thc);
    else if (item.product_percent_thc) thcNum = parseFloat(item.product_percent_thc);
    else {
      const match = desc.match(/THC\s*:?\s*([\d.]+)/i);
      if (match && match[1]) thcNum = parseFloat(match[1]);
    }

    const badges = [...new Set((item.compound_names || []).map(c => c.value).filter(Boolean))];
    const cbdNum = parseFloat(item.percent_cbd || item.product_percent_cbd || 0);
    if (cbdNum > 0) badges.unshift(`CBD: ${cbdNum}%`); 

    const hasDeepData = badges.length > 0 || desc.length > 20;
    
    // Defensive Coercion
    const safeRoots = (Array.isArray(item.root_types) ? item.root_types : [item.root_types]).filter(Boolean).join(" ");
    const omni = `${strain} ${brand} ${item.kind} ${item.category} ${safeRoots} ${desc}`.toLowerCase();

    return {
      strain: strain, brand: brand,
      t1: t1, t2: t2, type: type,
      size: sizesDisplay, weight: weightGrams,
      thcNum: thcNum, thcDisplay: thcNum > 0 ? `${thcNum}%` : "N/A",
      priceNum: price, priceDisplay: price > 0 ? `$${price}` : "N/A",
      ppgNum: ppg, ppgDisplay: ppg > 0 ? `$${ppg.toFixed(2)}/g` : "N/A",
      omni: omni, slug: slug,
      deepData: { has: hasDeepData, desc: desc, terps: badges }
    };
}
