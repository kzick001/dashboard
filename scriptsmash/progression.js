/**
 * Pharmacy Breaker - Progression Configuration V1.1
 * Controls explicit board density, layout patterns, and narrative flavor.
 */

const SHIFT_CONFIG = {
    1: { 
        tolerance: 500, primary: 9, secondary: 0, decoys: 0, placebos: 12, hazards: 0, pattern: "center_block",
        text: "Welcome, intern. Point the spatula, hit the required pills. Try not to poison anyone on your first day." 
    },
    2: { 
        tolerance: 488, primary: 10, secondary: 0, decoys: 2, placebos: 10, hazards: 0, pattern: "scatter",
        text: "The drive-thru bell is broken. It rings continuously. Prioritize speed over sanity." 
    },
    3: { 
        tolerance: 476, primary: 10, secondary: 4, decoys: 4, placebos: 8, hazards: 0, pattern: "checkerboard",
        text: "Multi-drug therapy authorized. Fill both quotas. Mixing the wrong colors voids our liability insurance." 
    },
    4: { 
        tolerance: 464, primary: 11, secondary: 4, decoys: 6, placebos: 6, hazards: 0, pattern: "top_heavy",
        text: "The registers are frozen again. Keep dispensing while I kick the mainframe." 
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
        text: "Patient claims their dog ate their prescription. Dispense replacements carefully." 
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
        text: "Hazard density increased. We bought discount generics and they are highly volatile." 
    },
    12: { 
        tolerance: 368, primary: 17, secondary: 8, decoys: 18, placebos: 2, hazards: 2, pattern: "center_block",
        text: "The system flags this interaction as fatal. Override it and clear the queue." 
    },
    13: { 
        tolerance: 356, primary: 18, secondary: 9, decoys: 18, placebos: 0, hazards: 2, pattern: "columns",
        text: "Someone microwaved tilapia in the breakroom. Push through the nausea." 
    },
    14: { 
        tolerance: 344, primary: 18, secondary: 9, decoys: 20, placebos: 0, hazards: 2, pattern: "checkerboard",
        text: "Prior authorization denied. Cash only. The patients in aisle four are forming a militia." 
    },
    15: { 
        tolerance: 332, primary: 19, secondary: 10, decoys: 20, placebos: 0, hazards: 2, pattern: "top_heavy",
        text: "We are out of amber vials. Dispense directly into their hands." 
    },
    16: { 
        tolerance: 320, primary: 20, secondary: 10, decoys: 20, placebos: 0, hazards: 3, pattern: "scatter",
        text: "MAXIMUM HAZARD LEVEL. The supply chain is compromised. Trust nothing red." 
    },
    17: { 
        tolerance: 308, primary: 21, secondary: 10, decoys: 22, placebos: 0, hazards: 3, pattern: "checkerboard",
        text: "The district manager is doing a walk-through. Smile while you dodge the explosives." 
    },
    18: { 
        tolerance: 296, primary: 22, secondary: 11, decoys: 22, placebos: 0, hazards: 3, pattern: "columns",
        text: "Patient zero has arrived. Quotas are climbing. Tolerance is shrinking." 
    },
    19: { 
        tolerance: 284, primary: 22, secondary: 11, decoys: 24, placebos: 0, hazards: 3, pattern: "center_block",
        text: "We are running on backup generators. Ignore the flickering lights. Hit the targets." 
    },
    20: { 
        tolerance: 275, primary: 23, secondary: 11, decoys: 24, placebos: 0, hazards: 3, pattern: "top_heavy",
        text: "Welcome to the Night Shift. Master the board, or surrender your spatula to the void." 
    }
};
