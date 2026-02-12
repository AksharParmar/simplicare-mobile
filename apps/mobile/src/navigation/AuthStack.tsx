import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerBackTitle: 'Back' }}>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: 'Welcome' }} />
      <AuthStack.Screen name="Signup" component={SignupScreen} options={{ title: 'Create Account' }} />
      <AuthStack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ title: 'Reset Password' }}
      />
    </AuthStack.Navigator>
  );
}
