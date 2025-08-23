# Route Abbreviations and Meanings Summary

This document provides a comprehensive list of all route abbreviations and their meanings found in the UniHealth application codebase.

## Medical Route Abbreviations

### Standard Medical Routes

| Abbreviation | Meaning | Description |
|--------------|---------|-------------|
| PO | By mouth (oral) | Oral administration |
| IV | Intravenous | Directly into a vein |
| IM | Intramuscular | Into muscle tissue |
| SC | Subcutaneous | Under the skin |
| SL | Sublingual | Under the tongue |
| INH | Inhalation | Through the respiratory system |
| TOP | Topical | Applied to the skin surface |
| RECT | Rectal | Into the rectum |
| NASAL | Nasal | Through the nose |
| OPHTH | Ophthalmic | Applied to the eye |
| OTIC | Otic (ear) | Applied to the ear |
| VAG | Vaginal | Applied to the vagina |
| BUCCAL | Buccal | Between cheek and gum |
| TD | Transdermal | Through the skin |
| ID | Intradermal | Into the skin layers |
| IT | Intrathecal | Into the spinal canal |
| EPIDURAL | Epidural | Around the spinal cord |
| IA | Intra-articular | Into a joint |
| IO | Intraocular | Into the eye |

### Specialized Medical Routes

| Abbreviation | Meaning | Description |
|--------------|---------|-------------|
| HHN | Handheld nebulizer | Portable nebulizer device |
| IVTT | Intravenous therapy technique | Specialized IV administration |
| IVP | Intravenous push | Rapid IV injection |
| IVPB | Intravenous piggyback | Secondary IV medication |
| MDI | Metered-dose inhaler | Pressurized inhaler device |
| NEB | Nebulizer | Aerosol medication delivery |
| NGT | Nasogastric tube | Through nose to stomach |
| PR | In the rectum | Rectal administration |
| S&S | Swish and swallow | Oral rinse and swallow |

### Specific Location Routes (Previously "Write out")

| Abbreviation | Meaning | Description |
|--------------|---------|-------------|
| right ear | right ear | Applied to the right ear |
| left ear | left ear | Applied to the left ear |
| each ear | each ear | Applied to both ears |
| in the right eye | in the right eye | Applied to the right eye |
| in the left eye | in the left eye | Applied to the left eye |
| in both eyes | in both eyes | Applied to both eyes |
| subcutaneously, Sub q | subcutaneously, Sub q | Subcutaneous injection |

## Frequency Abbreviations

| Abbreviation | Meaning | Description |
|--------------|---------|-------------|
| ac | before meals | Take before eating |
| pc | after meals | Take after eating |
| daily | every day, daily | Once per day |
| bid | twice a day | Two times daily |
| tid | three times a day | Three times daily |
| qid | four times a day | Four times daily |
| qh | every hour | Every hour |
| at bedtime | at bedtime, hour of sleep | Before sleeping |
| qn | every night | Every night |
| stat | immediately | Right away |
| q2h | Every 2 hours | Every two hours |
| q4h | Every 4 hours | Every four hours |
| q6h | Every 6 hours | Every six hours |
| q8h | Every 8 hours | Every eight hours |
| q12h | Every 12 hours | Every twelve hours |
| every other day | every other day | Every second day |
| prn | as needed | When necessary |
| 3 times weekly | three times per week | Three times per week |
| biw | twice per week | Two times per week |
| qw | once per week | Once per week |

## Implementation Notes

### Files Modified
1. **`src/components/RouteSelectionModal.tsx`**
   - Replaced all "Write out" abbreviations with their actual meanings
   - Updated tooltip content to reflect changes

2. **`src/utils/formatting.ts`**
   - Added specific ear and eye routes to the ROUTE_MAPPING
   - Ensured consistency between modal and formatting utilities

### User Role Behavior
- **Specialists**: See abbreviations (e.g., "PO", "IV", "right ear")
- **Patients**: See full meanings (e.g., "By mouth (oral)", "Intravenous", "right ear")

### Direct Selection Routes
All routes are now directly selectable without requiring custom input, making the interface simpler and more user-friendly.

## Usage Guidelines

1. **For Specialists**: Use standard medical abbreviations for efficiency
2. **For Patients**: Display full meanings for clarity and understanding
3. **Direct Selection**: All routes can be selected directly without additional input
4. **Consistency**: Maintain consistent mapping across all application components

## Future Considerations

- Consider adding more specialized medical routes as needed
- Ensure all new routes are added to both the modal and formatting utilities
- Maintain consistency between medical terminology standards
