import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  Modal,
  StatusBar,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import {
  User,
  Calendar,
  MapPin,
  Phone,
  ChevronDown,
  ChevronLeft,
  Mail,
  X,
} from 'lucide-react-native';
import { ErrorModal } from '../../../src/components/shared';
import { KeyboardAvoidingScrollView } from '../../../src/components/ui';
import { 
  validateSignupForm, 
  getFieldError, 
  hasFieldError,
  checkEmailAvailability,
  type ValidationError,
  type SignupFormData 
} from '../../../src/utils/signupValidation';
import { COMMON_ALLERGIES } from '../../../src/constants/allergies';

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not known yet'];
const EDUCATIONAL_ATTAINMENT_OPTIONS = [
  'Elementary',
  'High School',
  'Vocational/Technical',
  'Associate Degree',
  'Bachelor\'s Degree',
  'Master\'s Degree',
  'Doctorate',
  'Other'
];

// Helper for MM/DD/YYYY input masking
function formatDateOfBirth(value: string) {
  let cleaned = value.replace(/[^\d]/g, '');
  let formatted = '';
  if (cleaned.length >= 3 && cleaned.length <= 4) {
    formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
  } else if (cleaned.length > 4) {
    formatted =
      cleaned.slice(0, 2) +
      '/' +
      cleaned.slice(2, 4) +
      '/' +
      cleaned.slice(4, 8);
  } else {
    formatted = cleaned;
  }
  return formatted;
}

