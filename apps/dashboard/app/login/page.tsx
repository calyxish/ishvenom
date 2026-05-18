import { redirect } from 'next/navigation';

// Auth wall removed — dashboard is open for demo / judge access.
export default function LoginPage() {
  redirect('/dashboard');
}
