/**
 * Script Smash - Progression Configuration V1.2
 * Controls explicit board density, layout patterns, and cynical corporate lore.
 */

const CORPORATE_TAGLINES = [
    "Doing More With Less Since 1998.",
    "Synergistic Dispensing Solutions.",
    "Your Metrics Determine Your Worth.",
    "Smiles Are Mandatory. Overtime Is Not.",
    "If You Have Time To Lean, You Have Time To Clean.",
    "Please Do Not Feed The Patients.",
    "Malpractice Is Just A State Of Mind."
];

const SHIFT_CONFIG = {
    1: { 
        tolerance: 500, primary: 9, secondary: 0, decoys: 0, placebos: 12, hazards: 0, pattern: "center_block",
        text: "Welcome to Script Smash. Fill the quota, watch your Malpractice Threshold, and try not to poison anyone on your first day." 
    },
    2: { 
        tolerance: 488, primary: 10, secondary: 0, decoys: 2, placebos: 10, hazards: 0, pattern: "scatter",
        text: "Drive-thru times are currently averaging 4 seconds. Fill this script or I'm taking your chair away." 
    },
    3: { 
        tolerance: 476, primary: 10, secondary: 4, decoys: 4, placebos: 8, hazards: 0, pattern: "checkerboard",
        text: "Patient claims their doctor promised this would be free. Override the copay and clear the queue." 
    },
    4: { 
        tolerance: 464, primary: 11, secondary: 4, decoys: 6, placebos: 6, hazards: 0, pattern: "top_heavy",
        text: "The 1995 mainframe is frozen again. Keep dispensing while I kick the tower." 
    },
    5: { 
        tolerance: 452, primary: 12, secondary: 5, decoys: 8, placebos: 6, hazards: 0, pattern: "scatter",
        text: "Corporate sent a memo about synergy. It translates to filling faster with less help." 
    },
    6: { 
        tolerance: 440, primary: 13, secondary: 5, decoys: 8, placebos: 4, hazards: 1, pattern: "center_block",
        text: "RED MEANS DEAD. Lethal hazards introduced. Avoid them to prevent malpractice litigation." 
    },
    7: { 
        tolerance: 428, primary: 13, secondary: 6, decoys: 10, placebos: 4, hazards: 1, pattern: "columns",
        text: "Patient needs an early refill because they dropped their pills in a volcano. Override approved." 
    },
    8: { 
        tolerance: 416, primary: 14, secondary: 6, decoys: 12, placebos: 4, hazards: 1, pattern: "scatter",
        text: "The HVAC is broken. The capsules are getting sticky. Maintain trajectory through the sweat." 
    },
    9: { 
        tolerance: 404, primary: 15, secondary: 7, decoys: 14, placebos: 2, hazards: 1, pattern: "checkerboard",
        text: "Inventory audit tomorrow. The bean counters are watching the security feeds." 
    },
    10: { 
        tolerance: 392, primary: 15, secondary: 7, decoys: 16, placebos: 2, hazards: 1, pattern: "top_heavy",
        text: "Flu season arrived early. The lobby is a biohazard. Dispense with extreme prejudice." 
    },
    11: { 
        tolerance: 380, primary: 16, secondary: 8, decoys: 16, placebos: 2, hazards: 2, pattern: "scatter",
        text: "Corporate replaced the lead tech with a highly aggressive Roomba. Maintain workflow." 
    },
    12: { 
        tolerance: 368, primary: 17, secondary: 8, decoys: 18, placebos: 2, hazards: 2, pattern: "center_block",
        text: "The system flags this interaction as fatal. Override it. Metrics over safety." 
    },
    13: { 
        tolerance: 356, primary: 18, secondary: 9, decoys: 18, placebos: 0, hazards: 2, pattern: "columns",
        text: "Patient took a placebo and is now legally a ghost. Do not adjust your screen." 
    },
    14: { 
        tolerance: 344, primary: 18, secondary: 9, decoys: 20, placebos: 0, hazards: 2, pattern: "checkerboard",
        text: "Prior authorization denied. Cash only. The patients in aisle four are forming a militia." 
    },
    15: { 
        tolerance: 332, primary: 19, secondary: 10, decoys: 20, placebos: 0, hazards: 2, pattern: "top_heavy",
        text: "We are out of amber vials. Dispense directly into their cupped hands." 
    },
    16: { 
        tolerance: 320, primary: 20, secondary: 10, decoys: 20, placebos: 0, hazards: 3, pattern: "scatter",
        text: "MAXIMUM HAZARD LEVEL. The supply chain is compromised. Trust nothing red." 
    },
    17: { 
        tolerance: 308, primary: 21, secondary: 10, decoys: 22, placebos: 0, hazards: 3, pattern: "checkerboard",
        text: "Warning: High doses of Cyan may induce sudden, localized time travel." 
    },
    18: { 
        tolerance: 296, primary: 22, secondary: 11, decoys: 22, placebos: 0, hazards: 3, pattern: "columns",
        text: "Patient zero has arrived. Quotas are climbing. Thresholds are shrinking." 
    },
    19: { 
        tolerance: 284, primary: 22, secondary: 11, decoys: 24, placebos: 0, hazards: 3, pattern: "center_block",
        text: "We are running on backup generators. Ignore the flickering CRT monitors. Hit the targets." 
    },
    20: { 
        tolerance: 275, primary: 23, secondary: 11, decoys: 24, placebos: 0, hazards: 3, pattern: "top_heavy",
        text: "Welcome to the Night Shift. Master the board, or surrender your spatula to the void." 
    }
};
