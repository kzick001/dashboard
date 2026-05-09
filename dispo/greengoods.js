export const greenGoodsConfig = {
    url: "https://dmerch.iheartjane.com/v2/multi?jdm_api_key=ce5f15c9-3d09-441d-9bfd-26e87aff5925&jdm_source=monolith&jdm_version=2.16.0",
    payload: { "app_mode": "framelessEmbed", "jane_device_id": "iYQZXwVq21hz9ZKd3VYgM", "num_columns": 1, "search_attributes": ["*"], "store_id": 3812, "placements": [{"disable_ads": false, "page_size": 1000, "placement": "menu_inline_table", "search_filter": "", "search_sort": "recommendation"}], "type": "custom" }
};

// --- TUNED GREEN GOODS MATH ENGINE ---
function parseWeightToGrams(amountStr, arrayWeights) {
    if (Array.isArray(arrayWeights)) {
        // Expanded lexicon for dmerch API
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
    
    // Safely ejects non-weights like "10pk" or "3XL"
    if (isNaN(parsed)) return null; 

    if (str.includes("mg")) return parsed / 1000;
    if (str.includes("oz")) return parsed * 28.35;
    if (str.includes("g")) return parsed;
    return null;
}

// --- TUNED GREEN GOODS TAXONOMY ENGINE ---
export function normalizeGreenGoods(data) {
    const arr = data.placements?.[0]?.products.map(p => p.search_attributes).filter(Boolean) || [];
    if (arr.length === 0) throw new Error("Green Goods dataset is empty.");

    return arr.map(item => {
        let finalStrainName = item.strain;
        if (!finalStrainName || finalStrainName.toLowerCase() === "no strain" || finalStrainName.toLowerCase() === "none") {
            finalStrainName = item.name;
        }
        if (!finalStrainName || finalStrainName.toLowerCase() === "no strain") {
            finalStrainName = "Unknown Product";
        }

        const brand = item.brand || "Unknown";
        const desc = item.store_notes || item.description || "";
        const roots = (item.root_types || []).join(" ");
        const omni = `${finalStrainName} ${brand} ${item.kind} ${item.category} ${roots} ${desc}`.toLowerCase();

        // Expanded Tier 1 (Catches "merch" and "clothing")
        let t1 = "Other";
        if (omni.includes("flower")) t1 = "Flower";
        if (omni.includes("vape") || omni.includes("cartridge") || omni.includes("pen")) t1 = "Vape";
        if (omni.includes("extract") || omni.includes("concentrate") || omni.includes("rosin") || omni.includes("resin") || omni.includes("shatter")) t1 = "Extract";
        if (omni.includes("preroll") || omni.includes("pre-roll") || omni.includes("pre roll")) t1 = "Pre-Roll";
        if (omni.includes("edible") || omni.includes("gummy") || omni.includes("chocolate") || omni.includes("beverage")) t1 = "Edible";
        if (omni.includes("topical") || omni.includes("lotion") || omni.includes("balm") || omni.includes("salve")) t1 = "Topical";
        if (omni.includes("tincture") || omni.includes("drops")) t1 = "Tincture";
        if (omni.includes("gear") || omni.includes("apparel") || omni.includes("paper") || omni.includes("lighter") || omni.includes("glass") || omni.includes("battery") || omni.includes("merch") || omni.includes("clothing")) t1 = "Gear";

        // Expanded Tier 2
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
            if (omni.includes("apparel") || omni.includes("shirt") || omni.includes("hat") || omni.includes("hoodie") || omni.includes("crewneck") || omni.includes("clothing")) t2 = "Apparel";
            else if (omni.includes("paper") || omni.includes("wrap") || omni.includes("cone")) t2 = "Papers / Wraps";
            else t2 = "Accessories";
        }

        let type = "Hybrid"; 
        if (omni.includes("indica") && !omni.includes("sativa")) type = "Indica";
        if (omni.includes("sativa") && !omni.includes("indica")) type = "Sativa";

        const sizeFallbackMatch = finalStrainName.match(/(?:\[|\()?(\d*\.?\d+\s*(?:g|mg|oz|pk))(?:\]|\))?/i);
        const amountStr = item.amount || (sizeFallbackMatch ? sizeFallbackMatch[1] : null);
        const weightGrams = parseWeightToGrams(amountStr, item.available_weights);
        
        let sizesDisplay = "N/A";
        if (weightGrams) {
            sizesDisplay = `${weightGrams}g`; 
        } else if (amountStr) {
            sizesDisplay = amountStr; 
        }

        // Redundant lexicon overrides removed.
        // parseWeightToGrams handles this logic upstream.

        const price = parseFloat(item.bucket_price || item.price || 0);
        let ppg = 0;
        if (price > 0 && weightGrams && weightGrams > 0) ppg = price / weightGrams;

        let thcNum = 0;
        if (item.percent_thc) thcNum = parseFloat(item.percent_thc);
        else if (item.product_percent_thc) thcNum = parseFloat(item.product_percent_thc);
        else {
          const match = desc.match(/THC\s*:?\s*([\d.]+)/i);
          if (match && match[1]) thcNum = parseFloat(match[1]);
        }

        // Deep Data Construction
        const badges = [...new Set((item.compound_names || []).map(c => c.value).filter(Boolean))];
        
        // NEW: Inject CBD into the badges if it exists
        const cbdNum = parseFloat(item.percent_cbd || item.product_percent_cbd || 0);
        if (cbdNum > 0) {
            badges.unshift(`CBD: ${cbdNum}%`); // Puts it at the front of the list
        }

        const hasDeepData = badges.length > 0 || desc.length > 20;

        return {
          strain: finalStrainName, brand: brand,
          t1: t1, t2: t2, type: type,
          size: sizesDisplay, weight: weightGrams,
          thcNum: thcNum, thcDisplay: thcNum > 0 ? `${thcNum}%` : "N/A",
          priceNum: price, priceDisplay: price > 0 ? `$${price}` : "N/A",
          ppgNum: ppg, ppgDisplay: ppg > 0 ? `$${ppg.toFixed(2)}/g` : "N/A",
          omni: omni,
          deepData: { has: hasDeepData, desc: desc, terps: badges }
        };
    });
}