export default function SignUpStep1Screen() {
  const [formData, setFormData] = useState<SignupFormData>({
    email: '',
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    contactNumber: '',
    highestEducationalAttainment: '',
    bloodType: '',
    allergies: '',
  });
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showEducationalAttainmentModal, setShowEducationalAttainmentModal] = useState(false);
  const [showBloodTypeModal, setShowBloodTypeModal] = useState(false);
  
  // Allergy selection state
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [showAllergyList, setShowAllergyList] = useState(false);
  const [customAllergies, setCustomAllergies] = useState<string[]>([]);
  
  // Error handling state
  const [currentError, setCurrentError] = useState<ValidationError | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, ValidationError>>({});

  // Get the final clean allergies for display and submission
  const getFinalAllergies = () => {
    // Parse current input field to get all typed allergies including the one being typed
    const currentTypedAllergies = formData.allergies.split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);
    
    // Remove duplicates with selected common allergies
    const uniqueTypedAllergies = currentTypedAllergies.filter(typed => 
      !selectedAllergies.some(selected => selected.toLowerCase() === typed.toLowerCase())
    );
    
    // Combine selected common allergies with unique typed allergies
    const allAllergies = [...selectedAllergies, ...uniqueTypedAllergies];
    
    return allAllergies.join(', ');
  };

  // Handle allergy selection from common list
  const handleAllergyToggle = (allergy: string) => {
    setSelectedAllergies(prev => {
      const isSelected = prev.includes(allergy);
      let newSelected;
      
      if (isSelected) {
        // Remove from selected allergies
        newSelected = prev.filter(a => a !== allergy);
      } else {
        // Add to selected allergies and remove from custom if it exists there
        newSelected = [...prev, allergy];
        // Also remove from custom allergies to avoid duplicates
        const newCustom = customAllergies.filter(a => a.toLowerCase() !== allergy.toLowerCase());
        setCustomAllergies(newCustom);
        updateAllergiesField(newSelected, newCustom);
        return newSelected;
      }
      
      // Update the combined allergies field
      updateAllergiesField(newSelected, customAllergies);
      return newSelected;
    });
  };

  // Handle custom allergy input
  const handleCustomAllergyAdd = (value: string) => {
    if (value.trim()) {
      const newCustom = value.split(',')
        .map(a => a.trim())
        .filter(a => a.length > 0)
        .filter(a => !selectedAllergies.some(selected => selected.toLowerCase() === a.toLowerCase())); // Remove duplicates with selected
      
      setCustomAllergies(newCustom);
      updateAllergiesField(selectedAllergies, newCustom);
    }
  };

  // Update the combined allergies field (only called when selecting/deselecting from common list)
  const updateAllergiesField = (selected: string[], custom: string[]) => {
    // Remove duplicates between selected and custom (case-insensitive)
    const filteredCustom = custom.filter(customAllergy => 
      !selected.some(selectedAllergy => selectedAllergy.toLowerCase() === customAllergy.toLowerCase())
    );
    
    const allAllergies = [...selected, ...filteredCustom];
    const allergiesString = allAllergies.join(', ');
    setFormData(prev => ({
      ...prev,
      allergies: allergiesString,
    }));
  };

  // Remove selected allergy
  const removeSelectedAllergy = (allergy: string) => {
    if (selectedAllergies.includes(allergy)) {
      handleAllergyToggle(allergy);
    } else {
      // Remove from custom allergies
      const newCustom = customAllergies.filter(a => a !== allergy);
      setCustomAllergies(newCustom);
      updateAllergiesField(selectedAllergies, newCustom);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    
    if (field === 'allergies') {
      // Parse the typed text to update custom allergies
      // Handle both comma-separated and the current typing (including the last item without comma)
      const typedAllergies = value.split(',')
        .map(a => a.trim())
        .filter(a => a.length > 0); // This now properly includes the last typed item
      
      // Only update custom allergies with items that aren't already selected from common list
      const newCustomAllergies = typedAllergies.filter(a => 
        !selectedAllergies.some(selected => selected.toLowerCase() === a.toLowerCase())
      );
      
      setCustomAllergies(newCustomAllergies);
    }
    
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Check email availability when email field changes
    if (field === 'email' && value.trim()) {
      // Debounce email availability check
      setTimeout(async () => {
        if (formData.email === value) { // Only check if email hasn't changed
          try {
            const emailError = await checkEmailAvailability(value);
            setFieldErrors(prev => {
              const newErrors = { ...prev };
              if (emailError) {
                newErrors.email = emailError;
              } else {
                // Clear email error if availability check passes
                delete newErrors.email;
              }
              return newErrors;
            });
          } catch (error) {
            console.warn('Email availability check failed:', error);
            // Clear email error on failure to avoid blocking the form
            setFieldErrors(prev => {
              const newErrors = { ...prev };
              delete newErrors.email;
              return newErrors;
            });
          }
        }
      }, 500); // Reduced delay for faster feedback
    } else if (field === 'email' && !value.trim()) {
      // Clear email error when field is empty
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.email;
        return newErrors;
      });
    }
  };

  // Validation state
  const [isValidating, setIsValidating] = useState(false);
  
  // Check if form is valid
  const isFormValid = () => {
    const errors = validateSignupForm(formData);
    return errors.length === 0;
  };
  
  // Check if there are any field errors (including async email availability errors)
  const hasFieldErrors = () => {
    return Object.keys(fieldErrors).length > 0;
  };
  
  const allFieldsFilled = isFormValid() && !hasFieldErrors();

  const handleContinue = async () => {
    setIsValidating(true);
    
    // Before validation, ensure allergies field reflects the actual selected allergies
    const finalFormData = {
      ...formData,
      allergies: getFinalAllergies()
    };
    
    // First, do comprehensive email validation if email is provided
    if (finalFormData.email.trim()) {
      try {
        const emailError = await checkEmailAvailability(finalFormData.email);
        if (emailError) {
          setFieldErrors(prev => ({
            ...prev,
            email: emailError
          }));
          setCurrentError(emailError);
          setShowErrorModal(true);
          setIsValidating(false);
          return;
        }
      } catch (error) {
        console.warn('Email availability check failed:', error);
        // Continue with basic validation if Firebase check fails
      }
    }
    
    // Validate the form with final data
    const errors = validateSignupForm(finalFormData);
    
    if (errors.length > 0) {
      // Show the first error
      const firstError = errors[0];
      setCurrentError(firstError);
      setShowErrorModal(true);
      
      // Store all field errors for visual feedback
      const fieldErrorMap: Record<string, ValidationError> = {};
      errors.forEach(error => {
        // Map validation error field names to form field names
        let fieldKey: string;
        switch (error.field) {
          case 'Email':
            fieldKey = 'email';
            break;
          case 'First Name':
            fieldKey = 'firstName';
            break;
          case 'Last Name':
            fieldKey = 'lastName';
            break;
          case 'Date of Birth':
            fieldKey = 'dateOfBirth';
            break;
          case 'Contact Number':
            fieldKey = 'contactNumber';
            break;
          case 'Highest Educational Attainment':
            fieldKey = 'highesteducationalattainment';
            break;
          case 'Blood Type':
            fieldKey = 'bloodtype';
            break;
          default:
            fieldKey = error.field.toLowerCase().replace(/\s+/g, '');
        }
        fieldErrorMap[fieldKey] = error;
      });
      setFieldErrors(fieldErrorMap);
      
      setIsValidating(false);
      return;
    }
    
    // If validation passes, proceed to next step
    setIsValidating(false);
    router.push({
      pathname: '/signup/step2',
      params: {
        step1Data: JSON.stringify(finalFormData),
      },
    });
  };
  
  const handleErrorModalClose = () => {
    setShowErrorModal(false);
    setCurrentError(null);
  };
  
  const handleShowNextError = () => {
    if (!currentError) return;
    
    const errors = validateSignupForm(formData);
    const currentIndex = errors.findIndex(error => 
      error.field === currentError.field
    );
    
    if (currentIndex < errors.length - 1) {
      // Show next error
      setCurrentError(errors[currentIndex + 1]);
    } else {
      // Close modal if this was the last error
      setShowErrorModal(false);
      setCurrentError(null);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        Platform.OS === 'android' ? { paddingTop: StatusBar.currentHeight } : null,
      ]}
    >
      <KeyboardAvoidingScrollView
        extraOffset={20}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#1E40AF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Create your account</Text>
            <Text style={styles.headerSubtitle}>Step 1: Personal Details</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '33.33%' }]} />
          </View>
          <Text style={styles.progressText}>1 of 3</Text>
        </View>

        <View style={styles.formContainer}>
          {/* First Name */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>First Name</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <View style={[
              styles.inputContainer,
              fieldErrors['firstName'] && styles.inputError
            ]}>
              <User size={20} color={fieldErrors['firstName'] ? "#EF4444" : "#9CA3AF"} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your first name"
                placeholderTextColor="#9CA3AF"
                value={formData.firstName}
                onChangeText={value => handleInputChange('firstName', value)}
                autoCapitalize="words"
              />
            </View>
            {fieldErrors['firstName'] && (
              <Text style={styles.errorText}>{fieldErrors['firstName'].message}</Text>
            )}
          </View>

          {/* Middle Name */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Middle Name</Text>
            </View>
            <View style={styles.inputContainer}>
              <User size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your middle name (optional)"
                placeholderTextColor="#9CA3AF"
                value={formData.middleName}
                onChangeText={value => handleInputChange('middleName', value)}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Last Name */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Last Name</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <View style={[
              styles.inputContainer,
              fieldErrors['lastName'] && styles.inputError
            ]}>
              <User size={20} color={fieldErrors['lastName'] ? "#EF4444" : "#9CA3AF"} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your last name"
                placeholderTextColor="#9CA3AF"
                value={formData.lastName}
                onChangeText={value => handleInputChange('lastName', value)}
                autoCapitalize="words"
              />
            </View>
            {fieldErrors['lastName'] && (
              <Text style={styles.errorText}>{fieldErrors['lastName'].message}</Text>
            )}
          </View>

          {/* Date of Birth */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Date of Birth</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <View style={[
              styles.inputContainer,
              fieldErrors['dateOfBirth'] && styles.inputError
            ]}>
              <Calendar size={20} color={fieldErrors['dateOfBirth'] ? "#EF4444" : "#9CA3AF"} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="MM/DD/YYYY"
                placeholderTextColor="#9CA3AF"
                value={formData.dateOfBirth}
                onChangeText={value =>
                  handleInputChange('dateOfBirth', formatDateOfBirth(value))
                }
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            {fieldErrors['dateOfBirth'] && (
              <Text style={styles.errorText}>{fieldErrors['dateOfBirth'].message}</Text>
            )}
          </View>

          {/* Gender */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Gender</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.inputContainer,
                fieldErrors['gender'] && styles.inputError
              ]}
              onPress={() => setShowGenderModal(true)}
              activeOpacity={0.7}
            >
              <User size={20} color={fieldErrors['gender'] ? "#EF4444" : "#9CA3AF"} style={styles.inputIcon} />
              <Text style={[styles.input, !formData.gender && styles.placeholder]}>
                {formData.gender || 'Select your gender'}
              </Text>
              <ChevronDown size={20} color={fieldErrors['gender'] ? "#EF4444" : "#9CA3AF"} />
            </TouchableOpacity>
            {fieldErrors['gender'] && (
              <Text style={styles.errorText}>{fieldErrors['gender'].message}</Text>
            )}
          </View>

          {/* Address */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Address</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <View style={[
              styles.inputContainer, 
              styles.addressInputContainer,
              fieldErrors['address'] && styles.inputError
            ]}>
              <View style={styles.iconTopAlign}>
                <MapPin size={20} color={fieldErrors['address'] ? "#EF4444" : "#9CA3AF"} />
              </View>
              <TextInput
                style={[styles.input, styles.addressInput]}
                placeholder="Enter your complete address"
                placeholderTextColor="#9CA3AF"
                value={formData.address}
                onChangeText={value => handleInputChange('address', value)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            {fieldErrors['address'] && (
              <Text style={styles.errorText}>{fieldErrors['address'].message}</Text>
            )}
          </View>

          {/* Contact Number */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Contact Number</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <View style={[
              styles.inputContainer,
              fieldErrors['contactNumber'] && styles.inputError
            ]}>
              <Phone size={20} color={fieldErrors['contactNumber'] ? "#EF4444" : "#9CA3AF"} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your contact number"
                placeholderTextColor="#9CA3AF"
                value={formData.contactNumber}
                onChangeText={value => handleInputChange('contactNumber', value)}
                keyboardType="phone-pad"
              />
            </View>
            {fieldErrors['contactNumber'] && (
              <Text style={styles.errorText}>{fieldErrors['contactNumber'].message}</Text>
            )}
          </View>

          {/* Highest Educational Attainment */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Highest Educational Attainment</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.inputContainer,
                fieldErrors['highestEducationalAttainment'] && styles.inputError
              ]}
              onPress={() => setShowEducationalAttainmentModal(true)}
              activeOpacity={0.7}
            >
              <User size={20} color={fieldErrors['highestEducationalAttainment'] ? "#EF4444" : "#9CA3AF"} style={styles.inputIcon} />
              <Text style={[styles.input, !formData.highestEducationalAttainment && styles.placeholder]}>
                {formData.highestEducationalAttainment || 'Select your highest educational attainment'}
              </Text>
              <ChevronDown size={20} color={fieldErrors['highestEducationalAttainment'] ? "#EF4444" : "#9CA3AF"} />
            </TouchableOpacity>
            {fieldErrors['highestEducationalAttainment'] && (
              <Text style={styles.errorText}>{fieldErrors['highestEducationalAttainment'].message}</Text>
            )}
          </View>

          {/* Blood Type */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Blood Type</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.inputContainer,
                fieldErrors['bloodType'] && styles.inputError
              ]}
              onPress={() => setShowBloodTypeModal(true)}
              activeOpacity={0.7}
            >
              <User size={20} color={fieldErrors['bloodType'] ? "#EF4444" : "#9CA3AF"} style={styles.inputIcon} />
              <Text style={[styles.input, !formData.bloodType && styles.placeholder]}>
                {formData.bloodType || 'Select your blood type'}
              </Text>
              <ChevronDown size={20} color={fieldErrors['bloodType'] ? "#EF4444" : "#9CA3AF"} />
            </TouchableOpacity>
            {fieldErrors['bloodType'] && (
              <Text style={styles.errorText}>{fieldErrors['bloodType'].message}</Text>
            )}
          </View>

          {/* Allergies */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Allergies</Text>
            </View>
            <View style={styles.inputContainer}>
              <User size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Type allergies or select from common ones below"
                placeholderTextColor="#9CA3AF"
                value={formData.allergies}
                onChangeText={value => handleInputChange('allergies', value)}
                onFocus={() => setShowAllergyList(true)}
              />
            </View>
            
            {/* Always show what will be saved */}
            {/* {formData.allergies && (
              <View style={styles.finalAllergiesPreview}>
                <Text style={styles.finalAllergiesLabel}>Will be saved as:</Text>
                <Text style={styles.finalAllergiesText}>{getFinalAllergies()}</Text>
              </View>
            )} */}
            
            {/* Selected Allergies Display */}
            {(selectedAllergies.length > 0 || customAllergies.length > 0) && (
              <View style={styles.selectedAllergiesContainer}>
                <Text style={styles.selectedAllergiesTitle}>Selected Allergies:</Text>
                <View style={styles.selectedAllergiesList}>
                  {/* Show selected common allergies first */}
                  {selectedAllergies.map((allergy, index) => (
                    <View key={`selected-${allergy}-${index}`} style={styles.allergyChip}>
                      <Text style={styles.allergyChipText}>{allergy}</Text>
                      <TouchableOpacity 
                        onPress={() => removeSelectedAllergy(allergy)}
                        style={styles.removeAllergyButton}
                      >
                        <X size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {/* Show custom allergies (already filtered for duplicates) */}
                  {customAllergies
                    .filter(customAllergy => 
                      !selectedAllergies.some(selectedAllergy => 
                        selectedAllergy.toLowerCase() === customAllergy.toLowerCase()
                      )
                    )
                    .map((allergy, index) => (
                    <View key={`custom-${allergy}-${index}`} style={[styles.allergyChip, styles.customAllergyChip]}>
                      <Text style={styles.allergyChipText}>{allergy}</Text>
                      <TouchableOpacity 
                        onPress={() => removeSelectedAllergy(allergy)}
                        style={styles.removeAllergyButton}
                      >
                        <X size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            {/* Common Allergies List */}
            {showAllergyList && (
              <View style={styles.commonAllergiesContainer}>
                <View style={styles.commonAllergiesHeader}>
                  <Text style={styles.commonAllergiesTitle}>Common Allergies</Text>
                  <TouchableOpacity 
                    onPress={() => setShowAllergyList(false)}
                    style={styles.hideAllergiesButton}
                  >
                    <Text style={styles.hideAllergiesText}>Hide</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView 
                  style={styles.allergiesScrollView}
                  contentContainerStyle={styles.allergiesGrid}
                  showsVerticalScrollIndicator={false}
                >
                  {COMMON_ALLERGIES.map((allergy) => (
                    <TouchableOpacity
                      key={allergy}
                      style={[
                        styles.allergyOption,
                        selectedAllergies.includes(allergy) && styles.selectedAllergyOption
                      ]}
                      onPress={() => handleAllergyToggle(allergy)}
                    >
                      <Text style={[
                        styles.allergyOptionText,
                        selectedAllergies.includes(allergy) && styles.selectedAllergyOptionText
                      ]}>
                        {allergy}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Email</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <View style={[
              styles.inputContainer,
              fieldErrors['email'] && styles.inputError
            ]}>
              <Mail size={20} color={fieldErrors['email'] ? "#EF4444" : "#9CA3AF"} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#9CA3AF"
                value={formData.email}
                onChangeText={value => handleInputChange('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            {fieldErrors['email'] && (
              <Text style={styles.errorText}>{fieldErrors['email'].message}</Text>
            )}
          </View>
        </View>

        {/* Continue Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              (!allFieldsFilled || isValidating) && styles.buttonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!allFieldsFilled || isValidating}
            activeOpacity={allFieldsFilled && !isValidating ? 0.85 : 1}
          >
            <Text style={styles.continueButtonText}>
              {isValidating ? 'Validating...' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Gender Selection Modal */}
        <Modal
          visible={showGenderModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowGenderModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Gender</Text>
                <View style={styles.genderOptions}>
                  {GENDER_OPTIONS.map((gender) => (
                    <TouchableOpacity
                      key={gender}
                      style={[
                        styles.genderOption,
                        formData.gender === gender && styles.selectedGenderOption
                      ]}
                      onPress={() => {
                        handleInputChange('gender', gender);
                        setShowGenderModal(false);
                      }}
                    >
                      <Text style={[
                        styles.genderOptionText,
                        formData.gender === gender && styles.selectedGenderOptionText
                      ]}>
                        {gender}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Educational Attainment Selection Modal */}
        <Modal
          visible={showEducationalAttainmentModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowEducationalAttainmentModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Highest Educational Attainment</Text>
                <View style={styles.genderOptions}>
                  {EDUCATIONAL_ATTAINMENT_OPTIONS.map((attainment) => (
                    <TouchableOpacity
                      key={attainment}
                      style={[
                        styles.genderOption,
                        formData.highestEducationalAttainment === attainment && styles.selectedGenderOption
                      ]}
                      onPress={() => {
                        handleInputChange('highestEducationalAttainment', attainment);
                        setShowEducationalAttainmentModal(false);
                      }}
                    >
                      <Text style={[
                        styles.genderOptionText,
                        formData.highestEducationalAttainment === attainment && styles.selectedGenderOptionText
                      ]}>
                        {attainment}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Blood Type Selection Modal */}
        <Modal
          visible={showBloodTypeModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowBloodTypeModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Blood Type</Text>
                <View style={styles.genderOptions}>
                  {BLOOD_TYPE_OPTIONS.map((bloodType) => (
                    <TouchableOpacity
                      key={bloodType}
                      style={[
                        styles.genderOption,
                        formData.bloodType === bloodType && styles.selectedGenderOption
                      ]}
                      onPress={() => {
                        handleInputChange('bloodType', bloodType);
                        setShowBloodTypeModal(false);
                      }}
                    >
                      <Text style={[
                        styles.genderOptionText,
                        formData.bloodType === bloodType && styles.selectedGenderOptionText
                      ]}>
                        {bloodType}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Error Modal */}
        <ErrorModal
          visible={showErrorModal}
          onClose={handleErrorModalClose}
          title="Please fix the following issue:"
          message={currentError?.message || ''}
          fieldName={currentError?.field}
          suggestion={currentError?.suggestion}
          showRetry={true}
          onRetry={handleShowNextError}
        />
      </KeyboardAvoidingScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardAvoid: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerContent: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  headerSpacer: { width: 40 },
  progressContainer: {

    paddingBottom: 24,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E40AF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  formContainer: { flex: 1 },
  inputGroup: { marginBottom: 20 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  asterisk: {
    fontSize: 14,
    color: '#EF4444',
    marginLeft: 2,
    fontFamily: 'Inter-Medium',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 56,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  placeholder: { color: '#9CA3AF' },
  addressInputContainer: {
    alignItems: 'flex-start',
    minHeight: 80,
    paddingVertical: 12,
  },
  iconTopAlign: { marginRight: 12, marginTop: 4 },
  addressInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  bottomContainer: {
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  continueButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: { width: '90%', maxWidth: 350 },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  genderOptions: { gap: 8 },
  genderOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  selectedGenderOption: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  genderOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
  },
  selectedGenderOptionText: { color: '#FFFFFF' },
  // Error styles
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 4,
  },
  // Allergy selection styles
  finalAllergiesPreview: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  finalAllergiesLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
    marginBottom: 2,
  },
  finalAllergiesText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
  },
  selectedAllergiesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedAllergiesTitle: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 8,
  },
  selectedAllergiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  allergyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  customAllergyChip: {
    backgroundColor: '#059669', // Green color for custom allergies
  },
  allergyChipText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
    marginRight: 6,
  },
  removeAllergyButton: {
    padding: 2,
  },
  commonAllergiesContainer: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 200,
  },
  commonAllergiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  commonAllergiesTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  hideAllergiesButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hideAllergiesText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
  },
  allergiesScrollView: {
    flex: 1,
  },
  allergiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  allergyOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 4,
  },
  selectedAllergyOption: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  allergyOptionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  selectedAllergyOptionText: {
    color: '#FFFFFF',
  },
});
