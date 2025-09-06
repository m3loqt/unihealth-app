/**
 * Common allergies list for patient signup form
 * These are the most frequently reported allergies that patients can select from
 */

export const COMMON_ALLERGIES = [
  // Food Allergies
  'Peanuts',
  'Tree nuts',
  'Shellfish',
  'Fish',
  'Eggs',
  'Milk',
  'Soy',
  'Wheat',
  'Sesame',
  'Sulfites',
  
  // Environmental Allergies
  'Pollen',
  'Dust mites',
  'Pet dander',
  'Mold',
  'Grass',
  'Ragweed',
  
  // Drug Allergies
  'Penicillin',
  'Sulfa drugs',
  'Aspirin',
  'Ibuprofen',
  'Codeine',
  'Morphine',
  'Latex',
  
  // Other Common Allergies
  'Bee stings',
  'Insect bites',
  'Nickel',
  'Fragrances',
  'Cleaning products',
  'Hair dye',
  'Sunscreen',
  'Adhesive tape',
  'Chlorine',
  'Fabric softener'
];

/**
 * Categorize allergies for better organization
 */
export const ALLERGY_CATEGORIES = {
  FOOD: [
    'Peanuts',
    'Tree nuts',
    'Shellfish',
    'Fish',
    'Eggs',
    'Milk',
    'Soy',
    'Wheat',
    'Sesame',
    'Sulfites'
  ],
  ENVIRONMENTAL: [
    'Pollen',
    'Dust mites',
    'Pet dander',
    'Mold',
    'Grass',
    'Ragweed'
  ],
  DRUG: [
    'Penicillin',
    'Sulfa drugs',
    'Aspirin',
    'Ibuprofen',
    'Codeine',
    'Morphine',
    'Latex'
  ],
  OTHER: [
    'Bee stings',
    'Insect bites',
    'Nickel',
    'Fragrances',
    'Cleaning products',
    'Hair dye',
    'Sunscreen',
    'Adhesive tape',
    'Chlorine',
    'Fabric softener'
  ]
};
