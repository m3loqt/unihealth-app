# UniHealth Patient App

A React Native Expo application for healthcare management with Firebase integration.

## 🏗️ Project Structure

```
project/
├── app/                          # Expo Router app directory
│   ├── (auth)/                   # Authentication screens
│   │   ├── forgot-password.tsx
│   │   ├── reset-password.tsx
│   │   ├── change-password.tsx
│   │   └── signup/
│   │       ├── step1.tsx
│   │       ├── step2.tsx
│   │       └── step3.tsx
│   ├── (patient)/                # Patient-specific screens
│   │   ├── tabs/                 # Patient tab navigation
│   │   │   ├── index.tsx         # Dashboard
│   │   │   ├── profile.tsx       # Patient profile
│   │   │   ├── appointments.tsx  # Appointments list
│   │   │   ├── prescriptions.tsx # Prescriptions list
│   │   │   ├── certificates.tsx  # Medical certificates
│   │   │   └── _layout.tsx       # Tab layout
│   │   ├── book-visit/           # Appointment booking flow
│   │   │   ├── index.tsx
│   │   │   ├── select-datetime.tsx
│   │   │   └── review-confirm.tsx
│   │   ├── edit-profile.tsx
│   │   ├── patient-overview.tsx
│   │   ├── patient-consultation.tsx
│   │   ├── certificate-details.tsx
│   │   └── visit-overview.tsx
│   ├── (specialist)/             # Specialist-specific screens
│   │   └── tabs/                 # Specialist tab navigation
│   │       ├── index.tsx         # Specialist dashboard
│   │       ├── profile.tsx       # Specialist profile
│   │       ├── patients.tsx      # Patient list
│   │       ├── appointments.tsx  # Specialist appointments
│   │       └── _layout.tsx       # Tab layout
│   ├── (shared)/                 # Shared screens
│   │   ├── terms-privacy.tsx
│   │   └── help-support.tsx
│   ├── _layout.tsx               # Root layout
│   ├── index.tsx                 # Sign-in screen
│   └── +not-found.tsx           # 404 screen
├── src/                          # Source code
│   ├── components/               # Reusable components
│   │   ├── ui/                   # Base UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── index.ts
│   │   ├── forms/                # Form components
│   │   ├── navigation/           # Navigation components
│   │   │   ├── TabBar.tsx
│   │   │   ├── SpecialistTabBar.tsx
│   │   │   └── index.ts
│   │   ├── patient/              # Patient-specific components
│   │   ├── specialist/           # Specialist-specific components
│   │   ├── shared/               # Shared components
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── hooks/                    # Custom React hooks
│   │   ├── auth/                 # Authentication hooks
│   │   │   ├── useAuth.tsx
│   │   │   ├── useBiometricAuth.ts
│   │   │   └── index.ts
│   │   ├── data/                 # Data management hooks
│   │   │   ├── useAppointments.ts
│   │   │   ├── usePrescriptions.ts
│   │   │   └── index.ts
│   │   ├── ui/                   # UI state hooks
│   │   │   ├── useModal.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── services/                 # Service layer
│   │   ├── api/                  # API services
│   │   │   └── auth.ts
│   │   ├── database/             # Database services
│   │   │   └── firebase.ts
│   │   ├── storage/              # Storage services
│   │   └── utils/                # Service utilities
│   ├── types/                    # TypeScript type definitions
│   │   ├── auth.ts
│   │   ├── appointments.ts
│   │   ├── prescriptions.ts
│   │   ├── patients.ts
│   │   ├── common.ts
│   │   └── index.ts
│   ├── constants/                # Application constants
│   │   ├── colors.ts
│   │   ├── routes.ts
│   │   ├── api.ts
│   │   ├── validation.ts
│   │   └── index.ts
│   ├── utils/                    # Utility functions
│   │   ├── date.ts
│   │   ├── string.ts
│   │   ├── validation.ts
│   │   ├── formatting.ts
│   │   └── index.ts
│   ├── config/                   # Configuration files
│   │   └── firebase.ts
│   └── styles/                   # Global styles
├── docs/                         # Documentation
├── tests/                        # Test files
└── package.json
```

## 🚀 Features

### Authentication
- Firebase Authentication integration
- Static user support for testing
- Biometric authentication
- Role-based routing (Patient/Specialist)

### Patient Features
- Dashboard with health overview
- Appointment booking and management
- Prescription tracking
- Medical certificate access
- Profile management

### Specialist Features
- Patient management
- Appointment scheduling
- Medical record access
- Consultation tools

### Technical Features
- TypeScript for type safety
- Expo Router v5 for navigation
- Firebase Realtime Database
- Responsive design
- Error handling and loading states

## 🛠️ Development

### Prerequisites
- Node.js (v16 or higher)
- Expo CLI
- Firebase project setup

### Installation
```bash
npm install
```

### Running the App
```bash
npx expo start
```

### Key Dependencies
- React Native
- Expo
- Firebase
- TypeScript
- Expo Router

## 📱 Architecture

### Component Structure
- **UI Components**: Reusable base components (Button, Input, Card, Modal)
- **Shared Components**: Common functionality (LoadingSpinner, EmptyState, ErrorBoundary)
- **Feature Components**: Role-specific components for patients and specialists

### State Management
- **React Context**: Global authentication state
- **Custom Hooks**: Feature-specific data management
- **Firebase**: Real-time data synchronization

### Data Flow
1. Authentication through Firebase
2. Role-based routing to appropriate screens
3. Data fetching through custom hooks
4. UI updates with loading and error states

## 🔧 Configuration

### Firebase Setup
1. Create a Firebase project
2. Enable Authentication and Realtime Database
3. Update `src/config/firebase.ts` with your configuration

### Environment Variables
Create a `.env` file with:
```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

## 📋 Database Schema

### Users
```typescript
interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'patient' | 'specialist';
  // ... other fields
}
```

### Appointments
```typescript
interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  appointmentTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  // ... other fields
}
```

## 🧪 Testing

### Running Tests
```bash
npm test
```

### Test Structure
- Unit tests for utilities and hooks
- Integration tests for API services
- Component tests for UI elements

## 📚 Documentation

- [API Documentation](./docs/api.md)
- [Component Library](./docs/components.md)
- [Database Schema](./docs/database.md)
- [Deployment Guide](./docs/deployment.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please contact the development team or create an issue in the repository. 


-UniHealth Team | Odyssey Solutions Incorporated 
